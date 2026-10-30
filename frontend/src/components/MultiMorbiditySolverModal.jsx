import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Modal } from './UI';

const NUTRIENT_META = {
  sodium: { name: 'Sodium', icon: '🧂', unit: 'Na+' },
  sugar: { name: 'Sugar', icon: '🍬', unit: 'Carb' },
  protein: { name: 'Protein', icon: '🥩', unit: 'Protein' },
  potassium: { name: 'Potassium', icon: '🍌', unit: 'K+' },
  fluid: { name: 'Fluid', icon: '💧', unit: 'Hydration' },
};

const VIVA_PRESETS = [
  {
    id: 'ckd_cardiac',
    title: 'CKD + Cardiac Surgery',
    rule: 'Tier 2 > Tier 1 Override',
    val: 'Chronic Kidney Disease, Post-Cardiac Surgery',
    desc: 'Low protein (CKD) vs High protein (Post-Op) → Post-Op Acute tier wins to promote post-surgical tissue healing.',
    tag: 'Acute Priority Override',
    tagColor: '#6366f1',
    icon: '⚡',
  },
  {
    id: 'ckd_malnutrition',
    title: 'CKD + Malnutrition',
    rule: 'Tier 1 Tie → Safe Baseline',
    val: 'Chronic Kidney Disease, Protein-Energy Malnutrition',
    desc: 'Opposing protein demands within same chronic tier → Safe default to Normal & flagged for dietitian sign-off.',
    tag: 'Tie-Safe Fallback',
    tagColor: '#d97706',
    icon: '⚖️',
  },
  {
    id: 'htn_chf',
    title: 'Hypertension + Heart Failure',
    rule: 'Strictness Synergy',
    val: 'Hypertension, Congestive Heart Failure',
    desc: 'Both conditions demand sodium limitation → Algorithm safely enforces the strictest limit (Restricted).',
    tag: 'Strictness Synergy',
    tagColor: '#dc2626',
    icon: '🛑',
  },
  {
    id: 'pancreatitis_cardiac',
    title: 'Pancreatitis + Cardiac Surgery',
    rule: 'Dual Acute Reconciliation',
    val: 'Acute Pancreatitis, Post-Cardiac Surgery',
    desc: 'Dual acute conditions evaluated deterministically under emergency clinical protocols.',
    tag: 'Acute Resolution',
    tagColor: '#0284c7',
    icon: '🏥',
  },
];

const QUICK_DIAGNOSES = [
  'Chronic Kidney Disease',
  'Post-Cardiac Surgery',
  'Type 2 Diabetes',
  'Hypertension',
  'Congestive Heart Failure',
  'Acute Pancreatitis',
  'Protein-Energy Malnutrition',
];

