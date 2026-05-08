import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Badge, Modal, Field, Alert, Empty, Table } from '../components/shared/UI';
import { CheckCircle, XCircle, FlaskConical, RotateCcw } from 'lucide-react';

export default function ReviewTestsPage() {
  const [tests,   setTests]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);  // { test, action } action: 'approve'|'reject'|'revoke'
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [filter,  setFilter]  = useState('submitted');

  const load = async () => {
    setLoading(true);
    try { const data = await api.getTests(); setTests(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openReview = (test, action) => { setReason(''); setError(''); setModal({ test, action }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (modal.action === 'revoke') {
        await api.revokeApproval(modal.test.id, reason);
      } else {
        await api.reviewTest(modal.test.id, {
          action: modal.action,
          rejection_reason: modal.action === 'reject' ? reason : undefined,
        });
      }
      setModal(null);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const filtered = tests.filter(t => filter === 'all' || t.status === filter);

  const modalTitle = modal?.action === 'approve' ? 'Approve Test Result'
                   : modal?.action === 'reject'  ? 'Reject Test Result'
                   :                               'Revoke Approval';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Tests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Approve, reject, or revoke approval on test results.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-100">
        {['submitted','all','pending','approved','rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              filter === s ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {s}
            <span className="ml-1 text-xs text-gray-400">({tests.filter(t => s==='all'||t.status===s).length})</span>
          </button>
        ))}
      </div>

      <Table headers={['Test', 'Sample', 'Group', 'Client', 'Chemist', 'Result', 'Status', 'Actions']} loading={loading}>
        {filtered.length === 0 && !loading
          ? <tr><td colSpan={8}><Empty message="No tests here." icon={FlaskConical} /></td></tr>
          : filtered.map(t => (
            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3"><p className="font-medium text-gray-800 text-sm">{t.test_name}</p><p className="text-xs text-gray-400">{t.test_unit}</p></td>
              <td className="px-4 py-3 font-mono text-sm text-gray-600">{t.sample_ref_id}</td>
              <td className="px-4 py-3 font-mono text-sm text-gray-500">{t.group_ref_id}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{t.client_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{t.chemist_name || '—'}</td>
              <td className="px-4 py-3">
                {t.result_value
                  ? <span className="font-mono text-sm font-semibold text-gray-800">{t.result_value} <span className="text-gray-400 font-normal text-xs">{t.test_unit}</span></span>
                  : <span className="text-gray-300 text-xs">—</span>}
              </td>
              <td className="px-4 py-3"><Badge status={t.status} /></td>
              <td className="px-4 py-3">
                {t.status === 'submitted' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openReview(t, 'approve')} className="inline-flex items-center gap-1 text-xs btn-success py-1 px-2">
                      <CheckCircle size={11} /> Approve
                    </button>
                    <button onClick={() => openReview(t, 'reject')} className="inline-flex items-center gap-1 text-xs btn-danger py-1 px-2">
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                )}
                {t.status === 'approved' && (
                  <button onClick={() => openReview(t, 'revoke')}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors">
                    <RotateCcw size={11} /> Revoke
                  </button>
                )}
                {!['submitted','approved'].includes(t.status) && (
                  <span className="text-xs text-gray-400 italic">—</span>
                )}
              </td>
            </tr>
          ))}
      </Table>

      {/* Review / Revoke Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modalTitle} size="sm">
        {modal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 font-semibold uppercase">Test</span>
                <span className="text-sm font-semibold text-gray-800">{modal.test.test_name}</span>
              </div>
              {modal.test.result_value && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Result</span>
                  <span className="font-mono text-sm text-gray-800">{modal.test.result_value} {modal.test.test_unit}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 font-semibold uppercase">Chemist</span>
                <span className="text-sm text-gray-600">{modal.test.chemist_name}</span>
              </div>
              {modal.test.result_notes && (
                <div>
                  <span className="text-xs text-gray-500 font-semibold uppercase block mb-1">Notes</span>
                  <p className="text-sm text-gray-600 bg-white rounded p-2 border border-gray-100">{modal.test.result_notes}</p>
                </div>
              )}
            </div>

            {modal.action === 'revoke' && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                Revoking approval will push this test back to <strong>Rejected</strong> status. The chemist will need to resubmit. The group completion status will also be reverted if applicable.
              </div>
            )}

            {(modal.action === 'reject' || modal.action === 'revoke') && (
              <Field label={modal.action === 'revoke' ? 'Reason for revoking approval' : 'Rejection Reason'} required>
                <textarea className="input min-h-[80px] resize-none" required value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={modal.action === 'revoke' ? 'Why is this approval being revoked?' : 'Explain what needs to be corrected…'}
                  autoFocus />
              </Field>
            )}

            <Alert type="error" message={error} />
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              {modal.action === 'approve' && <button type="submit" className="btn-success" disabled={saving}><CheckCircle size={14} /> {saving ? 'Approving…' : 'Approve'}</button>}
              {modal.action === 'reject'  && <button type="submit" className="btn-danger"   disabled={saving}><XCircle    size={14} /> {saving ? 'Rejecting…' : 'Reject'}</button>}
              {modal.action === 'revoke'  && <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors" disabled={saving}><RotateCcw size={14} /> {saving ? 'Revoking…' : 'Revoke Approval'}</button>}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
