import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Badge, Modal, Field, Alert, PageSpinner, Confirm } from '../components/shared/UI';
import { useAuth } from '../contexts/AuthContext';
import { FlaskConical, Hash, Layers, Check, Minus, Pencil, Trash2, RefreshCw, Settings } from 'lucide-react';

export default function SampleGroupDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [group,      setGroup]     = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [loadError,  setLoadError] = useState('');
  const [chemists,   setChemists]  = useState([]);
  const [testDefs,   setTestDefs]  = useState([]);
  const [clients,    setClients]   = useState([]);

  const isManager    = user.role === 'lab_manager';
  const isSuperAdmin = user.role === 'super_admin';
  const isAdmin      = user.role === 'admin';

  // Edit Group modal
  const [editGroupOpen,   setEditGroupOpen]   = useState(false);
  const [editGroupForm,   setEditGroupForm]   = useState({ group_ref_id: '', client_id: '' });
  const [editGroupErr,    setEditGroupErr]    = useState('');
  const [editGroupSaving, setEditGroupSaving] = useState(false);

  // Edit Sample Ref ID modal
  const [editRefModal,  setEditRefModal]  = useState(null);
  const [editRefVal,    setEditRefVal]    = useState('');
  const [editRefErr,    setEditRefErr]    = useState('');
  const [editRefSaving, setEditRefSaving] = useState(false);

  // Lab ID modal
  const [labModal,  setLabModal]  = useState(null);
  const [labId,     setLabId]     = useState('');
  const [labError,  setLabError]  = useState('');
  const [labSaving, setLabSaving] = useState(false);

  // Bulk assign
  const [bulkOpen,        setBulkOpen]        = useState(false);
  const [bulkError,       setBulkError]       = useState('');
  const [bulkSaving,      setBulkSaving]      = useState(false);
  const [bulkResult,      setBulkResult]      = useState(null);
  const [selectedSamples, setSelectedSamples] = useState({});
  const [assignments,     setAssignments]     = useState([{ test_definition_id: '', assigned_chemist_id: '' }]);

  // Reassign chemist
  const [reassignModal,   setReassignModal]   = useState(null);
  const [reassignChemist, setReassignChemist] = useState('');
  const [reassignErr,     setReassignErr]     = useState('');
  const [reassignSaving,  setReassignSaving]  = useState(false);

  // Confirms
  const [deleteTestConfirm,  setDeleteTestConfirm]  = useState(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false);

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await api.getSampleGroup(id);
      setGroup(data);
    } catch (err) { setLoadError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isManager || isSuperAdmin) {
      Promise.all([api.getUsers('chemist'), api.getTestDefinitions()])
        .then(([c, d]) => { setChemists(c); setTestDefs(d); }).catch(() => {});
    }
    if (isSuperAdmin || isAdmin) {
      api.getClients().then(setClients).catch(() => {});
    }
  }, [id]);

  // ── Edit Group ──────────────────────────────────────────────────────────────
  const openEditGroup = () => {
    setEditGroupForm({ group_ref_id: group.group_ref_id, client_id: group.client_id });
    setEditGroupErr(''); setEditGroupOpen(true);
  };
  const handleEditGroup = async (e) => {
    e.preventDefault(); setEditGroupSaving(true); setEditGroupErr('');
    try {
      await api.updateSampleGroup(id, {
        group_ref_id: editGroupForm.group_ref_id !== group.group_ref_id ? editGroupForm.group_ref_id : undefined,
        client_id:    editGroupForm.client_id    !== group.client_id    ? editGroupForm.client_id    : undefined,
      });
      setEditGroupOpen(false); load();
    } catch (err) { setEditGroupErr(err.message); }
    finally { setEditGroupSaving(false); }
  };

  // ── Delete Group ────────────────────────────────────────────────────────────
  const handleDeleteGroup = async () => {
    try { await api.deleteSampleGroup(id); navigate('/sample-groups'); }
    catch (err) { alert(err.message); }
    setDeleteGroupConfirm(false);
  };

  // ── Edit Sample Ref ID ──────────────────────────────────────────────────────
  const openEditRef = (sample) => { setEditRefVal(sample.sample_ref_id); setEditRefErr(''); setEditRefModal(sample); };
  const handleEditRef = async (e) => {
    e.preventDefault(); setEditRefSaving(true); setEditRefErr('');
    try { await api.editSampleRefId(editRefModal.id, editRefVal); setEditRefModal(null); load(); }
    catch (err) { setEditRefErr(err.message); }
    finally { setEditRefSaving(false); }
  };

  // ── Lab ID ──────────────────────────────────────────────────────────────────
  const openLabModal = (sample) => { setLabId(sample.lab_internal_id || ''); setLabError(''); setLabModal(sample); };
  const handleAssignLabId = async (e) => {
    e.preventDefault(); setLabSaving(true); setLabError('');
    try { await api.assignLabId(labModal.id, labId); setLabModal(null); load(); }
    catch (err) { setLabError(err.message); }
    finally { setLabSaving(false); }
  };

  // ── Bulk assign ─────────────────────────────────────────────────────────────
  const openBulk = () => {
    const initial = {};
    group.samples.forEach(s => { initial[s.id] = true; });
    setSelectedSamples(initial);
    setAssignments([{ test_definition_id: '', assigned_chemist_id: '' }]);
    setBulkError(''); setBulkResult(null); setBulkOpen(true);
  };
  const allSelected = group ? group.samples.every(s => selectedSamples[s.id]) : false;
  const toggleAll   = () => { const n = {}; group.samples.forEach(s => { n[s.id] = !allSelected; }); setSelectedSamples(n); };
  const toggleSample  = (sid)    => setSelectedSamples(p => ({ ...p, [sid]: !p[sid] }));
  const addRow        = ()       => setAssignments(a => [...a, { test_definition_id: '', assigned_chemist_id: '' }]);
  const removeRow     = (i)      => setAssignments(a => a.filter((_, idx) => idx !== i));
  const updateRow     = (i,k,v)  => setAssignments(a => a.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const assignedDefIds = useMemo(() => {
    const map = {};
    group?.samples.forEach(s => { map[s.id] = new Set((s.assigned_tests || []).map(t => t.test_definition_id)); });
    return map;
  }, [group]);

  const availableTests = (rowIdx) => {
    const chosen     = new Set(assignments.filter((_, i) => i !== rowIdx).map(r => r.test_definition_id).filter(Boolean));
    const selIds     = Object.entries(selectedSamples).filter(([, v]) => v).map(([k]) => k);
    return testDefs.filter(td => {
      if (chosen.has(td.id)) return false;
      if (selIds.length > 0 && selIds.every(sid => assignedDefIds[sid]?.has(td.id))) return false;
      return true;
    });
  };

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    const selIds = Object.entries(selectedSamples).filter(([, v]) => v).map(([k]) => k);
    if (!selIds.length) return setBulkError('Select at least one sample');
    const valid = assignments.filter(a => a.test_definition_id && a.assigned_chemist_id);
    if (!valid.length) return setBulkError('Add at least one complete assignment');
    setBulkSaving(true); setBulkError('');
    try {
      const result = await api.bulkAssign({ sample_ids: selIds, assignments: valid });
      setBulkResult(result); load();
    } catch (err) { setBulkError(err.message); }
    finally { setBulkSaving(false); }
  };

  // ── Reassign ────────────────────────────────────────────────────────────────
  const openReassign = (test) => { setReassignChemist(test.chemist_id || ''); setReassignErr(''); setReassignModal(test); };
  const handleReassign = async (e) => {
    e.preventDefault(); setReassignSaving(true); setReassignErr('');
    try { await api.reassignTest(reassignModal.test_id, { assigned_chemist_id: reassignChemist }); setReassignModal(null); load(); }
    catch (err) { setReassignErr(err.message); }
    finally { setReassignSaving(false); }
  };

  // ── Delete test ─────────────────────────────────────────────────────────────
  const handleDeleteTest = async () => {
    try { await api.deleteTest(deleteTestConfirm.test_id); load(); }
    catch (err) { alert(err.message); }
    setDeleteTestConfirm(null);
  };

  if (loading)   return <PageSpinner />;
  if (loadError) return <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{loadError} <button onClick={load} className="ml-2 underline">Retry</button></div>;
  if (!group)    return null;

  const selectedCount  = Object.values(selectedSamples).filter(Boolean).length;
  const canDeleteGroup = group.status === 'collected' && (isSuperAdmin || isAdmin);
  const canEditGroup   = isSuperAdmin || isAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">GROUP</span>
            <h1 className="text-2xl font-bold text-gray-900">{group.group_ref_id}</h1>
            <Badge status={group.status} />
          </div>
          <p className="text-sm text-gray-500">
            Client: <span className="font-medium text-gray-700">{group.client_name}</span>
            {' · '}Collected by <span className="font-medium text-gray-700">{group.collected_by_name}</span>
            {' · '}{group.samples.length} sample(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEditGroup && (
            <button className="btn-secondary" onClick={openEditGroup}><Settings size={14} /> Edit Group</button>
          )}
          {canDeleteGroup && (
            <button className="btn-danger" onClick={() => setDeleteGroupConfirm(true)}><Trash2 size={14} /> Delete Group</button>
          )}
          {(isManager || isSuperAdmin) && (
            <button className="btn-primary" onClick={openBulk}><Layers size={15} /> Bulk Assign Tests</button>
          )}
        </div>
      </div>

      {/* Samples table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Samples ({group.samples.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Sample Ref ID', 'Lab Internal ID', 'Description', 'Assigned Tests', 'Actions'].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {group.samples.map(s => {
                const hasLabId     = !!s.lab_internal_id;
                const canEditRefId = !hasLabId && (isSuperAdmin || isAdmin);
                const hasSubmitted = (s.assigned_tests || []).some(t => ['submitted','approved'].includes(t.status));
                const canEditLabId = (isManager || isSuperAdmin) && !hasSubmitted;

                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-gray-800">{s.sample_ref_id}</span>
                        {canEditRefId && (
                          <button onClick={() => openEditRef(s)} title="Edit Sample ID"
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {hasLabId
                          ? <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.lab_internal_id}</span>
                          : <span className="text-gray-300 text-xs italic">Not assigned</span>}
                        {canEditLabId && (
                          <button onClick={() => openLabModal(s)} title={hasLabId ? 'Edit Lab ID' : 'Assign Lab ID'}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                            {hasLabId ? <Pencil size={11} /> : <Hash size={11} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{s.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.assigned_tests || []).length === 0
                          ? <span className="text-xs text-gray-300 italic">None</span>
                          : (s.assigned_tests || []).map(t => (
                            <div key={t.test_id} className="flex items-center gap-0.5">
                              <span className={`badge text-xs ${
                                t.status==='approved'  ? 'bg-green-50 text-green-700'   :
                                t.status==='submitted' ? 'bg-purple-50 text-purple-700' :
                                t.status==='rejected'  ? 'bg-red-50 text-red-700'       :
                                'bg-gray-100 text-gray-500'}`}>
                                {t.test_name}
                                {t.chemist_name && <span className="ml-1 opacity-60">· {t.chemist_name}</span>}
                              </span>
                              {t.status === 'pending' && (isManager || isSuperAdmin) && (<>
                                <button onClick={() => openReassign(t)} title="Reassign"
                                  className="p-0.5 rounded hover:bg-amber-100 text-gray-300 hover:text-amber-600"><RefreshCw size={10} /></button>
                                <button onClick={() => setDeleteTestConfirm(t)} title="Delete"
                                  className="p-0.5 rounded hover:bg-red-100 text-gray-300 hover:text-red-500"><Trash2 size={10} /></button>
                              </>)}
                            </div>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(isManager || isSuperAdmin) && (
                        <button onClick={openBulk} className="inline-flex items-center gap-1 text-xs btn-primary py-1 px-2">
                          <FlaskConical size={10} /> Assign
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Group Modal */}
      <Modal open={editGroupOpen} onClose={() => setEditGroupOpen(false)} title="Edit Sample Group" size="sm">
        <form onSubmit={handleEditGroup} className="space-y-4">
          <Field label="Group Reference ID" required>
            <input className="input font-mono" value={editGroupForm.group_ref_id}
              onChange={e => setEditGroupForm(f => ({ ...f, group_ref_id: e.target.value }))} />
          </Field>
          <Field label="Client" required>
            <select className="input" value={editGroupForm.client_id}
              onChange={e => setEditGroupForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
            Group ID cannot be changed once tests are submitted. Client cannot be changed once any test is approved.
          </div>
          <Alert type="error" message={editGroupErr} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setEditGroupOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editGroupSaving}>{editGroupSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      <Confirm open={deleteGroupConfirm} onClose={() => setDeleteGroupConfirm(false)} onConfirm={handleDeleteGroup} danger
        title="Delete Sample Group"
        message={`Delete group "${group.group_ref_id}" and all ${group.samples.length} sample(s)? Only allowed when status is Collected and no tests are assigned.`} />

      {/* Edit Sample Ref ID Modal */}
      <Modal open={!!editRefModal} onClose={() => setEditRefModal(null)} title="Edit Sample Reference ID" size="sm">
        <form onSubmit={handleEditRef} className="space-y-4">
          <p className="text-sm text-gray-500">Current: <span className="font-mono font-semibold">{editRefModal?.sample_ref_id}</span></p>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">Only editable before a Lab Internal ID is assigned.</div>
          <Field label="New Sample Reference ID" required>
            <input className="input font-mono" required value={editRefVal} onChange={e => setEditRefVal(e.target.value)} autoFocus />
          </Field>
          <Alert type="error" message={editRefErr} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setEditRefModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editRefSaving}>{editRefSaving ? 'Saving…' : 'Update'}</button>
          </div>
        </form>
      </Modal>

      {/* Lab ID Modal */}
      <Modal open={!!labModal} onClose={() => setLabModal(null)}
        title={labModal?.lab_internal_id ? 'Edit Lab Internal ID' : 'Assign Lab Internal ID'} size="sm">
        <form onSubmit={handleAssignLabId} className="space-y-4">
          <p className="text-sm text-gray-500">Sample: <span className="font-mono font-semibold">{labModal?.sample_ref_id}</span></p>
          {labModal?.lab_internal_id && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
              Current: <span className="font-mono font-semibold">{labModal.lab_internal_id}</span> — only editable before results are submitted.
            </div>
          )}
          <Field label="Lab Internal ID" required>
            <input className="input font-mono" required value={labId} onChange={e => setLabId(e.target.value)} placeholder="LAB-2024-001" autoFocus />
          </Field>
          <p className="text-xs text-gray-400">Must be globally unique across all samples.</p>
          <Alert type="error" message={labError} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setLabModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={labSaving}>
              {labSaving ? 'Saving…' : labModal?.lab_internal_id ? 'Update' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reassign Modal */}
      <Modal open={!!reassignModal} onClose={() => setReassignModal(null)} title="Reassign Test to Different Chemist" size="sm">
        <form onSubmit={handleReassign} className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 text-xs uppercase font-semibold">Test</span><span className="font-medium">{reassignModal?.test_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 text-xs uppercase font-semibold">Currently</span><span className="text-gray-700">{reassignModal?.chemist_name || '—'}</span></div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">Only pending tests can be reassigned.</div>
          <Field label="New Chemist" required>
            <select className="input" required value={reassignChemist} onChange={e => setReassignChemist(e.target.value)}>
              <option value="">— Select chemist —</option>
              {chemists.map(c => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
            </select>
          </Field>
          <Alert type="error" message={reassignErr} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setReassignModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={reassignSaving}><RefreshCw size={14} /> {reassignSaving ? 'Reassigning…' : 'Reassign'}</button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!deleteTestConfirm} onClose={() => setDeleteTestConfirm(null)} onConfirm={handleDeleteTest} danger
        title="Delete Test Assignment"
        message={`Remove "${deleteTestConfirm?.test_name}" test? Only pending tests can be deleted.`} />

      {/* Bulk Assign Modal */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Assign Tests to Chemists" size="xl">
        {bulkResult ? (
          <div className="space-y-4">
            <Alert type="success" message={`Done! ${bulkResult.created} assigned, ${bulkResult.skipped} skipped.`} />
            <button className="btn-primary" onClick={() => { setBulkOpen(false); setBulkResult(null); }}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleBulkAssign} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800 text-sm">Select Samples <span className="text-gray-400 font-normal">({selectedCount} of {group.samples.length})</span></h3>
                <button type="button" onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800">
                  {allSelected ? <><Minus size={12} /> Deselect all</> : <><Check size={12} /> Select all</>}
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[32px_1fr_1fr_2fr] bg-gray-50 border-b border-gray-200 px-3 py-2">
                  <span /><span className="text-xs font-semibold text-gray-500 uppercase">Sample ID</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Lab ID</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Already assigned</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {group.samples.map(s => (
                    <label key={s.id} className={`grid grid-cols-[32px_1fr_1fr_2fr] items-center px-3 py-2.5 cursor-pointer ${selectedSamples[s.id] ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={!!selectedSamples[s.id]} onChange={() => toggleSample(s.id)} className="accent-brand-600 w-4 h-4" />
                      <span className="font-mono text-sm font-semibold text-gray-800">{s.sample_ref_id}</span>
                      <span className="font-mono text-xs text-blue-600">{s.lab_internal_id || '—'}</span>
                      <div className="flex flex-wrap gap-1">
                        {(s.assigned_tests || []).length === 0
                          ? <span className="text-xs text-gray-300">none</span>
                          : (s.assigned_tests || []).map(t => <span key={t.test_id} className="badge bg-gray-100 text-gray-500 text-xs">{t.test_name}</span>)}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800 text-sm">Test Assignments</h3>
                <button type="button" onClick={addRow} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add another</button>
              </div>
              <div className="space-y-2">
                {assignments.map((row, i) => (
                  <div key={i} className="flex items-end gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs text-gray-400 w-5 shrink-0 text-right pb-2">{i+1}.</span>
                    <div className="flex-1">
                      <label className="label mb-1">Test Parameter</label>
                      <select className="input text-sm" value={row.test_definition_id} onChange={e => updateRow(i, 'test_definition_id', e.target.value)}>
                        <option value="">— Select test —</option>
                        {availableTests(i).map(d => <option key={d.id} value={d.id}>{d.name} ({d.unit || 'no unit'})</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="label mb-1">Assign to Chemist</label>
                      <select className="input text-sm" value={row.assigned_chemist_id} onChange={e => updateRow(i, 'assigned_chemist_id', e.target.value)}>
                        <option value="">— Select chemist —</option>
                        {chemists.map(c => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
                      </select>
                    </div>
                    {assignments.length > 1 && <button type="button" onClick={() => removeRow(i)} className="pb-2 p-1.5 text-gray-300 hover:text-red-500 shrink-0">✕</button>}
                  </div>
                ))}
              </div>
            </div>

            <Alert type="error" message={bulkError} />
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Assigning <strong>{assignments.filter(a => a.test_definition_id && a.assigned_chemist_id).length}</strong> test(s) to <strong>{selectedCount}</strong> sample(s)
              </p>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={() => setBulkOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={bulkSaving}><FlaskConical size={14} /> {bulkSaving ? 'Assigning…' : 'Assign Tests'}</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
