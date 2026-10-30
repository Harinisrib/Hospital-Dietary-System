import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading } from '../../components/UI';

export default function ConfidencePage() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Interactive formula simulator state
  const [simScore, setSimScore] = useState(0.5);
  const [simHistory, setSimHistory] = useState([0.5]);
  const alpha = 0.10;

  useEffect(() => {
    api.get('/ingredients/')
      .then(res => setIngredients(res.data.results || res.data || []))
      .catch(err => {
        console.error(err);
        toast.error('Failed to load ingredient confidence records');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSimulateStep = (outcome) => {
    const next = Number((alpha * outcome + (1 - alpha) * simScore).toFixed(4));
    setSimScore(next);
    setSimHistory(prev => [...prev.slice(-9), next]);
  };

  const handleResetSim = () => {
    setSimScore(0.5);
    setSimHistory([0.5]);
  };

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.allergen_family && i.allergen_family.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="confidence-page">
      <div className="page-header">
        <h2>AEARM Adaptive Confidence & Learning Monitor</h2>
        <p>Component 3: Real-time exponential smoothing of clinical allergen confidence</p>
      </div>

      {/* Model Formula Explainer & Live Interactive Sandbox */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ background: 'var(--bg-elevated)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--brand-400)' }}>
            📐 Mathematical Formulation (Component 3)
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            Every time a dietitian or senior reviewer authorizes a meal and records the patient consumption outcome, AEARM adapts the ingredient confidence using exponential smoothing:
          </p>

          <div style={{
            background: 'var(--bg-base)',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontFamily: 'JetBrains Mono',
            fontSize: 14,
            color: 'var(--brand-300)',
            marginBottom: 12,
          }}>
            C<sub>t+1</sub> = clamp(C<sub>t</sub> + &alpha; &times; (Outcome &minus; C<sub>t</sub>),&nbsp; 0.0,&nbsp; 1.0)
          </div>

          <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 18 }}>
            <li><strong>&alpha; = 0.10:</strong> Smoothing rate / learning parameter (exponential moving average).</li>
            <li><strong>Outcome = 1.0:</strong> Safe consumption (asymptotically increases confidence toward 1.0).</li>
            <li><strong>Outcome = 0.0:</strong> Adverse allergic reaction (sharply depresses confidence, increasing future risk scoring).</li>
          </ul>
        </div>

        {/* Live Simulator Widget */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            🧪 Interactive Learning Sandbox
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Simulate sequential patient outcomes and watch the confidence score update:
          </p>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Current Simulated Score</div>
            <div style={{
              fontSize: 32,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono',
              color: simScore >= 0.7 ? 'var(--success)' : simScore >= 0.4 ? 'var(--warning)' : 'var(--danger)',
              margin: '4px 0',
            }}>
              {(simScore * 100).toFixed(1)}%
            </div>
            <div className="progress-bar" style={{ maxWidth: 200, margin: '0 auto' }}>
              <div
                className={`progress-fill ${simScore >= 0.7 ? 'low' : simScore >= 0.4 ? 'medium' : 'high'}`}
                style={{ width: `${simScore * 100}%` }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-success btn-sm" onClick={() => handleSimulateStep(1.0)}>
              + Safe (+Outcome 1.0)
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => handleSimulateStep(0.0)}>
              - Reaction (Outcome 0.0)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleResetSim}>
              Reset
            </button>
          </div>

          {simHistory.length > 1 && (
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Trace: {simHistory.map(s => (s * 100).toFixed(0) + '%').join(' → ')}
            </div>
          )}
        </div>
      </div>

      {/* Ingredient Confidence List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Hospital Ingredient Registry & Confidence Ratings</h3>
          <div style={{ width: 240 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search ingredient or allergen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <Loading text="Loading ingredients..." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Allergen Family</th>
                  <th>Severity Tier</th>
                  <th>AEARM Confidence Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => {
                  const score = ing.confidence_score !== undefined ? Number(ing.confidence_score) : (ing.source_confidence || 0.85);
                  const statusClass = score >= 0.7 ? 'risk-low' : score >= 0.5 ? 'risk-medium' : 'risk-high';
                  const statusLabel = score >= 0.7 ? 'Verified Stable' : score >= 0.5 ? 'Moderate Watch' : 'Low Confidence Alert';
                  const fillClass = score >= 0.7 ? 'low' : score >= 0.5 ? 'medium' : 'high';
                  return (
                    <tr key={ing.id}>
                      <td><strong>{ing.name}</strong></td>
                      <td>
                        {ing.allergen_family ? (
                          <span style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--risk-high)',
                            fontWeight: 600,
                          }}>
                            {ing.allergen_family}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None (Neutral)</span>
                        )}
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize', fontSize: 12 }}>
                          {ing.severity_tier || 'Neutral'}
                        </span>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, width: 45 }}>
                            {(score * 100).toFixed(0)}%
                          </span>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className={`progress-fill ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, score * 100))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`risk-badge ${statusClass}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
