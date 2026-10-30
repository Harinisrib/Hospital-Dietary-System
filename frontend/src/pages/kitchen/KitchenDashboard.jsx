import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

/* ─── Live Clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const day = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const clock = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>{clock}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{day}</div>
    </div>
  );
}

const SESSION_CONFIG = {
  breakfast: { label: 'Morning Breakfast', icon: '🌅', color: '#d97706', time: '08:00 – 09:30 AM' },
  lunch:     { label: 'Afternoon Lunch',   icon: '☀️', color: '#059669', time: '12:30 – 02:00 PM' },
  dinner:    { label: 'Evening Dinner',    icon: '🌙', color: '#7c3aed', time: '07:30 – 09:00 PM' },
};

const STATUS_CONFIG = {
  queued:     { label: 'Awaiting Cook',     icon: '🍳', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  preparing:  { label: 'In Preparation',    icon: '🧑‍🍳', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  ready:      { label: 'Ready for Trays',   icon: '📦', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  dispatched: { label: 'Dispatched',        icon: '🚚', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
};

/* ─── Activity Feed Item ─────────────────────────────────────── */
function ActivityItem({ icon, text, time, color }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.4 }}>{text}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: 'JetBrains Mono' }}>{time}</div>
      </div>
    </div>
  );
}