function getNutrientStyle(val) {
  switch ((val || '').toLowerCase()) {
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

export default function MultiMorbiditySolverModal({ open, onClose }) {
  const [vivaInput, setVivaInput] = useState('Chronic Kidney Disease, Post-Cardiac Surgery');
  const [vivaResult, setVivaResult] = useState(null);
  const [vivaLoading, setVivaLoading] = useState(false);
  const [referenceTable, setReferenceTable] = useState(null);
  const [showRefTable, setShowRefTable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVivaLoading(true);
    api.get('/diet-constraints/evaluate/')
      .then(({ data }) => {
        setReferenceTable(data.reference_table);
        if (data.viva_demo_case) {
          setVivaResult({
            constraints: data.viva_demo_case.constraints,
            explanation_log: data.viva_demo_case.explanation_log,
            rationale: data.viva_demo_case.rationale,
          });
        }
      })
      .catch(() => {
        toast.error('Failed to load Multi-Morbidity Solver data');
      })
      .finally(() => {
        setVivaLoading(false);
      });
  }, [open]);

  const handleEvaluateCustomViva = async (customDiag) => {
    const textToRun = customDiag !== undefined ? customDiag : vivaInput;
    if (customDiag !== undefined) {
      setVivaInput(customDiag);
    }
    if (!textToRun.trim()) {
      toast.error('Enter at least one clinical diagnosis');
      return;
    }
    setVivaLoading(true);
    try {
      const { data } = await api.post('/diet-constraints/evaluate/', { diagnosis: textToRun });
      setVivaResult(prev => ({
        ...prev,
        constraints: data.constraints,
        explanation_log: data.explanation_log,
        ...(data.rationale ? { rationale: data.rationale } : {}),
      }));
    } catch {
      toast.error('Evaluation failed');
    } finally {
      setVivaLoading(false);
    }
  };

  const handleAddQuickDiag = (diag) => {
    if (!vivaInput.trim()) {
      setVivaInput(diag);
    } else {
      const parts = vivaInput.split(',').map(s => s.trim().toLowerCase());
      if (!parts.includes(diag.toLowerCase())) {
        setVivaInput(`${vivaInput.trim()}, ${diag}`);
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="960px"
      title="⚡ Multi-Morbidity Dietary Constraint Solver & Conflict Engine"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Deterministic Clinical Decision Matrix · Pure Additive Logic
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 1. Clinical Priority Architecture Header */}
        <div style={{
          padding: '18px 22px',
          background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
          border: '1px solid #c7d2fe',
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🧬</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#3730a3' }}>
                  Clinical Priority Precedence Engine
                </span>
                <div style={{ fontSize: 12, color: '#4338ca', marginTop: 1 }}>
                  Autonomous tier resolution for complex multi-disease inpatients
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 20,
              background: '#ffffff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              Deterministic Decision Hierarchy
            </span>
          </div>

          {/* 3 Priority Tiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: '#dc2626', fontSize: 12.5 }}>Tier 2 · Acute &amp; Post-Op</strong>
                <span style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>Highest</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#7f1d1d', marginTop: 5, lineHeight: 1.4 }}>
                Post-Cardiac Surgery, Pancreatitis. Overrides background chronic limits for immediate survival &amp; tissue healing.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: '#d97706', fontSize: 12.5 }}>Tier 1 · Chronic Disease</strong>
                <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>Intermediate</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#78350f', marginTop: 5, lineHeight: 1.4 }}>
                CKD, Diabetes, Hypertension, CHF. Long-term metabolic regulation applied when acute override is absent.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: '#059669', fontSize: 12.5 }}>Tier 0 · Physiological Baseline</strong>
                <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>Base</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#14532d', marginTop: 5, lineHeight: 1.4 }}>
                Standard Dietary Reference Intake (RDA). Fallback standard when no clinical restriction is active.
              </div>
            </div>
          </div>

          {/* Strictness States Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 11.5,
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Strictness Order (Tie Resolver):</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#dc2626', fontWeight: 800 }}>🛑 RESTRICTED (Hard Limit)</span>
              <span style={{ color: '#94a3b8' }}>&gt;</span>
              <span style={{ color: '#d97706', fontWeight: 800 }}>⚠️ LOW (Controlled)</span>
              <span style={{ color: '#94a3b8' }}>&gt;</span>
              <span style={{ color: '#059669', fontWeight: 800 }}>✓ NORMAL (Standard)</span>
              <span style={{ color: '#94a3b8' }}>vs</span>
              <span style={{ color: '#7c3aed', fontWeight: 800 }}>⚡ HIGH (Therapeutic Surplus)</span>
            </div>
          </div>
        </div>

        {/* 2. Quick 1-Click Viva Presets */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🎯</span> 1-Click Demonstration Clinical Scenarios
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Click any scenario to evaluate instantly</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 12 }}>
            {VIVA_PRESETS.map((preset) => {
              const isSelected = vivaInput.trim().toLowerCase() === preset.val.toLowerCase();
              return (
                <button
                  key={preset.id}
                  onClick={() => handleEvaluateCustomViva(preset.val)}
                  style={{
                    background: isSelected ? '#eef2ff' : '#ffffff',
                    border: isSelected ? '2px solid #6366f1' : '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxShadow: isSelected ? '0 4px 14px rgba(99, 102, 241, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 12,
                      background: `${preset.tagColor}15`,
                      color: preset.tagColor,
                      border: `1px solid ${preset.tagColor}40`,
                    }}>
                      {preset.tag}
                    </span>
                    <span style={{ fontSize: 15 }}>{preset.icon}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {preset.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {preset.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Custom Input Playground */}
        <div style={{
          padding: '18px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}>
          <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>🩺 Input Multi-Morbidity Diagnoses (comma-separated):</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type custom or use quick tags below</span>
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="form-control"
              value={vivaInput}
              onChange={e => setVivaInput(e.target.value)}
              placeholder="e.g. Chronic Kidney Disease, Post-Cardiac Surgery"
              style={{ flex: '1 1 320px', fontSize: 13, background: '#ffffff' }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => setVivaInput('')}
              title="Clear input"
              style={{ fontSize: 12 }}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleEvaluateCustomViva()}
              disabled={vivaLoading}
              style={{ minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
            >
              {vivaLoading ? 'Synthesizing...' : '⚡ Solve Constraints'}
            </button>
          </div>

          {/* Quick Add Chips */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 2 }}>Quick append:</span>
            {QUICK_DIAGNOSES.map((diag) => (
              <button
                key={diag}
                onClick={() => handleAddQuickDiag(diag)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 14,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                + {diag}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Resolved Output Dashboard */}
        {vivaResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Nutrient Cards */}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎯</span> Resolved Nutrient Demand Matrix (Deterministic Output)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {Object.entries(vivaResult.constraints || {}).map(([nutr, val]) => {
                  const style = getNutrientStyle(val);
                  const meta = NUTRIENT_META[nutr.toLowerCase()] || { name: nutr, icon: '🧪', unit: '' };
                  return (
                    <div
                      key={nutr}
                      style={{
                        padding: '16px 12px',
                        background: style.bg,
                        border: `1.5px solid ${style.border}`,
                        borderRadius: 12,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{meta.icon}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        {meta.name}
                      </div>
                      <div style={{
                        marginTop: 8,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#ffffff',
                        color: style.color,
                        border: `1px solid ${style.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}>
                        <span>{style.badgeIcon}</span> {style.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 500 }}>
                        {style.subtext}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clinical Decision Trail */}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📜</span> Clinical Reasoning &amp; Conflict Resolution Trace
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(vivaResult.explanation_log || []).map((log, idx) => {
                  const isConflict = log.includes('CONFLICT');
                  const isUnresolved = log.includes('UNRESOLVED');
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        background: isUnresolved ? '#fef2f2' : isConflict ? '#fffbeb' : '#f0fdf4',
                        borderLeft: `4px solid ${isUnresolved ? '#ef4444' : isConflict ? '#f59e0b' : '#10b981'}`,
                        borderRadius: 6,
                        fontSize: 12,
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        border: '1px solid #e2e8f0',
                        borderLeftWidth: 4,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{isUnresolved ? '⚠️' : isConflict ? '⚡' : '✅'}</span>
                      <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
                        {log}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Viva Defense Talking Point */}
            {vivaResult.rationale && (
              <div style={{
                padding: '16px 20px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Clinical Viva Defense Policy (Why System Defaults Safe on Ties)
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#78350f', fontStyle: 'italic', lineHeight: 1.5, paddingLeft: 24 }}>
                  "{vivaResult.rationale}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Reference Matrix Toggle */}
        <div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowRefTable(v => !v)}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>{showRefTable ? '▲' : '▼'}</span>
            <span>{showRefTable ? 'Hide Reference Matrix' : '📖 View Step 1 Clinical Reference Matrix'}</span>
          </button>

          {showRefTable && referenceTable && (
            <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: '#ffffff' }}>
              <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-base)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Diagnosis</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Tier</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Sodium</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Sugar</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Protein</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Potassium</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fluid</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(referenceTable).map(([diag, d]) => (
                    <tr key={diag} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}><strong>{diag}</strong></td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontSize: 10.5,
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontWeight: 700,
                          background: d.priority_tier === 2 ? '#fee2e2' : d.priority_tier === 1 ? '#fef3c7' : '#dcfce7',
                          color: d.priority_tier === 2 ? '#dc2626' : d.priority_tier === 1 ? '#d97706' : '#059669',
                        }}>
                          Tier {d.priority_tier}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: d.sodium === 'restricted' ? '#dc2626' : d.sodium === 'low' ? '#d97706' : '#059669', fontWeight: 700 }}>
                          {d.sodium}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: d.sugar === 'low' ? '#d97706' : '#059669', fontWeight: 700 }}>
                          {d.sugar}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: d.protein === 'high' ? '#7c3aed' : d.protein === 'low' ? '#d97706' : '#059669', fontWeight: 700 }}>
                          {d.protein}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: d.potassium === 'restricted' ? '#dc2626' : d.potassium === 'low' ? '#d97706' : '#059669', fontWeight: 700 }}>
                          {d.potassium}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: d.fluid === 'restricted' ? '#dc2626' : d.fluid === 'low' ? '#d97706' : d.fluid === 'high' ? '#7c3aed' : '#059669', fontWeight: 700 }}>
                          {d.fluid}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
