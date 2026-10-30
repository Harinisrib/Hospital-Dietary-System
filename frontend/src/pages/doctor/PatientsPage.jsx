import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, StatusBadge, Modal, EmptyState, Pagination } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

const DIET_TYPES = ['regular','diabetic','low-sodium','renal','soft','liquid','high-protein','vegetarian','vegan'];
const GENDERS = [['M','Male'],['F','Female'],['O','Other']];

const DIAGNOSIS_DIET_MAP = {
  'type 2 diabetes':         'diabetic',
  'type 1 diabetes':         'diabetic',
  'diabetes':                'diabetic',
  'hypertension':            'low-sodium',
  'heart failure':           'low-sodium',
  'chronic kidney disease':  'renal',
  'renal failure':           'renal',
  'celiac disease':          'regular',
  'pancreatitis':            'liquid',
  'post-operative':          'soft',
  'stroke':                  'soft',
  'anemia':                  'high-protein',
  'protein deficiency':      'high-protein',
};

function suggestDiet(diagnosis) {
  const lower = (diagnosis || '').toLowerCase();
  for (const [key, val] of Object.entries(DIAGNOSIS_DIET_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'regular';
}

function getNutrientStyle(val) {
  switch (val?.toLowerCase()) {
    case 'restricted':
      return {
        bg: '#fef2f2',
        color: '#dc2626',
        border: '#f87171',
        label: 'RESTRICTED',
        badgeIcon: '🛑',
        subtext: 'Strict Ceiling Limit',
      };
    case 'low':
      return {
        bg: '#fffbeb',
        color: '#d97706',
        border: '#fde68a',
        label: 'LOW',
        badgeIcon: '⚠️',
        subtext: 'Controlled Reduction',
      };
    case 'high':
      return {
        bg: '#f5f3ff',
        color: '#7c3aed',
        border: '#c4b5fd',
        label: 'HIGH',
        badgeIcon: '⚡',
        subtext: 'Therapeutic Surplus',
      };
    case 'normal':
    default:
      return {
        bg: '#f0fdf4',
        color: '#059669',
        border: '#a7f3d0',
        label: 'NORMAL',
        badgeIcon: '✓',
        subtext: 'Standard Baseline',
      };
  }
}

const NUTRIENT_META = {
  sodium: { name: 'Sodium', icon: '🧂', unit: 'Na+' },
  sugar: { name: 'Sugar', icon: '🍬', unit: 'Carb' },
  protein: { name: 'Protein', icon: '🥩', unit: 'Protein' },
  potassium: { name: 'Potassium', icon: '🍌', unit: 'K+' },
  fluid: { name: 'Fluid', icon: '💧', unit: 'Hydration' },
};

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:'',age:'',gender:'M',ward:'',bed_no:'',diagnosis:'',diet_type:'regular',notes:'' });
  const [saving, setSaving] = useState(false);

  // Constraint Engine States
  const [patientConstraints, setPatientConstraints] = useState(null);
  const [loadingConstraints, setLoadingConstraints] = useState(false);
  const [showConstraintModal, setShowConstraintModal] = useState(false);

  // Patient Change Requests States (from Patient Portal)
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'requests'
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [reqFilter, setReqFilter] = useState('all');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [doctorResponseText, setDoctorResponseText] = useState('');
  const [reviewAction, setReviewAction] = useState('approved');
  const [newDietToApply, setNewDietToApply] = useState('regular');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await api.get('/patient-requests/');
      setRequests(data.results || data || []);
    } catch {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openReviewModal = (req) => {
    setSelectedReq(req);
    setDoctorResponseText('');
    setReviewAction('approved');
    setNewDietToApply(req.current_diet_type || 'regular');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setSubmittingReview(true);
    try {
      await api.post(`/patient-requests/${selectedReq.id}/doctor_review/`, {
        status: reviewAction,
        doctor_response: doctorResponseText,
        apply_diet_type: reviewAction === 'approved' && selectedReq.category === 'diet_preference' ? newDietToApply : undefined,
      });
      toast.success(`Request marked as ${reviewAction.toUpperCase()}!`);
      setReviewModalOpen(false);
      fetchRequests();
      fetch();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleViewConstraints = async (patient) => {
    setLoadingConstraints(true);
    setShowConstraintModal(true);
    try {
      const { data } = await api.get(`/patients/${patient.id}/diet_constraints/`);
      setPatientConstraints(data);
    } catch {
      toast.error('Failed to analyze patient constraints');
      setShowConstraintModal(false);
    } finally {
      setLoadingConstraints(false);
    }
  };

  const fetch = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (wardFilter) params.ward = wardFilter;
      const { data } = await api.get('/patients/', { params });
      setPatients(data.results || data);
    } catch { toast.error('Failed to load patients'); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    setPage(1);
    fetch(); 
  }, [search, wardFilter]);

  const openNew = () => {
    setEditingId(null);
    setForm({ name:'',age:'',gender:'M',ward:'',bed_no:'',diagnosis:'',diet_type:'regular',notes:'' });
    setShowModal(true);
  };

  const openEdit = p => {
    setEditingId(p.id);
    setForm({ name:p.name,age:p.age||'',gender:p.gender||'M',ward:p.ward,bed_no:p.bed_no,diagnosis:p.diagnosis,diet_type:p.diet_type,notes:p.notes||'' });
    setShowModal(true);
  };

  const handleDiagnosisChange = val => {
    setForm(f => ({ ...f, diagnosis: val, diet_type: suggestDiet(val) }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.ward || !form.bed_no || !form.diagnosis) {
      toast.error('Fill in Name, Ward, Bed, Diagnosis'); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      age: form.age === '' || form.age === null ? null : parseInt(form.age, 10),
    };
    try {
      if (editingId) {
        await api.patch(`/patients/${editingId}/`, payload);
        toast.success('Patient updated');
      } else {
        await api.post('/patients/', payload);
        toast.success('Patient created');
      }
      setShowModal(false);
      fetch();
    } catch (e) {
      const errText = e.response?.data?.detail ||
        Object.entries(e.response?.data || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ') ||
        'Save failed';
      toast.error(errText);
    } finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Patient Management</h2>
        <p>Module 4.1 — Doctor registers patients and sets diet type based on diagnosis</p>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          className={`btn btn-sm ${activeTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('directory')}
        >
          👤 Patient Directory ({patients.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            position: 'relative',
            background: activeTab === 'requests' ? 'var(--gradient-brand)' : undefined,
          }}
          onClick={() => { setActiveTab('requests'); fetchRequests(); }}
        >
          🔔 Patient Change Requests
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span style={{
              marginLeft: 8,
              background: '#ef4444',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {requests.filter(r => r.status === 'pending').length} Pending
            </span>
          )}
        </button>
      </div>

      {activeTab === 'directory' ? (
        <>
          <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: '1 1 200px' }}>
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Search patients or diagnosis..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ width: 180 }}>
              <select
                className="form-control"
                value={wardFilter}
                onChange={e => setWardFilter(e.target.value)}
              >
                <option value="">All Wards ({patients.length})</option>
                {['A','B','C','D','E','F','G','H'].map(w => (
                  <option key={w} value={w}>Ward {w}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={openNew}>+ New Patient</button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Ward/Bed</th><th>Diagnosis</th>
                  <th>Diet Type</th><th>Allergies</th><th>Admitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 && (
                  <tr><td colSpan={7}><EmptyState title="No patients found" /></td></tr>
                )}
                {patients.slice((page - 1) * pageSize, page * pageSize).map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>Ward {p.ward} · Bed {p.bed_no}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.diagnosis}</td>
                    <td><span className="status-badge status-approved">{p.diet_type}</span></td>
                    <td><span className="status-badge status-pending">{p.allergy_count} known</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.admitted_on}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleViewConstraints(p)}
                          title="Analyze clinical nutrient constraints"
                          style={{ borderColor: '#3b82f6', color: '#60a5fa', fontSize: 11, padding: '4px 8px' }}
                        >
                          🔬 Constraints
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={Math.ceil(patients.length / pageSize) || 1}
            onPageChange={setPage}
            totalItems={patients.length}
            pageSize={pageSize}
          />
        </>
      ) : (
        /* Patient Requests Tab */
        <div>
          {/* Request Status Filter Strip */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter:</span>
            {[
              { id: 'all', label: `All Requests (${requests.length})` },
              { id: 'pending', label: `⏳ Pending (${requests.filter(r => r.status === 'pending').length})` },
              { id: 'approved', label: `✓ Approved (${requests.filter(r => r.status === 'approved').length})` },
              { id: 'rejected', label: `✕ Declined (${requests.filter(r => r.status === 'rejected').length})` },
              { id: 'resolved', label: `📋 Resolved (${requests.filter(r => r.status === 'resolved').length})` },
            ].map(f => (
              <button
                key={f.id}
                className={`btn btn-sm ${reqFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => setReqFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <Loading text="Loading patient requests..." />
          ) : requests.length === 0 ? (
            <EmptyState
              icon="📬"
              title="No Patient Requests"
              desc="Patients have not submitted any detail modification requests yet."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {requests
                .filter(r => reqFilter === 'all' || r.status === reqFilter)
                .map(req => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';

                  const categoryLabel = {
                    diet_preference: '🥗 Diet Preference / Need',
                    new_allergy: '⚠️ New Allergy / Food Reaction',
                    symptom_condition: '🏥 Health Condition / Symptoms',
                    personal_info: '🛏️ Personal Info / Ward / Bed',
                    other: '📝 Other Clinical Request',
                  }[req.category] || req.category;

                  return (
                    <div
                      key={req.id}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        borderLeft: isPending ? '4px solid #f59e0b' : isApproved ? '4px solid #10b981' : isRejected ? '4px solid #ef4444' : '4px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                              {req.patient_name}
                            </h3>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Ward {req.patient_ward} · Bed {req.patient_bed}
                            </span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--brand-400)' }}>
                              Current Diet: {req.current_diet_type}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Category: <strong style={{ color: 'var(--text-primary)' }}>{categoryLabel}</strong> · Submitted: {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '3px 10px',
                              borderRadius: 12,
                              background: isPending ? 'rgba(245, 158, 11, 0.15)' : isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444',
                              border: `1px solid ${isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444'}`,
                            }}
                          >
                            {req.status}
                          </span>

                          <button
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: 12 }}
                            onClick={() => openReviewModal(req)}
                          >
                            🩺 {isPending ? 'Review & Action' : 'Update Review'}
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>
                          Patient's Requested Changes:
                        </div>
                        "{req.requested_changes}"
                      </div>

                      {req.doctor_response && (
                        <div style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 6, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: 'var(--info)' }}>Doctor's Response: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{req.doctor_response}</span>
                          {req.reviewed_by_name && (
                            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                              (by Dr. {req.reviewed_by_name})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Doctor Review & Action Modal for Patient Request */}
      {reviewModalOpen && selectedReq && (
        <Modal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={`🩺 Clinical Review: Request from ${selectedReq.patient_name}`}
          footer={(
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReviewModalOpen(false)}
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="doctor-review-form"
                className="btn btn-primary"
                disabled={submittingReview}
              >
                {submittingReview ? 'Updating...' : 'Save Decision & Notify Patient'}
              </button>
            </div>
          )}
        >
          <form id="doctor-review-form" onSubmit={handleReviewSubmit}>
            <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Patient: <strong style={{ color: '#fff' }}>{selectedReq.patient_name}</strong> · Ward {selectedReq.patient_ward}, Bed {selectedReq.patient_bed}
              </div>
              <div style={{ fontSize: 12, color: 'var(--brand-400)', marginTop: 2 }}>
                Current Prescribed Diet: <strong style={{ textTransform: 'capitalize' }}>{selectedReq.current_diet_type}</strong>
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' }}>
                <strong>Requested:</strong> "{selectedReq.requested_changes}"
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Doctor Decision / Action *</label>
              <select
                className="form-control"
                value={reviewAction}
                onChange={e => setReviewAction(e.target.value)}
              >
                <option value="approved">✓ Approve Request & Apply Updates</option>
                <option value="resolved">📋 Review & Mark as Resolved (No diet change needed)</option>
                <option value="rejected">✕ Decline Request (Clinically Contraindicated)</option>
              </select>
            </div>

            {/* If approved and category is diet_preference, allow changing diet directly */}
            {reviewAction === 'approved' && selectedReq.category === 'diet_preference' && (
              <div className="form-group" style={{ marginBottom: 14, background: 'rgba(16, 185, 129, 0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--success)' }}>
                  Update Patient's Prescribed Diet Type to:
                </label>
                <select
                  className="form-control"
                  value={newDietToApply}
                  onChange={e => setNewDietToApply(e.target.value)}
                >
                  {DIET_TYPES.map(d => (
                    <option key={d} value={d}>{d.toUpperCase()} diet</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Selecting this will immediately update the patient's admission profile and adjust their future meal plans.
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Doctor's Response / Instructions to Patient</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Explain the clinical decision or reassurance for the patient (e.g. 'Approved. Switched to diabetic diet', or 'Consulted with nurse to adjust medication timing')..."
                value={doctorResponseText}
                onChange={e => setDoctorResponseText(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Patient' : 'New Patient'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Patient'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Patient name" />
          </div>
          <div className="form-group">
            <label className="form-label">Age</label>
            <input type="number" className="form-control" value={form.age} onChange={e => setForm(f=>({...f,age:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select className="form-control" value={form.gender} onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
              {GENDERS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ward *</label>
            <input className="form-control" value={form.ward} onChange={e => setForm(f=>({...f,ward:e.target.value}))} placeholder="e.g. A" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Bed No *</label>
          <input className="form-control" value={form.bed_no} onChange={e => setForm(f=>({...f,bed_no:e.target.value}))} placeholder="e.g. 101" />
        </div>
        <div className="form-group">
          <label className="form-label">Diagnosis * <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:11}}>(auto-suggests diet type)</span></label>
          <textarea className="form-control" rows={2} value={form.diagnosis} onChange={e => handleDiagnosisChange(e.target.value)} placeholder="Primary diagnosis..." />
        </div>
        <div className="form-group">
          <label className="form-label">Diet Type (auto-filled / override)</label>
          <select className="form-control" value={form.diet_type} onChange={e => setForm(f=>({...f,diet_type:e.target.value}))}>
            {DIET_TYPES.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Clinical Notes</label>
          <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
        </div>
      </Modal>

      {/* Patient Specific Constraint Modal */}
      <Modal
        open={showConstraintModal}
        onClose={() => setShowConstraintModal(false)}
        maxWidth="800px"
        title={patientConstraints ? `📋 Clinical Nutrient Constraints — ${patientConstraints.patient_name}` : 'Nutrient Constraints'}
        footer={<button className="btn btn-secondary" onClick={() => setShowConstraintModal(false)}>Close</button>}
      >
        {loadingConstraints ? (
          <Loading text="Analyzing multi-morbidity nutrient constraints..." />
        ) : patientConstraints ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Diagnosis Banner */}
            <div style={{
              padding: '14px 18px',
              background: '#f8fafc',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', fontWeight: 700 }}>
                  🩺 Documented Clinical Diagnoses
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4, color: '#0f172a' }}>
                  {patientConstraints.diagnosis}
                </div>
              </div>
              <div style={{
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 20,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontWeight: 700,
              }}>
                Step 1 &amp; 2 Synthesis
              </div>
            </div>

            {/* Resolved Nutrients Grid */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎯</span> Resolved Nutrient Targets
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {Object.entries(patientConstraints.constraints || {}).map(([nutr, val]) => {
                  const style = getNutrientStyle(val);
                  const meta = NUTRIENT_META[nutr.toLowerCase()] || { name: nutr, icon: '🧪', unit: '' };
                  return (
                    <div
                      key={nutr}
                      style={{
                        padding: '14px 12px',
                        background: style.bg,
                        border: `1.5px solid ${style.border}`,
                        borderRadius: 10,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: val === 'restricted' ? '0 0 14px rgba(239, 68, 68, 0.2)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{meta.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        {meta.name}
                      </div>
                      <div style={{
                        marginTop: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#ffffff',
                        color: style.color,
                        border: `1px solid ${style.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span>{style.badgeIcon}</span> {style.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                        {style.subtext}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reasoning Trace */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📜</span> Clinical Decision Trace & Conflict Logs
              </div>
              {patientConstraints.explanation_log?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {patientConstraints.explanation_log.map((log, idx) => {
                    const isConflict = log.includes('CONFLICT');
                    const isUnresolved = log.includes('UNRESOLVED');
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          background: isUnresolved ? 'rgba(239, 68, 68, 0.12)' : isConflict ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                          borderLeft: `3px solid ${isUnresolved ? '#ef4444' : isConflict ? '#f59e0b' : '#3b82f6'}`,
                          borderRadius: 6,
                          fontSize: 12,
                          lineHeight: 1.5,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{isUnresolved ? '⚠️' : isConflict ? '⚡' : '✅'}</span>
                        <div style={{ flex: 1 }}>{log}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No active nutrient restrictions for this diagnosis. Standard baseline ('NORMAL') applied.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