/* ─── Mini Ward Bar ──────────────────────────────────────────── */
function WardBar({ ward, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Ward {ward}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{count} trays</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

/* ─── Pipeline Step ──────────────────────────────────────────── */
function PipelineStep({ icon, label, count, color, bg, border, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
      <div style={{
        flex: 1, background: bg, border: `1.5px solid ${border}`,
        borderRadius: 12, padding: '14px 16px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 26 }}>{icon}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, margin: '4px 0' }}>{count}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <div style={{ height: 3, background: `${color}25`, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: count > 0 ? '100%' : '0%', height: '100%', background: color, transition: 'width 0.5s' }} />
        </div>
      </div>
      {!isLast && (
        <div style={{ fontSize: 18, color: '#cbd5e1', padding: '0 4px', flexShrink: 0 }}>→</div>
      )}
    </div>
  );
}

export default function KitchenDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [ordRes, logRes] = await Promise.all([
        api.get('/orders/'),
        api.get('/delivery-logs/'),
      ]);
      setOrders(ordRes.data.results || ordRes.data || []);
      setDeliveryLogs((logRes.data.results || logRes.data || []).slice(0, 20));
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load kitchen dashboard data', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAll();
      toast.success('Kitchen live dashboard refreshed!');
    } catch {
      toast.error('Failed to refresh kitchen data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAll().catch(() => {});
    const interval = setInterval(() => { fetchAll().catch(() => {}); }, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ─── computed ─── */
  const counts = { queued: 0, preparing: 0, ready: 0, dispatched: 0 };
  orders.forEach(o => { if (counts[o.kitchen_status] !== undefined) counts[o.kitchen_status]++; });

  const totalOrders = orders.length;
  const uniquePatients = new Set(orders.map(o => o.patient_id || o.patient_name)).size;
  const uniqueWards = new Set(orders.map(o => o.ward).filter(Boolean));

  const wardCounts = {};
  orders.forEach(o => {
    if (o.ward) wardCounts[o.ward] = (wardCounts[o.ward] || 0) + 1;
  });

  const currentHour = new Date().getHours();
  const currentSession = currentHour < 11 ? 'breakfast' : currentHour < 16 ? 'lunch' : 'dinner';
  const sessionCfg = SESSION_CONFIG[currentSession];

  const urgentCount = counts.queued;
  const pendingDelivery = counts.ready + counts.dispatched;

  /* ─── Recent activity from delivery logs ─── */
  const recentActivity = deliveryLogs.slice(0, 8).map(log => {
    const isMatched = log.scan_result === 'matched';
    const isMissing = log.scan_result === 'missing';
    return {
      icon: isMatched ? '✅' : isMissing ? '⚠️' : '🚫',
      text: `${log.tray_code || 'Tray'} scanned → ${log.scan_result?.toUpperCase()} ${log.patient_name ? `(${log.patient_name})` : ''}`,
      time: log.delivered_at ? new Date(log.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
      color: isMatched ? '#059669' : isMissing ? '#d97706' : '#dc2626',
    };
  });

  return (
    <div style={{ paddingBottom: 48 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #059669 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 22,
        color: '#fff', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={{ fontSize: 44 }}>🧑‍🍳</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>
                Kitchen Live Dashboard
              </h2>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
                Real-time meal production · Tray fulfillment · Ward delivery pipeline
              </p>
            </div>
          </div>
          {/* Active session chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '6px 14px',
          }}>
            <span>{sessionCfg.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Active: {sessionCfg.label}</span>
            <span style={{ opacity: 0.8, fontSize: 12 }}>({sessionCfg.time})</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LiveClock />
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            style={{
              background: refreshing ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.22)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 13,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease',
            }}
          >
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ═══ URGENT ALERT BANNER (if queued meals exist) ═══ */}
      {urgentCount > 0 && (
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12,
          padding: '14px 20px', marginBottom: 18,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#c2410c' }}>
                {urgentCount} Meal{urgentCount > 1 ? 's' : ''} Awaiting Preparation
              </div>
              <div style={{ fontSize: 12, color: '#9a3412' }}>
                Patients are waiting — start cooking immediately to stay on schedule
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/kitchen/orders')} style={{
            background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>🍳 Go to Kitchen Queue →</button>
        </div>
      )}

      {/* ═══ KPI CARDS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Portions', value: totalOrders, icon: '🍲', color: '#4f46e5', bg: '#ede9fe', border: '#c4b5fd' },
          { label: 'Patients Today', value: uniquePatients, icon: '👥', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Active Wards', value: uniqueWards.size, icon: '🏥', color: '#0891b2', bg: '#f0f9ff', border: '#bae6fd' },
          { label: 'Awaiting Cook', value: counts.queued, icon: '🍳', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          { label: 'In Preparation', value: counts.preparing, icon: '🧑‍🍳', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Ready to Dispatch', value: counts.ready, icon: '📦', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Dispatched', value: counts.dispatched, icon: '🚚', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
          { label: 'Pending Delivery', value: pendingDelivery, icon: '🚀', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
        ].map(k => (
          <div key={k.label} style={{
            background: k.bg, border: `1.5px solid ${k.border}`,
            borderRadius: 14, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
            transition: 'transform 0.15s',
          }}>
            <span style={{ fontSize: 30 }}>{k.icon}</span>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.color, opacity: 0.8, marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ PIPELINE BAR ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '20px 24px', marginBottom: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>🔄 Live Kitchen Pipeline</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>
            Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg], i, arr) => (
            <PipelineStep key={key}
              icon={cfg.icon} label={cfg.label} count={counts[key]}
              color={cfg.color} bg={cfg.bg} border={cfg.border}
              isLast={i === arr.length - 1}
            />
          ))}
        </div>
        {/* Combined progress bar */}
        <div style={{ marginTop: 14, height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden', background: '#f1f5f9' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            counts[key] > 0 && (
              <div key={key} style={{
                width: `${(counts[key] / Math.max(totalOrders, 1)) * 100}%`,
                background: cfg.color, transition: 'width 0.5s ease',
              }} title={`${cfg.label}: ${counts[key]}`} />
            )
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: cfg.color, fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              {cfg.label}: {counts[key]}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ MIDDLE ROW: Ward breakdown + Quick Actions + Activity Feed ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 22 }}>

        {/* Ward Breakdown */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏥 Ward Distribution
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginLeft: 'auto' }}>{uniqueWards.size} active wards</span>
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : Object.keys(wardCounts).length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No active orders</div>
          ) : (
            Object.entries(wardCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([ward, cnt], i) => {
                const colors = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed'];
                return (
                  <WardBar key={ward} ward={ward} count={cnt}
                    total={totalOrders} color={colors[i % colors.length]} />
                );
              })
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 16 }}>⚡ Quick Actions</div>
          {[
            {
              icon: '🍳', label: 'Kitchen Queue',
              sub: `${counts.queued + counts.preparing} meals in progress`,
              color: '#d97706', bg: '#fffbeb', to: '/kitchen/orders',
            },
            {
              icon: '📷', label: 'QR Scan & Dispatch',
              sub: `${counts.dispatched} trays ready for scan`,
              color: '#4f46e5', bg: '#ede9fe', to: '/kitchen/scan',
            },
            {
              icon: '📋', label: 'Delivery Audit Log',
              sub: `${deliveryLogs.length} recent scan records`,
              color: '#059669', bg: '#f0fdf4', to: '/kitchen/delivery-log',
            },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              background: a.bg, border: `1px solid ${a.color}30`,
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              marginBottom: 10, textAlign: 'left',
            }}>
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: a.color }}>{a.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{a.sub}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: a.color, fontSize: 16 }}>→</span>
            </button>
          ))}

          {/* Compliance status */}
          <div style={{
            background: counts.queued > 5 ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${counts.queued > 5 ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 10, padding: '10px 14px', marginTop: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: counts.queued > 5 ? '#dc2626' : '#059669' }}>
              {counts.queued > 5 ? '🚨 High Backlog Alert' : '✅ Kitchen On Schedule'}
            </div>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
              {counts.queued > 5
                ? `${counts.queued} orders pending — immediate action required`
                : 'All sessions progressing normally'}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>📡 Live Activity Feed</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>Recent QR scan events</div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              No scan activity yet.<br />
              <span style={{ fontSize: 11 }}>Use QR Scan &amp; Dispatch to start recording.</span>
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {recentActivity.map((a, i) => <ActivityItem key={i} {...a} />)}
            </div>
          )}
          {recentActivity.length > 0 && (
            <button onClick={() => navigate('/kitchen/delivery-log')} style={{
              marginTop: 12, width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '7px', fontWeight: 600, fontSize: 12,
              color: '#374151', cursor: 'pointer',
            }}>View Full Audit Log →</button>
          )}
        </div>
      </div>

      {/* ═══ BOTTOM: Today's Order Status Table ═══ */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>📊 Today's Tray Status Overview</div>
          <button onClick={() => navigate('/kitchen/orders')} style={{
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>Open Full Queue →</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>⏳ Loading tray data...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>No Orders Today</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Orders will appear here once meal sessions begin.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Patient', 'Ward · Bed', 'Meal', 'Diet', 'Session', 'Status', 'Tray Code'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: 10,
                      fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                      borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 15).map((o, i) => {
                  const sc = STATUS_CONFIG[o.kitchen_status] || STATUS_CONFIG.queued;
                  const hasA = o.allergies && o.allergies.length > 0;
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {o.patient_name}
                        {hasA && <span style={{ marginLeft: 5, fontSize: 10, color: '#dc2626' }}>⚠️</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>
                        <span style={{ fontWeight: 700, color: '#4f46e5' }}>Ward {o.ward || '—'}</span>
                        {' '}· Bed {o.bed_no || o.bed_number || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.meal_name || 'Standard Meal'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 4, padding: '1px 6px' }}>
                          {o.patient_diet_type || 'Regular'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: '#fff',
                          background: o.meal_slot === 'breakfast' ? '#d97706' : o.meal_slot === 'dinner' ? '#7c3aed' : '#059669',
                          textTransform: 'capitalize',
                        }}>{o.meal_slot || 'lunch'}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          padding: '3px 9px', borderRadius: 10,
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                          display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                        }}>{sc.icon} {o.kitchen_status}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#ede9fe', borderRadius: 4, padding: '1px 6px' }}>
                          {o.tray_code || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length > 15 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                <button onClick={() => navigate('/kitchen/orders')} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '8px 20px', fontWeight: 600, fontSize: 12, color: '#374151', cursor: 'pointer',
                }}>
                  + {orders.length - 15} more orders — View Full Queue
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

