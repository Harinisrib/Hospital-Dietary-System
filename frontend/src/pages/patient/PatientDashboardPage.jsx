import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState, Modal } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_META = {
  diet_preference: { label: 'Diet Preference / Nutritional Need', icon: '🥗', color: '#10b981' },
  new_allergy: { label: 'Allergy / Food Reaction Alert', icon: '⚠️', color: '#ef4444' },
  symptom_condition: { label: 'Health Condition / New Symptom', icon: '🏥', color: '#f59e0b' },
  personal_info: { label: 'Personal Details (Ward / Bed / Age)', icon: '🛏️', color: '#3b82f6' },
  other: { label: 'Other Clinical Request', icon: '📝', color: '#8b5cf6' },
};

const REQUEST_STATUS_META = {
  pending: { label: 'Pending Doctor Review', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '⏳' },
  approved: { label: 'Approved & Updated by Doctor', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '✓' },
  rejected: { label: 'Declined by Doctor', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '✕' },
  resolved: { label: 'Reviewed & Resolved', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: '📋' },
};

const TOLERANCE_META = {
  tolerated_well: { label: 'Tolerated Well (No Symptoms)', color: '#10b981', icon: '😊' },
  mild_discomfort: { label: 'Mild Discomfort (Fullness/Gas)', color: '#f59e0b', icon: '😐' },
  adverse_reaction: { label: 'Adverse Symptoms / Allergy Sign', color: '#ef4444', icon: '🚨' },
};

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuToday, setMenuToday] = useState([]);

  // Change Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqCategory, setReqCategory] = useState('diet_preference');
  const [reqDescription, setReqDescription] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Dietary Feedback Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackTaste, setFeedbackTaste] = useState('excellent');
  const [feedbackTolerance, setFeedbackTolerance] = useState('tolerated_well');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);

  const fetchProfile = useCallback(async () => {
    try {
      const [profRes, menuRes, fbRes] = await Promise.all([
        api.get('/patient-profile/'),
        api.get('/patient-menu/').catch(() => ({ data: [] })),
        api.get('/patient-feedback/').catch(() => ({ data: [] })),
      ]);
      setProfile(profRes.data);
      setMenuToday(menuRes.data.results || menuRes.data || []);
      setFeedbackList(fbRes.data.results || fbRes.data || []);
    } catch (err) {
      console.error('Failed to load profile', err);
      toast.error('Could not load patient admission details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Submit Change Request to Doctor
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqDescription.trim()) {
      toast.error('Please describe what you would like the doctor to change');
      return;
    }

    setSubmittingReq(true);
    try {
      await api.post('/patient-requests/', {
        patient_id: profile?.id,
        category: reqCategory,
        requested_changes: reqDescription,
      });
      toast.success('Your request has been sent directly to the Doctor Portal! 🩺');
      setRequestModalOpen(false);
      setReqDescription('');
      fetchProfile();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to submit request to doctor');
    } finally {
      setSubmittingReq(false);
    }
  };

  // Submit Dietary Feedback to Dietitian
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      // Pick first meal plan if available
      const mealPlanId = menuToday[0]?.id || null;
      await api.post('/patient-feedback/', {
        meal_plan: mealPlanId,
        rating: feedbackRating,
        taste_rating: feedbackTaste,
        tolerance_status: feedbackTolerance,
        comments: feedbackComments,
      });
      toast.success('Feedback sent directly to your clinical dietitian! 🥗');
      setFeedbackModalOpen(false);
      setFeedbackComments('');
      fetchProfile();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to send feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return <Loading text="Loading your patient admission records..." />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon="👤"
        title="No Admission Record Found"
        desc="No patient file is currently linked to your user account."
      />
    );
  }

  const changeRequests = profile.change_requests || [];
  const pendingRequestsCount = changeRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="patient-dashboard-page" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 50 }}>
      {/* Top Welcome Banner */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #4f46e5',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          padding: '24px 28px',
          borderRadius: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
              }}
            >
              👤
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {profile.name}
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  Inpatient Admitted
                </span>
              </div>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                Ward <strong style={{ color: '#0f172a' }}>{profile.ward}</strong> · Bed <strong style={{ color: '#0f172a' }}>{profile.bed_no}</strong> · Age: {profile.age || 'N/A'} · Gender: {profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : 'Other'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 16px' }}
              onClick={() => setRequestModalOpen(true)}
            >
              <span>📝</span> Request Change to Doctor
            </button>
            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 16px' }}
              onClick={() => setFeedbackModalOpen(true)}
            >
              <span>💬</span> Send Dietitian Feedback
            </button>
            <Link
              to="/patient/menu"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '9px 16px' }}
            >
              <span>🥗</span> View Today's Menu
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Admission Details (Left) + Allergies & Quick Actions (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Admission Details Card */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Admission Details (Entered by Doctor)
              </h3>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Stage 1 Clinical Record
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                Clinical Medical Diagnosis
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
                {profile.diagnosis || 'Standard Observation'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Prescribed Diet
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-400)', marginTop: 2, textTransform: 'capitalize' }}>
                  {profile.diet_type?.replace('-', ' ')}
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Admitted On
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                  {profile.admitted_on}
                </div>
              </div>
            </div>

            {profile.admitted_by_name && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Attending Doctor: <strong style={{ color: 'var(--text-primary)' }}>Dr. {profile.admitted_by_name}</strong>
              </div>
            )}

            {profile.notes && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 'var(--radius)', borderLeft: '3px solid var(--brand-500)' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                  Doctor's Admission Notes
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {profile.notes}
                </div>
              </div>
            )}

            <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Need to update diagnosis, diet, or room?</span>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: 11 }}
                  onClick={() => setRequestModalOpen(true)}
                >
                  Request Doctor Update
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Known Allergies Card */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Recorded Allergies ({profile.allergies?.length || 0})
              </h3>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              AEARM Safety Profile
            </span>
          </div>

          {(!profile.allergies || profile.allergies.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🛡️</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No Allergies on File</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
                If you have food sensitivities or adverse reactions, please alert your doctor immediately.
              </p>
              <button
                className="btn btn-sm btn-secondary"
                style={{ fontSize: 11 }}
                onClick={() => {
                  setReqCategory('new_allergy');
                  setRequestModalOpen(true);
                }}
              >
                + Alert Doctor of an Allergy
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profile.allergies.map(allergy => {
                const isSevere = allergy.severity === 'severe';
                return (
                  <div
                    key={allergy.id}
                    style={{
                      background: isSevere ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      border: isSevere ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>
                          {allergy.allergen_family}
                        </span>
                        {allergy.specific_allergen && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            ({allergy.specific_allergen})
                          </span>
                        )}
                      </div>
                      {allergy.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {allergy.notes}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: isSevere ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                        color: isSevere ? 'var(--danger)' : 'var(--warning)',
                        border: `1px solid ${isSevere ? 'var(--danger)' : 'var(--warning)'}`,
                      }}
                    >
                      {allergy.severity}
                    </span>
                  </div>
                );
              })}

              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                  onClick={() => {
                    setReqCategory('new_allergy');
                    setRequestModalOpen(true);
                  }}
                >
                  + Report Additional Allergy / Food Reaction
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Requests Submitted to Doctor Tracker */}
      <div className="card" style={{ padding: 22, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🩺</span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Requests Sent to Doctor ({changeRequests.length})
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Track changes and updates you have requested from your attending physician
              </p>
            </div>
          </div>

          <button
            className="btn btn-sm btn-primary"
            style={{ fontSize: 12 }}
            onClick={() => setRequestModalOpen(true)}
          >
            + New Request to Doctor
          </button>
        </div>

        {changeRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📬</div>
            <div>No requests sent to the doctor yet.</div>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>
              If your diet needs adjusting, you developed symptoms, or noticed errors in your admission info, submit a request above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {changeRequests.map(req => {
              const catMeta = CATEGORY_META[req.category] || CATEGORY_META.other;
              const statusMeta = REQUEST_STATUS_META[req.status] || REQUEST_STATUS_META.pending;

              return (
                <div
                  key={req.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{catMeta.icon}</span>
                      <strong style={{ fontSize: 13, color: '#fff' }}>{catMeta.label}</strong>
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 12,
                        background: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.color}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {statusMeta.icon} {statusMeta.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}>
                    "{req.requested_changes}"
                  </div>

                  {req.doctor_response && (
                    <div style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)' }}>
                        🩺 Doctor's Response {req.reviewed_by_name ? `(Dr. ${req.reviewed_by_name})` : ''}:
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                        {req.doctor_response}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Submitted: {new Date(req.created_at).toLocaleString()}</span>
                    {req.status === 'pending' && (
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        ⏳ Notification active on Doctor Portal
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dietary Feedback Sent to Dietitians Section */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Dietary Feedback Sent to Clinical Dietitians ({feedbackList.length})
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Your feedback on taste, tolerance, and symptoms feeds directly into clinical meal adjustments
              </p>
            </div>
          </div>

          <button
            className="btn btn-sm btn-secondary"
            style={{ fontSize: 12 }}
            onClick={() => setFeedbackModalOpen(true)}
          >
            + Send New Feedback
          </button>
        </div>

        {feedbackList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🥗</div>
            <div>No meal feedback submitted yet.</div>
            <button
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10, fontSize: 12 }}
              onClick={() => setFeedbackModalOpen(true)}
            >
              Share Meal Experience with Dietitian
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {feedbackList.slice(0, 6).map(fb => {
              const tolInfo = TOLERANCE_META[fb.tolerance_status] || TOLERANCE_META.tolerated_well;
              return (
                <div
                  key={fb.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-400)' }}>
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)} ({fb.rating}/5)
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(fb.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{tolInfo.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: tolInfo.color }}>
                      {tolInfo.label}
                    </span>
                  </div>

                  {fb.meal_name && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Meal: <strong>{fb.meal_name}</strong> ({fb.meal_slot})
                    </div>
                  )}

                  {fb.comments && (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.03)', padding: 8, borderRadius: 4 }}>
                      "{fb.comments}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Request Detail Change to Doctor */}
      {requestModalOpen && (
        <Modal
          open={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          title="📝 Submit Request to Attending Doctor"
          footer={(
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRequestModalOpen(false)}
                disabled={submittingReq}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="patient-request-form"
                className="btn btn-primary"
                disabled={submittingReq}
              >
                {submittingReq ? 'Sending to Doctor...' : 'Send Request to Doctor 🩺'}
              </button>
            </div>
          )}
        >
          <form id="patient-request-form" onSubmit={handleRequestSubmit}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Your request will be routed directly to the <strong>Doctor Portal</strong> for clinical review. Your physician will review and update your admission file accordingly.
            </p>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>What type of change are you requesting? *</label>
              <select
                className="form-control"
                value={reqCategory}
                onChange={e => setReqCategory(e.target.value)}
                required
              >
                <option value="diet_preference">🥗 Diet Preference / Nutritional Need (e.g., vegetarian, low salt, soft food)</option>
                <option value="new_allergy">⚠️ New Allergy / Food Reaction Alert (report food symptoms)</option>
                <option value="symptom_condition">🏥 Health Condition / Symptoms (nausea, pain, appetite loss)</option>
                <option value="personal_info">🛏️ Personal Info (Bed / Ward / Age correction)</option>
                <option value="other">📝 Other Clinical Request</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Describe what you want changed / clinical notes *</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Example: 'Doctor, please change my diet to low-sodium as I feel bloated after meals', or 'I experienced a rash after eating peanuts previously'..."
                value={reqDescription}
                onChange={e => setReqDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text-muted)' }}>
              🔒 Sent to attending physician for Patient: <strong>{profile.name}</strong> (Ward {profile.ward}, Bed {profile.bed_no})
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Dietary Feedback to Dietitian */}
      {feedbackModalOpen && (
        <Modal
          open={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          title="💬 Send Dietary Feedback to Clinical Dietitian"
          footer={(
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setFeedbackModalOpen(false)}
                disabled={submittingFeedback}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="patient-feedback-form"
                className="btn btn-primary"
                disabled={submittingFeedback}
              >
                {submittingFeedback ? 'Sending...' : 'Send to Dietitian 🥗'}
              </button>
            </div>
          )}
        >
          <form id="patient-feedback-form" onSubmit={handleFeedbackSubmit}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              This feedback goes directly to the <strong>Clinical Dietitian Portal</strong> to monitor food tolerance and customize your ongoing meal plans.
            </p>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Overall Meal Satisfaction (1 to 5 Stars)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    style={{
                      fontSize: 26,
                      background: 'none',
                      border: 'none',
                      color: star <= feedbackRating ? '#fbbf24' : '#475569',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    onClick={() => setFeedbackRating(star)}
                  >
                    ★
                  </button>
                ))}
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  {feedbackRating} / 5 Stars
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Food Tolerance / Reaction Status *</label>
              <select
                className="form-control"
                value={feedbackTolerance}
                onChange={e => setFeedbackTolerance(e.target.value)}
              >
                <option value="tolerated_well">😊 Tolerated Well (No Symptoms / Comfortable)</option>
                <option value="mild_discomfort">😐 Mild Discomfort (Fullness / Gas / Bloating)</option>
                <option value="adverse_reaction">🚨 Adverse Symptoms / Allergy Sign (Nausea / Itching / Rash)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Taste & Quality</label>
              <select
                className="form-control"
                value={feedbackTaste}
                onChange={e => setFeedbackTaste(e.target.value)}
              >
                <option value="excellent">Delicious / Excellent</option>
                <option value="good">Good / Satisfactory</option>
                <option value="average">Average / Acceptable</option>
                <option value="poor">Needs Improvement / Unpalatable</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Additional Comments / Specific Needs</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Share any thoughts on seasoning, portion size, texture, or likes/dislikes for your dietitian..."
                value={feedbackComments}
                onChange={e => setFeedbackComments(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
