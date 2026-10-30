import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, RiskBadge, StatusBadge, AearmCard, Modal, EmptyState, Pagination } from '../../components/UI';

export default function MealPlansPage() {
  const [plans, setPlans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [meals, setMeals] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'feedbacks'

  // Filters & Pagination
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  // New Plan Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    patient: '',
    meal: '',
    planned_date: new Date().toISOString().split('T')[0],
    meal_slot: 'lunch',
  });

  // Details Modal
  const [detailPlan, setDetailPlan] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      const params = {};
      if (selectedTier) params.tier = selectedTier;
      if (selectedStatus) params.status = selectedStatus;
      const res = await api.get('/meal-plans/', { params });
      setPlans(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  }, [selectedTier, selectedStatus]);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const res = await api.get('/patient-feedback/');
      setFeedbacks(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchFeedbacks()]);
  }, [fetchPlans, fetchFeedbacks]);

  const loadRefs = useCallback(async () => {
    try {
      const [patRes, mealRes] = await Promise.all([
        api.get('/patients/'),
        api.get('/meals/'),
      ]);
      const patList = patRes.data.results || patRes.data || [];
      const mealList = mealRes.data.results || mealRes.data || [];
      setPatients(patList);
      setMeals(mealList);
      setFormData(prev => ({
        ...prev,
        patient: prev.patient || (patList[0]?.id || ''),
        meal: prev.meal || (mealList[0]?.id || ''),
      }));
    } catch (err) {
      console.error('Failed loading refs', err);
    }
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const handleOpenModal = () => {
    loadRefs();
    setModalOpen(true);
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!formData.patient || !formData.meal) {
      toast.error('Please select patient and meal');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/meal-plans/', formData);
      toast.success('Meal plan assigned! AEARM evaluated risk.');
      setModalOpen(false);
      fetchPlans();
      setDetailPlan(res.data);
    } catch (err) {
      console.error(err);
      const errText = err.response?.data?.detail ||
        Object.entries(err.response?.data || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ') ||
        'Failed to assign meal plan';
      toast.error(errText);
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

  return (
    <div className="meal-plans-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Dietitian Meal Planning & Patient Feedback</h2>
          <p>Assign meals, evaluate allergy cross-reactivity risks via AEARM, and review patient feedback</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('plans')}
          >
            📋 Meal Plans ({totalPlans})
          </button>
          <button
            className={`btn ${activeTab === 'feedbacks' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('feedbacks'); fetchFeedbacks(); }}
          >
            💬 Patient Feedback ({feedbacks.length})
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            + Assign New Meal
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <>
          <div className="stats-grid">
            <div className="stat-card brand">
              <div className="stat-label">Total Meal Plans</div>
              <div className="stat-value">{totalPlans}</div>
              <div className="stat-sub">Assigned to patients</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-label">High Risk</div>
              <div className="stat-value">{highRiskCount}</div>
              <div className="stat-sub">Requires dietitian sign-off</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-label">Medium Risk</div>
              <div className="stat-value">{medRiskCount}</div>
              <div className="stat-sub">Requires dietitian review</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">Low Risk</div>
              <div className="stat-value">{lowRiskCount}</div>
              <div className="stat-sub">Auto-approved to kitchen</div>
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
              <div style={{ width: 160 }}>
                <select
                  className="form-control"
                  value={selectedTier}
                  onChange={handleTierChange}
                >
                  <option value="">All Risk Tiers</option>
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>
              </div>
              <div style={{ width: 160 }}>
                <select
                  className="form-control"
                  value={selectedStatus}
                  onChange={handleStatusChange}
                >
                  <option value="">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="medium_risk">Medium Risk</option>
                  <option value="high_risk">High Risk</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Plans List */}
          {loading ? (
            <Loading text="Loading meal plans..." />
          ) : filteredPlans.length === 0 ? (
            <EmptyState
              icon="🍽️"
              title="No meal plans found"
              desc="Assign a new meal plan to run the AEARM allergy risk model."
            />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {paginatedPlans.map(plan => {
                  const hasFeedback = plan.feedbacks?.length > 0;
                  const latestFeedback = plan.feedbacks?.[0];

                  return (
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>Assigned Meal ({plan.meal_slot})</span>
                            <span>{plan.planned_date}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                            {plan.meal_name}
                          </div>
                        </div>

                        {plan.decision_trace && (
                          <AearmCard trace={plan.decision_trace} />
                        )}

                        {/* Patient Feedback Badge */}
                        {hasFeedback && (
                          <div style={{
                            marginTop: 10,
                            padding: '6px 10px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: 6,
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <span style={{ color: '#b45309', fontWeight: 700 }}>
                              💬 Patient Feedback: {'★'.repeat(latestFeedback.rating)}
                            </span>
                            <span style={{ color: '#78350f', fontSize: 10 }}>
                              {latestFeedback.tolerance_status?.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => setDetailPlan(plan)}
                        >
                          View Details
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRerunAearm(plan.id)}
                          title="Re-run AEARM"
                        >
                          🔄 Re-evaluate
                        </button>
                      </div>
                    </div>
                  );
                })}
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
        </>
      ) : (
        /* Patient Feedbacks Tab */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Inpatient Meal Satisfaction & Tolerance Reports</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Real-time patient feedback sent directly to clinical dietitians to monitor meal acceptance and allergy tolerance.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchFeedbacks}>
              🔄 Refresh Feedback
            </button>
          </div>

          {feedbacks.length === 0 ? (
            <EmptyState
              icon="💬"
              title="No Patient Feedbacks Yet"
              desc="When patients rate and review their daily breakfast, lunch, or dinner in the patient portal, their responses appear here."
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Ward / Bed</th>
                    <th>Meal & Session</th>
                    <th>Rating</th>
                    <th>Taste</th>
                    <th>Tolerance & Symptoms</th>
                    <th>Patient Comments</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map(fb => (
                    <tr key={fb.id}>
                      <td><strong>{fb.patient_name}</strong></td>
                      <td>Ward {fb.patient_ward || '—'} · Bed {fb.patient_bed || '—'}</td>
                      <td>
                        <div><strong>{fb.meal_name}</strong></div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {fb.meal_slot} ({fb.planned_date})
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
                          {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, textTransform: 'capitalize' }}>
                          {fb.taste_rating}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 10,
                          fontWeight: 700,
                          background: fb.tolerance_status === 'tolerated_well'
                            ? 'var(--risk-low-bg)'
                            : fb.tolerance_status === 'mild_discomfort'
                            ? 'var(--risk-medium-bg)'
                            : 'var(--risk-high-bg)',
                          color: fb.tolerance_status === 'tolerated_well'
                            ? 'var(--risk-low)'
                            : fb.tolerance_status === 'mild_discomfort'
                            ? 'var(--risk-medium)'
                            : 'var(--risk-high)',
                        }}>
                          {fb.tolerance_status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ maxWidth: 240, color: 'var(--text-secondary)' }}>
                        {fb.comments ? `"${fb.comments}"` : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(fb.submitted_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assign Plan Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign New Patient Meal Plan"
        footer={(
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreatePlan} disabled={submitting}>
              {submitting ? 'Running AEARM...' : 'Assign & Score Risk'}
            </button>
          </div>
        )}
      >
        <form onSubmit={handleCreatePlan}>
          <div className="form-group">
            <label className="form-label">Select Patient *</label>
            <select
              className="form-control"
              value={formData.patient}
              onChange={e => setFormData({ ...formData, patient: e.target.value })}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Ward: {p.ward || 'N/A'}, Diet: {p.diet_type || 'Standard'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Meal *</label>
            <select
              className="form-control"
              value={formData.meal}
              onChange={e => setFormData({ ...formData, meal: e.target.value })}
              required
            >
              <option value="">-- Choose Meal --</option>
              {meals.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.meal_type})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Meal Slot</label>
              <select
                className="form-control"
                value={formData.meal_slot}
                onChange={e => setFormData({ ...formData, meal_slot: e.target.value })}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Planned Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.planned_date}
                onChange={e => setFormData({ ...formData, planned_date: e.target.value })}
                required
              />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            💡 Submitting triggers AEARM Component 1-4 pipeline: checks direct allergen matches, cross-reactivity trees, applies ingredient confidence weighting, and computes the risk tier automatically.
          </p>
        </form>
      </Modal>

      {/* Plan Details Modal */}
      {detailPlan && (
        <Modal
          open={Boolean(detailPlan)}
          onClose={() => setDetailPlan(null)}
          title={`Meal Plan #${detailPlan.id} — ${detailPlan.patient_name}`}
          footer={(
            <button className="btn btn-secondary" onClick={() => setDetailPlan(null)}>
              Close
            </button>
          )}
        >
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Patient</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{detailPlan.patient_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Ward {detailPlan.patient_ward || 'N/A'} · Bed {detailPlan.patient_bed || 'N/A'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scheduled</div>
                <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{detailPlan.meal_slot}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{detailPlan.planned_date}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Meal Formula</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{detailPlan.meal_name}</div>
            </div>

            {detailPlan.decision_trace && (
              <AearmCard trace={detailPlan.decision_trace} />
            )}

            {detailPlan.feedbacks?.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
                  💬 Patient Feedback ({detailPlan.feedbacks[0].rating} ★)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                  Tolerance: <strong>{detailPlan.feedbacks[0].tolerance_status?.replace('_', ' ')}</strong>
                </div>
                {detailPlan.feedbacks[0].comments && (
                  <div style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4, color: 'var(--text-secondary)' }}>
                    "{detailPlan.feedbacks[0].comments}"
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
