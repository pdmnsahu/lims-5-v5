import { Router } from 'express';
import { sql } from '../db/client.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction, getIP } from '../lib/audit.js';

const router = Router();
router.use(authenticate);

// GET /api/sample-groups
router.get('/', async (req, res) => {
  try {
    const groups = await sql`
      SELECT sg.*, c.name AS client_name, u.name AS collected_by_name,
             COUNT(s.id)::int AS sample_count
      FROM sample_groups sg
      LEFT JOIN clients c ON c.id = sg.client_id
      LEFT JOIN users u   ON u.id = sg.collected_by
      LEFT JOIN samples s ON s.sample_group_id = sg.id
      GROUP BY sg.id, c.name, u.name
      ORDER BY sg.created_at DESC
    `;
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sample-groups/:id
router.get('/:id', async (req, res) => {
  try {
    const [group] = await sql`
      SELECT sg.*, c.name AS client_name, u.name AS collected_by_name
      FROM sample_groups sg
      LEFT JOIN clients c ON c.id = sg.client_id
      LEFT JOIN users u   ON u.id = sg.collected_by
      WHERE sg.id = ${req.params.id}
    `;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const samples = await sql`
      SELECT s.*,
        COUNT(st.id)::int AS test_count,
        COUNT(CASE WHEN st.status='approved' THEN 1 END)::int AS approved_count,
        COALESCE(json_agg(
          json_build_object(
            'test_id', st.id, 'test_definition_id', st.test_definition_id,
            'test_name', td.name, 'status', st.status, 'chemist_name', uch.name,
            'chemist_id', st.assigned_chemist_id
          )
        ) FILTER (WHERE st.id IS NOT NULL), '[]') AS assigned_tests
      FROM samples s
      LEFT JOIN sample_tests st     ON st.sample_id = s.id
      LEFT JOIN test_definitions td  ON td.id = st.test_definition_id
      LEFT JOIN users uch            ON uch.id = st.assigned_chemist_id
      WHERE s.sample_group_id = ${req.params.id}
      GROUP BY s.id
      ORDER BY s.created_at ASC
    `;

    res.json({ ...group, samples });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sample-groups — admin creates
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { group_ref_id, client_id, samples } = req.body;
    if (!group_ref_id || !client_id || !samples?.length)
      return res.status(400).json({ error: 'group_ref_id, client_id and samples are required' });

    const refIds = samples.map(s => s.sample_ref_id.trim());
    if (new Set(refIds).size !== refIds.length)
      return res.status(400).json({ error: 'Duplicate sample IDs in your submission' });

    const [group] = await sql`
      INSERT INTO sample_groups (group_ref_id, client_id, collected_by)
      VALUES (${group_ref_id}, ${client_id}, ${req.user.id})
      RETURNING *
    `;

    const inserted = [];
    for (const s of samples) {
      const [sample] = await sql`
        INSERT INTO samples (sample_group_id, sample_ref_id, description)
        VALUES (${group.id}, ${s.sample_ref_id.trim()}, ${s.description ?? null})
        RETURNING *
      `;
      inserted.push(sample);
    }

    res.status(201).json({ ...group, samples: inserted });

    await logAction({ user: req.user, action: 'CREATE_SAMPLE_GROUP', entityType: 'sample_group',
      entityId: group.id, entityLabel: group_ref_id,
      detail: { client_id, sample_count: inserted.length }, ip: getIP(req) });
  } catch (err) {
    if (err.message?.includes('unique'))
      return res.status(409).json({ error: 'Group ID already exists, or a sample ID is already registered in this group' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/sample-groups/:id — super_admin or admin (collected owner)
// Editable: group_ref_id (no submitted tests), client_id (no approved tests)
router.patch('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { group_ref_id, client_id } = req.body;

    const [group] = await sql`SELECT * FROM sample_groups WHERE id = ${req.params.id}`;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Admin can only edit groups they collected
    if (req.user.role === 'admin' && group.collected_by !== req.user.id)
      return res.status(403).json({ error: 'You can only edit groups you registered' });

    // group_ref_id: block if any test has been submitted
    if (group_ref_id && group_ref_id !== group.group_ref_id) {
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM sample_tests st
        JOIN samples s ON s.id = st.sample_id
        WHERE s.sample_group_id = ${req.params.id}
          AND st.status IN ('submitted','approved')
      `;
      if (count > 0)
        return res.status(409).json({ error: 'Cannot change Group ID — tests have already been submitted or approved' });
    }

    // client_id: block if any test has been approved
    if (client_id && client_id !== group.client_id) {
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM sample_tests st
        JOIN samples s ON s.id = st.sample_id
        WHERE s.sample_group_id = ${req.params.id} AND st.status = 'approved'
      `;
      if (count > 0)
        return res.status(409).json({ error: 'Cannot change Client — some tests are already approved and will appear on reports' });
    }

    const [updated] = await sql`
      UPDATE sample_groups SET
        group_ref_id = COALESCE(${group_ref_id ?? null}, group_ref_id),
        client_id    = COALESCE(${client_id    ?? null}::uuid, client_id)
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    await logAction({ user: req.user, action: 'EDIT_SAMPLE_GROUP', entityType: 'sample_group',
      entityId: updated.id, entityLabel: updated.group_ref_id,
      detail: {
        old_group_ref_id: group.group_ref_id, new_group_ref_id: updated.group_ref_id,
        old_client_id:    group.client_id,    new_client_id:    updated.client_id,
      }, ip: getIP(req) });

    res.json(updated);
  } catch (err) {
    if (err.message?.includes('unique'))
      return res.status(409).json({ error: 'That Group ID is already taken by another group' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sample-groups/:id — super_admin or admin (collected + still 'collected' status)
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const [group] = await sql`SELECT * FROM sample_groups WHERE id = ${req.params.id}`;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role === 'admin' && group.collected_by !== req.user.id)
      return res.status(403).json({ error: 'You can only delete groups you registered' });

    if (group.status !== 'collected')
      return res.status(409).json({ error: 'Cannot delete — group is already in progress. Contact super admin.' });

    // Extra safety: no tests at all
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM sample_tests st
      JOIN samples s ON s.id = st.sample_id
      WHERE s.sample_group_id = ${req.params.id}
    `;
    if (count > 0)
      return res.status(409).json({ error: 'Cannot delete — tests have already been assigned. Contact super admin.' });

    await sql`DELETE FROM sample_groups WHERE id = ${req.params.id}`;

    await logAction({ user: req.user, action: 'DELETE_SAMPLE_GROUP', entityType: 'sample_group',
      entityId: req.params.id, entityLabel: group.group_ref_id,
      detail: { sample_count: group.sample_count }, ip: getIP(req) });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
