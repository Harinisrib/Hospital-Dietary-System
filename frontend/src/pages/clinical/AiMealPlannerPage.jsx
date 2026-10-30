import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, RiskBadge, StatusBadge, AearmCard, Modal, EmptyState, Pagination } from '../../components/UI';
import MealSessionBanner from '../../components/MealSessionBanner';
import MultiMorbiditySolverModal from '../../components/MultiMorbiditySolverModal';

export default function AiMealPlannerPage() {
  const [plans, setPlans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [showSolverModal, setShowSolverModal] = useState(false);

  // Meal Sessions State: morning (breakfast), lunch, dinner
  const [activeSessionSlot, setActiveSessionSlot] = useState('lunch');
  const [showArchive, setShowArchive] = useState(false);

  // Filters & Pagination
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  // Single Patient AI Assignment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('lunch');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [aiPreview, setAiPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Details Modal
  const [detailPlan, setDetailPlan] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      const params = {};
      if (selectedTier) params.tier = selectedTier;
      if (selectedStatus) params.status = selectedStatus;
      if (activeSessionSlot && !showArchive) params.meal_slot = activeSessionSlot;
      const res = await api.get('/meal-plans/', { params });
      setPlans(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  }, [selectedTier, selectedStatus, activeSessionSlot, showArchive]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const loadPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients/');
      const list = res.data.results || res.data || [];
      setPatients(list);
      if (list.length > 0 && !selectedPatientId) {
        setSelectedPatientId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedPatientId]);

  // Load preview whenever patient or slot changes in modal
  useEffect(() => {
    if (!modalOpen || !selectedPatientId) return;
    setLoadingPreview(true);
    api.post('/meal-plans/recommend/', {
      patient_id: selectedPatientId,
      meal_slot: selectedSlot,
    })
      .then(res => setAiPreview(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingPreview(false));
  }, [modalOpen, selectedPatientId, selectedSlot]);

  // 1-Click AI Auto-Assign for all patients
  const handleAutoAssignAll = async () => {
    if (!window.confirm('Run Autonomous AI Meal Assignment for all admitted patients today? The model will analyze diagnoses and allergy profiles to select safe meals.')) {
      return;
    }
    setAutoAssigning(true);
    try {
      const res = await api.post('/meal-plans/auto_assign_all/', {
        planned_date: new Date().toISOString().split('T')[0],
        slots: ['breakfast', 'lunch', 'dinner'],
      });
      // Show medium/high breakdown from new response shape (FIX 1.3)
      const flaggedBreakdown = [
        res.data.flagged_medium_risk ? `${res.data.flagged_medium_risk} medium` : null,
        res.data.flagged_high_risk ? `${res.data.flagged_high_risk} high` : null,
      ].filter(Boolean).join(', ');
      const flaggedLabel = flaggedBreakdown
        ? `${res.data.flagged_for_audit} flagged (${flaggedBreakdown})`
        : `${res.data.flagged_for_audit} flagged for audit`;
      toast.success(
        `AI Plan Generated: ${res.data.total_assigned} meals assigned! (${res.data.auto_approved} safe auto-approved, ${flaggedLabel})`,
        { duration: 5000 }
      );
      fetchPlans();
    } catch (err) {
      console.error(err);
      toast.error('Failed to execute AI batch meal planning');
    } finally {
      setAutoAssigning(false);
    }
  };

  // 1-Click AI Auto-Assign for a specific Session (Morning, Lunch, or Dinner)
  const handleAutoAssignSession = async (slot) => {
    const slotNames = { breakfast: 'Morning Breakfast', lunch: 'Afternoon Lunch', dinner: 'Evening Dinner' };
    const name = slotNames[slot] || slot;
    if (!window.confirm(`Run Autonomous AI Meal Allotment specifically for ${name} Session?`)) {
      return;
    }
    setAutoAssigning(true);
    try {
      const res = await api.post('/meal-plans/auto_assign_all/', {
        planned_date: new Date().toISOString().split('T')[0],
        slots: [slot],
      });
      // Show medium/high breakdown from new response shape (FIX 1.3)
      const flaggedBreakdownSession = [
        res.data.flagged_medium_risk ? `${res.data.flagged_medium_risk} medium` : null,
        res.data.flagged_high_risk ? `${res.data.flagged_high_risk} high` : null,
      ].filter(Boolean).join(', ');
      const flaggedLabelSession = flaggedBreakdownSession
        ? `${res.data.flagged_for_audit} flagged (${flaggedBreakdownSession})`
        : `${res.data.flagged_for_audit} flagged for audit`;
      toast.success(
        `AI Plan Generated for ${name}: ${res.data.total_assigned} meals allotted! (${res.data.auto_approved} safe auto-approved, ${flaggedLabelSession})`,
        { duration: 5000 }
      );
      fetchPlans();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to execute AI batch meal planning for ${name}`);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleOpenModal = () => {
    loadPatients();
    if (activeSessionSlot) {
      setSelectedSlot(activeSessionSlot);
    }
    setModalOpen(true);
  };

  const handleExecuteSingleAssignment = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/meal-plans/auto_assign_patient/', {
        patient_id: selectedPatientId,
        planned_date: plannedDate,
        meal_slot: selectedSlot,
      });
      const plan = res.data;
      if (plan.status === 'approved') {
        toast.success(`AI Auto-Assigned: ${plan.meal_name} (Verified Safe — Low Risk)`);
      } else if (plan.status === 'medium_risk') {
        toast(`AI Flagged Medium Risk: Routed to Dietitian review queue`, { icon: '⚠️' });
      } else {
        toast(`AI Flagged High Risk: Routed to Senior Reviewer audit queue`, { icon: '🚨' });
      }
      setModalOpen(false);
      fetchPlans();
      setDetailPlan(plan);
    } catch (err) {
      console.error(err);
      toast.error('Failed to auto-assign meal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRerunAearm = async (planId) => {
    try {
      const res = await api.post(`/meal-plans/${planId}/rerun_aearm/`);
      toast.success(`AEARM complete: Tier ${res.data.tier} (${(res.data.score * 100).toFixed(1)}%)`);
      fetchPlans();
      if (detailPlan?.id === planId) {
        const refreshed = await api.get(`/meal-plans/${planId}/`);
        setDetailPlan(refreshed.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to run AEARM');
    }
  };

  // Stats calculation
  const totalPlans = plans.length;
  const highRiskCount = plans.filter(p => p.decision_trace?.risk_tier === 'High').length;
  const medRiskCount = plans.filter(p => p.decision_trace?.risk_tier === 'Medium').length;
  const lowRiskCount = plans.filter(p => p.decision_trace?.risk_tier === 'Low').length;

  const filteredPlans = plans.filter(p => {
    if (selectedWard && p.patient_ward !== selectedWard) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.patient_name?.toLowerCase().includes(term) ||
      p.meal_name?.toLowerCase().includes(term) ||
      p.patient_ward?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredPlans.length / pageSize) || 1;
  const paginatedPlans = filteredPlans.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleTierChange = (e) => {
    setSelectedTier(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
    setPage(1);
  };

  const handleWardChange = (e) => {
    setSelectedWard(e.target.value);
    setPage(1);
  };

  return (
    <div className="meal-plans-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2>Autonomous AI Meal Planning &amp; Safety Engine</h2>
            <span style={{ fontSize: 11, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '3px 10px', borderRadius: 12, fontWeight: 800 }}>
              AEARM Auto-Planner
            </span>
          </div>
          <p>
            AI model automatically selects and assigns safe therapeutic meals matching patient diagnoses and allergy profiles.
            Flagged high-risk meals are escalated to the Senior Reviewer Audit Queue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => setShowSolverModal(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)',
              border: '1.5px solid #818cf8',
              color: '#4338ca',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>⚡</span> Multi-Morbidity Solver (Viva)
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAutoAssignAll}
            disabled={autoAssigning}
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            {autoAssigning ? '🤖 AI Planning All Wards...' : '🤖 1-Click AI Auto-Assign All Patients'}
          </button>
          <button className="btn btn-secondary" onClick={handleOpenModal}>
            + AI Assign Single Patient
          </button>
        </div>
      </div>
 
      {/* Session Allotment & Live Timing Control */}
      <MealSessionBanner
        activeSlot={activeSessionSlot}
        onSlotChange={(slot) => {
          setActiveSessionSlot(slot);
          setSelectedSlot(slot || 'lunch');
          setPage(1);
        }}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(p => !p)}
        onAutoAllotCurrentSession={handleAutoAssignSession}
        autoAssigning={autoAssigning}
      />

      <div className="stats-grid">
        <div className="stat-card brand">
          <div className="stat-label">Total AI Meal Plans</div>
          <div className="stat-value">{totalPlans}</div>
          <div className="stat-sub">Assigned across wards</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Auto-Approved Safe</div>
          <div className="stat-value">{lowRiskCount}</div>
          <div className="stat-sub">Direct to kitchen queue</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Flagged for Audit</div>
          <div className="stat-value">{highRiskCount}</div>
          <div className="stat-sub">Requires senior reviewer override</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Cautionary (Medium)</div>
          <div className="stat-value">{medRiskCount}</div>
          <div className="stat-sub">Nutritional monitoring required</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search patient, meal, ward..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div style={{ width: 140 }}>
            <select
              className="form-control"
              value={selectedWard}
              onChange={handleWardChange}
            >
              <option value="">All Wards</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(w => (
                <option key={w} value={w}>Ward {w}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 150 }}>
            <select
              className="form-control"
              value={selectedTier}
              onChange={handleTierChange}
            >
              <option value="">All Risk Tiers</option>
              <option value="Low">Low Risk (Safe)</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk (Flagged)</option>
            </select>
          </div>
          <div style={{ width: 150 }}>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={handleStatusChange}
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="medium_risk">Medium Risk</option>
              <option value="high_risk">High Risk (Flagged)</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <Loading text="Loading autonomous meal plans..." />
      ) : filteredPlans.length === 0 ? (
        <EmptyState
          icon={activeSessionSlot === 'breakfast' ? '🌅' : activeSessionSlot === 'dinner' ? '🌙' : '☀️'}
          title={`No plans active for ${activeSessionSlot ? activeSessionSlot.toUpperCase() : 'selected'} session`}
          desc={
            activeSessionSlot
              ? `The previous session has been cleared and archived. Click '1-Click Allot for ${
                  activeSessionSlot === 'breakfast' ? 'Morning' : activeSessionSlot === 'dinner' ? 'Dinner' : 'Lunch'
                }' to prepare meals for this session.`
              : "Click '1-Click AI Auto-Assign' to automatically select meals across all patients."
          }
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {paginatedPlans.map(plan => (
              <div key={plan.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{plan.patient_name}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Ward {plan.patient_ward || 'N/A'} · Bed {plan.patient_bed || 'N/A'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <StatusBadge status={plan.status} />
                      {plan.decision_trace && <RiskBadge tier={plan.decision_trace.risk_tier} />}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                        AI Assigned Meal ({plan.meal_slot})
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>
                        ⚡ AI Model Selected
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {plan.meal_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Date: {plan.planned_date}
                    </div>
                  </div>

                  {plan.decision_trace && (
                    <AearmCard trace={plan.decision_trace} />
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setDetailPlan(plan)}
                  >
                    Inspect Decision
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRerunAearm(plan.id)}
                    title="Re-run AEARM"
                  >
                    🔄 Re-Score
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filteredPlans.length}
            pageSize={pageSize}
          />
        </>
      )}

      {/* AI Single Patient Assignment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="🤖 AI Meal Assignment for Patient"
        footer={(
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleExecuteSingleAssignment} disabled={submitting}>
              {submitting ? 'AI Evaluating...' : '🤖 Assign AI Selected Meal'}
            </button>
          </div>
        )}
      >
        <form onSubmit={handleExecuteSingleAssignment}>
          <div className="form-group">
            <label className="form-label">Select Patient *</label>
            <select
              className="form-control"
              value={selectedPatientId}
              onChange={e => setSelectedPatientId(e.target.value)}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Ward {p.ward} · Bed {p.bed_no}) — Diet: {p.diet_type} ({p.allergy_count || 0} allergies)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Meal Slot</label>
              <select
                className="form-control"
                value={selectedSlot}
                onChange={e => setSelectedSlot(e.target.value)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={plannedDate}
                onChange={e => setPlannedDate(e.target.value)}
              />
            </div>
          </div>

          {/* AI Recommendation Preview Box */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-400)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span>✨</span> AEARM Autonomous Recommendation Engine Preview
            </div>

            {loadingPreview ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzing patient allergies and therapeutic diet...</div>
            ) : aiPreview?.optimal ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {aiPreview.optimal.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <RiskBadge tier={aiPreview.optimal.tier} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Score: {(aiPreview.optimal.score * 100).toFixed(1)}%
                  </span>
                  {aiPreview.optimal.has_diet_match && (
                    <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: 4 }}>
                      ✓ Therapeutic Diet Match
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {aiPreview.optimal.explanation}
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Select a patient to see the AI's top recommended safe meal.
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Decision Inspection Modal */}
      {detailPlan && (
        <Modal
          open={!!detailPlan}
          onClose={() => setDetailPlan(null)}
          title={`AI Decision Inspection: ${detailPlan.patient_name}`}
          footer={(
            <button className="btn btn-secondary" onClick={() => setDetailPlan(null)}>
              Close
            </button>
          )}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{detailPlan.meal_name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Ward {detailPlan.patient_ward || 'N/A'} · Bed {detailPlan.patient_bed || 'N/A'} · {detailPlan.meal_slot} on {detailPlan.planned_date}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <StatusBadge status={detailPlan.status} />
                {detailPlan.decision_trace && <RiskBadge tier={detailPlan.decision_trace.risk_tier} />}
              </div>
            </div>

            {detailPlan.decision_trace && (
              <AearmCard trace={detailPlan.decision_trace} />
            )}

            <div style={{ marginTop: 16, background: 'var(--bg-elevated)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Autonomous Workflow Routing:</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {detailPlan.status === 'approved'
                  ? '✓ Verified Safe by AEARM model. Meal was auto-approved and dispatched to the Kitchen Order Queue with an automated QR label.'
                  : '⚠ High Risk Flagged! Meal is held in the Senior Reviewer Audit Queue for medical evaluation and override.'}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Multi-Morbidity Dietary Constraint Solver & Conflict Engine Modal for Dietitian */}
      <MultiMorbiditySolverModal
        open={showSolverModal}
        onClose={() => setShowSolverModal(false)}
      />
    </div>
  );
}
