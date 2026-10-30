import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading } from '../../components/UI';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/')
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        toast.error('Failed to load analytics data');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="Loading clinical risk analytics..." />;
  if (!data) return null;

  // Prepare Doughnut Chart (Risk Distribution)
  const tierMap = { Low: 0, Medium: 0, High: 0 };
  (data.risk_distribution || []).forEach(item => {
    if (tierMap[item.risk_tier] !== undefined) {
      tierMap[item.risk_tier] = item.count;
    }
  });

  const doughnutData = {
    labels: ['Low Risk (Auto-Approved)', 'Medium Risk (Dietitian)', 'High Risk (Senior Reviewer)'],
    datasets: [
      {
        data: [tierMap.Low, tierMap.Medium, tierMap.High],
        backgroundColor: [
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(239, 68, 68, 0.85)',
        ],
        borderColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 1,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } },
      },
    },
  };

  // Prepare Ward Risk Bar Chart
  const wards = (data.ward_risk || []).map(w => w.patient__ward || 'Unassigned');
  const barData = {
    labels: wards,
    datasets: [
      {
        label: 'Low Risk',
        data: (data.ward_risk || []).map(w => w.low),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
      },
      {
        label: 'Medium Risk',
        data: (data.ward_risk || []).map(w => w.medium),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
      },
      {
        label: 'High Risk',
        data: (data.ward_risk || []).map(w => w.high),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } },
      },
    },
  };

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h2>Hospital Dietary Risk & AEARM Analytics</h2>
        <p>Real-time clinical safety metrics, allergen exposure distribution, and model confidence tracking</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card brand">
          <div className="stat-label">Total Meal Plans</div>
          <div className="stat-value">{data.total_meal_plans}</div>
          <div className="stat-sub">Evaluated by AEARM</div>
        </div>
        <div className="stat-card brand">
          <div className="stat-label">Active Inpatients</div>
          <div className="stat-value">{data.total_patients}</div>
          <div className="stat-sub">Across all wards</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Clinical Approvals</div>
          <div className="stat-value">{data.override_count}</div>
          <div className="stat-sub">Dietitian sign-offs</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Meals Rejected</div>
          <div className="stat-value">{data.rejected_count}</div>
          <div className="stat-sub">Blocked for allergy risk</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Average Risk Score</div>
          <div className="stat-value">{(Number(data.avg_risk_score || 0) * 100).toFixed(1)}%</div>
          <div className="stat-sub">Normalized system risk</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>AEARM Risk Tier Distribution</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Ratio of auto-approved vs human-reviewed meal plans
          </p>
          <div style={{ height: 260, position: 'relative' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ward-by-Ward Risk Profile</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Stack of Low, Medium, and High risk assignments by hospital location
          </p>
          <div style={{ height: 260, position: 'relative' }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Adaptive Learning & Low Confidence Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              🧠 Adaptive Model Monitoring: Low Confidence Ingredients
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Ingredients with confidence score &lt; 0.5 require conservative weighting and clinician vigilance.
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Component 3: Exponential Smoothing Feedback Loop
          </span>
        </div>

        {(!data.low_confidence_ingredients || data.low_confidence_ingredients.length === 0) ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--success)' }}>
            ✓ All ingredients currently meet or exceed minimum confidence thresholds (&ge; 0.50).
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Current Confidence Score</th>
                  <th>Risk Implication</th>
                  <th>Adaptive Status</th>
                </tr>
              </thead>
              <tbody>
                {data.low_confidence_ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td><strong>{ing.ingredient__name}</strong></td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--risk-high)' }}>
                      {(ing.confidence_score * 100).toFixed(1)}%
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Lower confidence raises AEARM risk score to avoid false negatives.
                    </td>
                    <td>
                      <span className="risk-badge risk-high">Needs Safe Trials</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
