import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Table, Badge, Modal, Field, Alert, Empty } from '../components/shared/UI';
import { ClipboardList, Plus, Trash2, ChevronRight, ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; 

export default function SampleGroupsPage() {
  const { user }       = useAuth();
  const [groups,   setGroups]  = useState([]);
  const [clients,  setClients] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [error,    setError]   = useState('');
  const [saving,   setSaving]  = useState(false);

  // Form state
  const [groupRefId, setGroupRefId] = useState('');
  const [clientId,   setClientId]   = useState('');
  const [rows,       setRows]       = useState([{ sample_ref_id: '', description: '' }]);

  // Ref map: index → input DOM element for sample_ref_id inputs
  const inputRefs = useRef({});

  // ── Auto-focus last row's sample_ref_id input whenever rows are added ──────
  useEffect(() => {
    const lastIndex = rows.length - 1;
    const el = inputRefs.current[lastIndex];
    if (el) {
      el.focus();
      // Also scroll it into view smoothly in case the list is long
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [rows.length]); // only fires when the number of rows changes, not on every keystroke

  const load = async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([api.getSampleGroups(), api.getClients()]);
      setGroups(g); setClients(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    setGroupRefId(''); setClientId('');
    setRows([{ sample_ref_id: '', description: '' }]);
    inputRefs.current = {};
    setError(''); setModal(true);
  };

  const addRow = useCallback(() => {
    setRows(r => [...r, { sample_ref_id: '', description: '' }]);
  }, []);

  const removeRow = (i) => {
    setRows(r => r.filter((_, idx) => idx !== i));
    // Clean up the ref for the removed row
    delete inputRefs.current[i];
    // Re-focus the row above if possible
    const above = inputRefs.current[i - 1];
    if (above) above.focus();
  };

  const updateRow = (i, key, val) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  // ── Barcode scanner Enter handler ──────────────────────────────────────────
  // Scanners type the barcode then send Enter. We intercept Enter on the
  // sample_ref_id input to:
  //   1. Skip if the field is empty (don't add blank rows)
  //   2. Add a new row and let the useEffect above focus it
  const handleSampleKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // stop form submission
      const val = rows[i].sample_ref_id.trim();
      if (!val) return; // scanner fired on empty field — ignore
      // Only add a new row if this is the last row
      if (i === rows.length - 1) {
        addRow();
      } else {
        // Move focus to the next row's sample_ref_id input
        const next = inputRefs.current[i + 1];
        if (next) next.focus();
      }
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupRefId || !clientId) return setError('Group ID and client are required');
    const filledRows = rows.filter(r => r.sample_ref_id.trim());
    if (!filledRows.length) return setError('Add at least one sample');
    setSaving(true); setError('');
    try {
      await api.createSampleGroup({ group_ref_id: groupRefId, client_id: clientId, samples: filledRows });
      setModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user.role === 'admin';

  // Count filled rows
  const filledCount = rows.filter(r => r.sample_ref_id.trim()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sample Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Batches of coal samples received from clients.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openModal}>
            <Plus size={15} /> Register Group
          </button>
        )}
      </div>

      <Table headers={['Group Ref ID', 'Client', 'Samples', 'Status', 'Received', 'Actions']} loading={loading}>
        {groups.length === 0 && !loading
          ? <tr><td colSpan={6}><Empty message="No sample groups registered." icon={ClipboardList} /></td></tr>
          : groups.map(g => (
            <tr key={g.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">{g.group_ref_id}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{g.client_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{g.sample_count} sample(s)</td>
              <td className="px-4 py-3"><Badge status={g.status} /></td>
              <td className="px-4 py-3 text-sm text-gray-400">{new Date(g.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <Link to={`/sample-groups/${g.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
                  View <ChevronRight size={12} />
                </Link>
              </td>
            </tr>
          ))}
      </Table>

      {/* Register Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Register Sample Group" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">

          {/* Group info */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Group Reference ID" required>
              <input
                className="input font-mono"
                required
                value={groupRefId}
                onChange={e => setGroupRefId(e.target.value)}
                placeholder="GRP-2024-001"
              />
            </Field>
            <Field label="Client" required>
              <select className="input" required value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Sample rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="label mb-0">Samples <span className="text-brand-600">*</span></label>
                {/* Scanner indicator */}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                  <ScanLine size={10} />
                  Barcode scanner ready — scan into the highlighted field
                </span>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Add Row
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[24px_1fr_1fr_28px] gap-2 px-0.5 mb-1">
              <span />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sample Ref ID</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description (optional)</span>
              <span />
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1" id="sample-rows-container">
              {rows.map((row, i) => {
                const isLast    = i === rows.length - 1;
                const isFilled  = !!row.sample_ref_id.trim();

                return (
                  <div key={i} className={`grid grid-cols-[24px_1fr_1fr_28px] items-center gap-2 rounded-lg px-1 py-0.5
                    ${isLast ? 'bg-brand-50 ring-1 ring-brand-200' : isFilled ? 'bg-green-50' : ''}`}>
                    {/* Row number */}
                    <span className={`text-xs text-right shrink-0 font-mono
                      ${isFilled ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                      {isFilled ? '✓' : `${i + 1}.`}
                    </span>

                    {/* Sample ID — barcode scans go here */}
                    <input
                      ref={el => { inputRefs.current[i] = el; }}
                      className={`input font-mono text-sm transition-all
                        ${isLast
                          ? 'ring-2 ring-brand-400 border-brand-400'
                          : isFilled
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : ''}`}
                      placeholder={isLast ? '▸ Scan barcode or type…' : 'Sample Ref ID'}
                      value={row.sample_ref_id}
                      onChange={e => updateRow(i, 'sample_ref_id', e.target.value)}
                      onKeyDown={e => handleSampleKeyDown(e, i)}
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {/* Description */}
                    <input
                      className="input text-sm"
                      placeholder="Description"
                      value={row.description}
                      onChange={e => updateRow(i, 'description', e.target.value)}
                      onKeyDown={e => {
                        // Tab from description on last row adds a new row
                        if (e.key === 'Tab' && !e.shiftKey && i === rows.length - 1) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                    />

                    {/* Remove button */}
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded shrink-0"
                        tabIndex={-1}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                {filledCount > 0
                  ? <><span className="text-green-600 font-semibold">{filledCount}</span> sample{filledCount !== 1 ? 's' : ''} scanned · {rows.length - filledCount} empty row{rows.length - filledCount !== 1 ? 's' : ''}</>
                  : `${rows.length} row${rows.length !== 1 ? 's' : ''} — start scanning`}
              </p>
              <p className="text-[10px] text-gray-400">
                Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500 font-mono text-[9px]">Enter</kbd> after each scan to advance
              </p>
            </div>
          </div>

          <Alert type="error" message={error} />

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || filledCount === 0}>
              <ClipboardList size={15} />
              {saving ? 'Registering…' : `Register Group (${filledCount} sample${filledCount !== 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}