import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, RiskBadge, StatusBadge, AearmCard, Modal, EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

export default function SignOffPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'history'
  const [riskFilter, setRiskFilter] = useState('all'); // 'all' | 'Medium' | 'High'
  const [search, setSearch] = useState('');

  // Action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [decision, setDecision] = useState('approve'); // 'approve' | 'reject'
  const [overrideReason, setOverrideReason] = useState('');
  const [outcome, setOutcome] = useState('safe');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get('/meal-plans/signoff_queue/');
      setQueue(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sign-off queue');
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/sign-offs/my_history/');
      setHistory(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchQueue(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchQueue, fetchHistory]);

  const openDecisionModal = (plan, dec) => {
    setSelectedPlan(plan);
    setDecision(dec);
    setOverrideReason('');
    setOutcome('safe');
    setActionModalOpen(true);
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    const isHigh = selectedPlan?.decision_trace?.risk_tier === 'High';

    if (decision === 'approve' && isHigh && !overrideReason.trim()) {
      toast.error('Mandatory written clinical justification is required for High-Risk approvals');
      return;
    }
    if (decision === 'reject' && !overrideReason.trim()) {
      toast.error('Please specify a clinical reason for rejecting this meal');
      return;
    }

    setSubmitting(true);
    const outcomeVal = decision === 'approve'
      ? (outcome === 'safe' ? 1 : outcome === 'reaction' ? 0 : null)
      : null;

    try {
      await api.post('/sign-offs/', {
        meal_plan: selectedPlan.id,
        decision,
        outcome: outcomeVal,
        override_reason: overrideReason.trim() || (decision === 'approve' ? 'Dietitian verified allergen safety' : 'Rejected for allergen risk'),
      });
      toast.success(
        decision === 'approve'
          ? 'Meal plan approved! Order queued for kitchen preparation.'
          : 'Meal plan rejected.'
      );
      setActionModalOpen(false);
      fetchQueue();
      fetchHistory();
    } catch (err) {
      console.error(err);
      const errText = err.response?.data?.detail ||
        Object.entries(err.response?.data || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ') ||
        'Failed to submit clinical decision';
      toast.error(errText);
    } finally {
      setSubmitting(false);
    }
  };

  // Queue counts (only Medium and High risk belong here)
  const highCount = useMemo(() => queue.filter(p => p.decision_trace?.risk_tier === 'High').length, [queue]);
  const mediumCount = useMemo(() => queue.filter(p => p.decision_trace?.risk_tier === 'Medium').length, [queue]);

  const filteredQueue = useMemo(() => {
    return queue.filter(plan => {
      const tier = plan.decision_trace?.risk_tier;
      if (riskFilter !== 'all' && tier !== riskFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        plan.patient_name?.toLowerCase().includes(term) ||
        plan.meal_name?.toLowerCase().includes(term) ||
        plan.patient_ward?.toLowerCase().includes(term) ||
        String(plan.id).includes(term)
      );
    });
  }, [queue, riskFilter, search]);

  return (
    <div className="signoff-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Clinical Sign-Off Queue (High-Risk Approvals Only)</h2>
          <p>
            Authorized Dietitian review queue. Low and Medium risk meals are automatically approved directly to the kitchen; <strong>ONLY High-Risk</strong> allergen conflicts require clinical approval.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('queue')}
          >
            Pending High-Risk Approvals ({queue.length})
          </button>
          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            Sign-Off Audit History ({history.length})
          </button>
        </div>
      </div>

      {/* Policy Callout Banner */}
      <div style={{
        padding: '14px 20px',
        background: '#fff5f5',
        border: '1px solid #fecaca',
        borderLeft: '4px solid #ef4444',
        borderRadius: 12,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#991b1b' }}>
              Clinical Sign-Off Policy &amp; Scope (High-Risk Allergen Protection)
            </div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2, lineHeight: 1.4 }}>
              <strong>ONLY High Risk</strong> (&ge;0.70 direct allergen conflicts) enter this approval queue. <strong>Low &amp; Medium Risk</strong> meals (&lt;0.70) are auto-approved directly to the kitchen.
            </div>
          </div>
        </div>
        <div>
          <span style={{
            fontSize: 11,
            padding: '5px 12px',
            borderRadius: 20,
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}>
            🛑 High Risk: Direct Conflict
          </span>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading clinical sign-off queue..." />
      ) : activeTab === 'queue' ? (
        <>
          {/* Filters & Search Toolbar */}
          <div className="card" style={{ marginBottom: 20, padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Queue Scope:</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 12,
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                }}>
                  🛑 High Risk Allergen Conflicts ({queue.length})
                </span>
              </div>

              {/* Search Box */}
              <div style={{ flex: '1 1 240px', maxWidth: 360 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search patient, meal, ward..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Queue List */}
          {filteredQueue.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="All Clear! No Flagged Meals"
              desc={
                search || riskFilter !== 'all'
                  ? 'No meal plans match your selected filter.'
                  : 'No meal plans currently require clinical approval. Low-risk plans are automatically assigned to the kitchen.'
              }
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
              {filteredQueue.map(plan => {
                const trace = plan.decision_trace;
                const isHigh = trace?.risk_tier === 'High';

                return (
                  <div
                    key={plan.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderLeft: isHigh ? '4px solid var(--risk-high)' : '4px solid var(--risk-medium)',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Patient & Risk Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Plan #{plan.id}
                          </span>
                          <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{plan.patient_name}</h3>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Ward {plan.patient_ward || 'N/A'} · Bed {plan.patient_bed || 'N/A'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <RiskBadge tier={trace?.risk_tier} />
                          <StatusBadge status={plan.status} />
                        </div>
                      </div>

                      {/* Meal Details Box */}
                      <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>Proposed Therapeutic Meal</span>
                          <span style={{ textTransform: 'capitalize' }}>{plan.meal_slot} · {plan.planned_date}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                          {plan.meal_name}
                        </div>
                      </div>

                      {/* AEARM Decision Trace Card */}
                      {trace && <AearmCard trace={trace} />}

                      {/* Clinical Guidance Notice */}
                      {isHigh ? (
                        <div style={{
                          marginTop: 12,
                          padding: '10px 14px',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 12,
                          color: '#991b1b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}>
                          <span style={{ fontSize: 16 }}>🛑</span>
                          <div>
                            <strong>High Risk direct allergen conflict.</strong> Mandatory written clinical justification required for sign-off.
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          marginTop: 12,
                          padding: '10px 14px',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 12,
                          color: '#92400e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}>
                          <span style={{ fontSize: 16 }}>⚠️</span>
                          <div>
                            <strong>Medium Risk cross-reactivity.</strong> Dietitian authorization required before kitchen preparation.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <button
                        className="btn btn-success"
                        style={{ flex: 1, justifyContent: 'center', fontWeight: 700 }}
                        onClick={() => openDecisionModal(plan, 'approve')}
                      >
                        ✓ Approve Plan
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => openDecisionModal(plan, 'reject')}
                      >
                        ✕ Reject Meal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sign-Off & Clinical Authorization Audit Trail</h3>
          {history.length === 0 ? (
            <EmptyState icon="📜" title="No history found" desc="You have not signed off on any meal plans yet." />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Sign-Off ID</th>
                    <th>Plan #</th>
                    <th>Reviewer Role</th>
                    <th>Clinical Decision</th>
                    <th>Outcome Recorded</th>
                    <th>Clinical Justification</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id}>
                      <td>#{item.id}</td>
                      <td><strong>#{item.meal_plan}</strong></td>
                      <td><span style={{ textTransform: 'capitalize' }}>{item.reviewer_role?.replace('_', ' ')}</span></td>
                      <td>
                        <span className={`status-badge ${item.decision === 'approve' ? 'status-approved' : 'status-rejected'}`}>
                          {item.decision.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: item.outcome === 1 || item.outcome === 'safe' ? 'var(--risk-low-bg)' : item.outcome === 0 || item.outcome === 'reaction' ? 'var(--risk-high-bg)' : 'var(--bg-elevated)',
                          color: item.outcome === 1 || item.outcome === 'safe' ? 'var(--risk-low)' : item.outcome === 0 || item.outcome === 'reaction' ? 'var(--risk-high)' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}>
                          {item.outcome === 1 || item.outcome === 'safe' ? 'Safe (No Reaction)' : item.outcome === 0 || item.outcome === 'reaction' ? 'Adverse Reaction' : '—'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 280, color: 'var(--text-secondary)' }}>
                        {item.override_reason || '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Decision Modal */}
      <Modal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        maxWidth="580px"
        title={decision === 'approve' ? 'Clinical Sign-Off Authorization' : 'Reject Meal Plan'}
        footer={(
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setActionModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button
              className={`btn ${decision === 'approve' ? 'btn-success' : 'btn-danger'}`}
              onClick={handleDecisionSubmit}
              disabled={submitting}
              style={{ fontWeight: 700 }}
            >
              {submitting ? 'Submitting...' : decision === 'approve' ? 'Authorize & Queue to Kitchen' : 'Confirm Rejection'}
            </button>
          </div>
        )}
      >
        <form onSubmit={handleDecisionSubmit}>
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Patient: <strong style={{ color: 'var(--text-primary)' }}>{selectedPlan?.patient_name}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Meal: <strong style={{ color: 'var(--text-primary)' }}>{selectedPlan?.meal_name}</strong> ({selectedPlan?.meal_slot})
            </div>
            {selectedPlan?.decision_trace && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RiskBadge tier={selectedPlan.decision_trace.risk_tier} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Risk Score: {(selectedPlan.decision_trace.risk_score * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              {decision === 'approve'
                ? selectedPlan?.decision_trace?.risk_tier === 'High'
                  ? 'Mandatory Clinical Justification (High Risk) *'
                  : 'Clinical Verification Note (Optional / Override Reason)'
                : 'Clinical Rejection Reason *'}
            </label>
            <textarea
              className="form-control"
              rows="3"
              placeholder={
                decision === 'approve'
                  ? selectedPlan?.decision_trace?.risk_tier === 'High'
                    ? 'Enter clinical justification (e.g. Skin prick test negative, antihistamine premedication administered, recipe modified...)'
                    : 'e.g. Minor cross-reactivity reviewed and verified safe for patient profile...'
                  : 'e.g. Direct allergen present; ingredient unsuited for patient; meal plan cancelled...'
              }
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              required={selectedPlan?.decision_trace?.risk_tier === 'High' || decision === 'reject'}
            />
            {selectedPlan?.decision_trace?.risk_tier === 'High' && decision === 'approve' && (
              <span style={{ fontSize: 11, color: 'var(--risk-high)', display: 'block', marginTop: 4, fontWeight: 600 }}>
                ⚠️ High-risk approvals require documented clinical rationale in the audit trail.
              </span>
            )}
          </div>

          {decision === 'approve' && (
            <div className="form-group">
              <label className="form-label">Expected Patient Outcome (AEARM Component 3 Feedback Loop)</label>
              <select
                className="form-control"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
              >
                <option value="safe">Safe (Expected tolerance — increases ingredient confidence)</option>
                <option value="reaction">Adverse Reaction (Lowers ingredient confidence adaptively)</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                🧠 The adaptive AEARM engine updates exponential ingredient confidence scores based on this outcome.
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
