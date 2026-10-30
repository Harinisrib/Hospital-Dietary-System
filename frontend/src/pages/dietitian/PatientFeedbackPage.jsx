import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState } from '../../components/UI';

const TOLERANCE_BADGES = {
  tolerated_well: { label: 'Tolerated Well', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '😊' },
  mild_discomfort: { label: 'Mild Discomfort', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '😐' },
  adverse_reaction: { label: 'Adverse Reaction / Allergy Sign', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', icon: '🚨' },
};

export default function PatientFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toleranceFilter, setToleranceFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (toleranceFilter) params.tolerance = toleranceFilter;
      const res = await api.get('/patient-feedback/', { params });
      setFeedbacks(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient dietary feedbacks');
    } finally {
      setLoading(false);
    }
  }, [toleranceFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const filteredFeedbacks = feedbacks.filter(fb => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (fb.patient_name && fb.patient_name.toLowerCase().includes(q)) ||
      (fb.patient_ward && fb.patient_ward.toLowerCase().includes(q)) ||
      (fb.meal_name && fb.meal_name.toLowerCase().includes(q)) ||
      (fb.comments && fb.comments.toLowerCase().includes(q))
    );
  });

  // Calculate Metrics
  const totalCount = feedbacks.length;
  const avgRating = totalCount > 0
    ? (feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0) / totalCount).toFixed(1)
    : '5.0';
  const adverseCount = feedbacks.filter(f => f.tolerance_status === 'adverse_reaction').length;
  const discomfortCount = feedbacks.filter(f => f.tolerance_status === 'mild_discomfort').length;
  const toleratedCount = feedbacks.filter(f => f.tolerance_status === 'tolerated_well').length;

  return (
    <div className="patient-feedback-page" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>💬</span>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Patient Meal Feedback & Tolerance Monitor
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Live clinical feed of patient meal tolerance, food symptoms, and dietary satisfaction
              </p>
            </div>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={fetchFeedbacks}>
          🔄 Refresh Feedbacks
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Total Feedbacks
            </span>
            <span style={{ fontSize: 20 }}>💬</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Average: <strong style={{ color: '#fbbf24' }}>{avgRating} ★</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: adverseCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-elevated)', border: adverseCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: adverseCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              Adverse Symptoms Alert
            </span>
            <span style={{ fontSize: 20 }}>🚨</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: adverseCount > 0 ? 'var(--danger)' : '#fff', marginTop: 4 }}>
            {adverseCount}
          </div>
          <div style={{ fontSize: 12, color: adverseCount > 0 ? '#f87171' : 'var(--text-secondary)', marginTop: 2 }}>
            {adverseCount > 0 ? 'Requires immediate dietitian audit!' : 'Zero adverse events reported'}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)' }}>
              Mild Discomfort
            </span>
            <span style={{ fontSize: 20 }}>😐</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            {discomfortCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Bloating / Fullness monitored
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)' }}>
              Tolerated Well
            </span>
            <span style={{ fontSize: 20 }}>😊</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            {toleratedCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Safe clinical meal outcomes
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: 6 }}>
              Tolerance:
            </span>
            <button
              className={`btn btn-sm ${toleranceFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12 }}
              onClick={() => setToleranceFilter('')}
            >
              All Feedback ({feedbacks.length})
            </button>
            <button
              className={`btn btn-sm ${toleranceFilter === 'adverse_reaction' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: 12,
                background: toleranceFilter === 'adverse_reaction' ? '#ef4444' : undefined,
                borderColor: '#ef4444',
                color: toleranceFilter === 'adverse_reaction' ? '#fff' : '#f87171',
              }}
              onClick={() => setToleranceFilter('adverse_reaction')}
            >
              🚨 Adverse Reactions ({adverseCount})
            </button>
            <button
              className={`btn btn-sm ${toleranceFilter === 'mild_discomfort' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12 }}
              onClick={() => setToleranceFilter('mild_discomfort')}
            >
              😐 Mild Discomfort ({discomfortCount})
            </button>
            <button
              className={`btn btn-sm ${toleranceFilter === 'tolerated_well' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12 }}
              onClick={() => setToleranceFilter('tolerated_well')}
            >
              😊 Tolerated Well ({toleratedCount})
            </button>
          </div>

          <div style={{ width: 240 }}>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: 12, padding: '6px 12px' }}
              placeholder="🔍 Search patient, meal, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Feedbacks Content List */}
      {loading ? (
        <Loading text="Loading patient feedbacks..." />
      ) : filteredFeedbacks.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No Feedback Entries Found"
          desc="No patient feedbacks match your active filter criteria."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredFeedbacks.map(fb => {
            const tol = TOLERANCE_BADGES[fb.tolerance_status] || TOLERANCE_BADGES.tolerated_well;
            const isAdverse = fb.tolerance_status === 'adverse_reaction';

            return (
              <div
                key={fb.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: isAdverse ? '4px solid #ef4444' : fb.tolerance_status === 'mild_discomfort' ? '4px solid #f59e0b' : '4px solid #10b981',
                  background: isAdverse ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 100%)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {fb.patient_name}
                      </h3>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Ward {fb.patient_ward || 'N/A'} · Bed {fb.patient_bed || 'N/A'}
                      </span>
                      {fb.meal_name && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--brand-400)' }}>
                          🍽️ {fb.meal_name} ({fb.meal_slot})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Submitted: {new Date(fb.submitted_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 12,
                        background: tol.bg,
                        color: tol.color,
                        border: `1px solid ${tol.color}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {tol.icon} {tol.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Taste Rating: </span>
                    <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {fb.taste_rating}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tolerance Status: </span>
                    <strong style={{ color: tol.color }}>
                      {tol.label}
                    </strong>
                  </div>
                </div>

                {fb.comments && (
                  <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-primary)', borderLeft: '3px solid var(--brand-500)' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>
                      Patient's Comments:
                    </div>
                    "{fb.comments}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
