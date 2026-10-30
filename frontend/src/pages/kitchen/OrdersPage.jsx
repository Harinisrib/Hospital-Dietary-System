import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState, Pagination } from '../../components/UI';

/* ─── Status pipeline ─────────────────────────────────────────── */
const STATUS_ORDER = ['queued', 'preparing', 'ready', 'dispatched'];

const STATUS_CONFIG = {
  queued:     { label: 'Awaiting Cook',     icon: '🍳', color: '#d97706', bg: '#fffbeb', border: '#fde68a', step: 0 },
  preparing:  { label: 'In Preparation',    icon: '🧑‍🍳', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', step: 1 },
  ready:      { label: 'Ready for Trays',   icon: '📦', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', step: 2 },
  dispatched: { label: 'Dispatched to Cart',icon: '🚚', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', step: 3 },
};

const SESSION_CONFIG = {
  breakfast: { label: 'Morning Breakfast', icon: '🌅', color: '#d97706', time: '08:00 – 09:30 AM' },
  lunch:     { label: 'Afternoon Lunch',   icon: '☀️', color: '#059669', time: '12:30 – 02:00 PM' },
  dinner:    { label: 'Evening Dinner',    icon: '🌙', color: '#7c3aed', time: '07:30 – 09:00 PM' },
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const getNextStatus = (current) => {
  const idx = STATUS_ORDER.indexOf(current);
  return idx !== -1 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
};

const getNextBtnLabel = (next) => ({
  preparing: '🧑‍🍳 Start Prep',
  ready:     '📦 Mark Ready',
  dispatched:'🚚 Dispatch',
}[next] || null);

/* ─── Live Clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

/* ─── Pipeline Step Bar ───────────────────────────────────────── */
function PipelineBar({ counts }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const steps = STATUS_ORDER.map(st => ({ ...STATUS_CONFIG[st], key: st, count: counts[st] || 0 }));
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
        🔄 Live Kitchen Pipeline
      </div>
      <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{
              flex: 1, background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: i === 0 ? '10px 0 0 10px' : i === steps.length - 1 ? '0 10px 10px 0' : '0',
              padding: '12px 14px', textAlign: 'center',
              borderRight: i < steps.length - 1 ? 'none' : `1px solid ${s.border}`,
            }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1.1, marginTop: 4 }}>{s.count}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
              {/* Progress bar */}
              <div style={{ marginTop: 8, height: 4, background: `${s.color}25`, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / total) * 100}%`, height: '100%', background: s.color, borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ fontSize: 16, color: '#94a3b8', padding: '0 2px', zIndex: 1, background: '#ffffff' }}>→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tray Card (individual view) ─────────────────────────────── */
function TrayCard({ order, onUpdateStatus, updatingId }) {
  const nextStatus = getNextStatus(order.kitchen_status);
  const cfg = STATUS_CONFIG[order.kitchen_status] || STATUS_CONFIG.queued;
  const hasAllergies = order.allergies && order.allergies.length > 0;
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      background: '#ffffff', borderRadius: 12,
      border: `1.5px solid ${cfg.border}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Status strip */}
      <div style={{ background: cfg.bg, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${cfg.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#fff',
          background: order.meal_slot === 'breakfast' ? '#d97706' : order.meal_slot === 'dinner' ? '#7c3aed' : '#059669',
          borderRadius: 10, padding: '1px 8px', textTransform: 'uppercase',
        }}>
          {order.meal_slot || 'lunch'}
        </span>
      </div>

      <div style={{ padding: '14px', flex: 1 }}>
        {/* Meal name */}
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 4, lineHeight: 1.3 }}>
          {order.meal_name || 'Standard Meal'}
        </div>

        {/* Patient info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 15 }}>👤</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{order.patient_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Ward {order.ward} · Bed {order.bed_no || order.bed_number || '—'}</div>
          </div>
        </div>

        {/* Diet tags */}
        {order.patient_diet_type && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#4f46e5',
              background: '#ede9fe', border: '1px solid #c4b5fd',
              borderRadius: 5, padding: '2px 7px',
            }}>{order.patient_diet_type}</span>
          </div>
        )}

        {/* Allergy alert */}
        {hasAllergies && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '6px 10px', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: 3 }}>⚠️ Allergies</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {order.allergies.map((a, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700, color: '#dc2626',
                  background: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: 4, padding: '1px 6px',
                }}>{a.allergen_family || a.family}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tray code + QR */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Tray Tag</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 800, color: '#4f46e5' }}>{order.tray_code}</div>
            </div>
            {order.qr_image_url && !imgError ? (
              <img src={order.qr_image_url} alt={order.tray_code} onError={() => setImgError(true)}
                style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0' }}
              />
            ) : (
              <div style={{ width: 54, height: 54, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📱</div>
            )}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
        {nextStatus ? (
          <button
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            disabled={updatingId === order.id}
            style={{
              width: '100%', padding: '9px', background: updatingId === order.id ? '#e2e8f0' : STATUS_CONFIG[nextStatus]?.color || '#4f46e5',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 12, cursor: updatingId === order.id ? 'not-allowed' : 'pointer',
            }}
          >
            {updatingId === order.id ? '⏳ Updating...' : getNextBtnLabel(nextStatus)}
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#059669', fontWeight: 700, padding: '6px 0' }}>
            ✅ Dispatched for Ward Delivery
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Bulk Meal Group Card ────────────────────────────────────── */
function BulkMealCard({ mealGroup, index, onBulkUpdate, onSingleUpdate, updatingId, updatingBatchKey }) {
  const [expanded, setExpanded] = useState(true);
  const { queued, preparing, ready, dispatched } = mealGroup.status_counts;
  const total = mealGroup.total_portions;
  const isBusy = updatingBatchKey === mealGroup.key;
  const allDone = queued === 0 && preparing === 0 && ready === 0;
  const wards = [...new Set(mealGroup.orders.map(o => o.ward).filter(Boolean))];

  return (
    <div style={{
      background: '#ffffff', borderRadius: 14,
      border: queued > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ padding: '16px 20px', background: '#f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: expanded ? '1px solid #e2e8f0' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 260 }}>
          {/* Batch number */}
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
            {index + 1}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{mealGroup.meal_name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 10, color: '#fff',
                background: mealGroup.meal_slot === 'breakfast' ? '#d97706' : mealGroup.meal_slot === 'dinner' ? '#7c3aed' : '#059669',
              }}>{mealGroup.meal_slot}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Wards: <strong style={{ color: '#4f46e5' }}>{wards.length ? wards.join(', ') : 'All'}</strong>
              {mealGroup.diet_tags?.length > 0 && <> · <span style={{ color: '#059669' }}>{mealGroup.diet_tags.join(', ')}</span></>}
            </div>
            {mealGroup.ingredients?.length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Ingredients: {mealGroup.ingredients.slice(0, 5).join(', ')}{mealGroup.ingredients.length > 5 ? ` +${mealGroup.ingredients.length - 5}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Status mini chips + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          {/* Portion counter */}
          <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Cook Qty</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>{total}</div>
          </div>

          {/* Status counts */}
          {[
            { key: 'queued', val: queued, color: '#d97706', bg: '#fffbeb', icon: '🍳' },
            { key: 'preparing', val: preparing, color: '#2563eb', bg: '#eff6ff', icon: '🧑‍🍳' },
            { key: 'ready', val: ready, color: '#059669', bg: '#f0fdf4', icon: '📦' },
            { key: 'dispatched', val: dispatched, color: '#7c3aed', bg: '#f5f3ff', icon: '🚚' },
          ].map(s => s.val > 0 && (
            <div key={s.key} style={{ background: s.bg, borderRadius: 6, padding: '4px 8px', textAlign: 'center', minWidth: 36 }}>
              <div style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>{s.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}

          {/* Bulk action buttons */}
          {queued > 0 && (
            <button disabled={isBusy} onClick={() => onBulkUpdate(mealGroup.key, mealGroup.order_ids, 'preparing')}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
              🧑‍🍳 Start Batch ({queued})
            </button>
          )}
          {preparing > 0 && (
            <button disabled={isBusy} onClick={() => onBulkUpdate(mealGroup.key, mealGroup.order_ids, 'ready')}
              style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
              📦 Mark Ready ({preparing})
            </button>
          )}
          {ready > 0 && (
            <button disabled={isBusy} onClick={() => onBulkUpdate(mealGroup.key, mealGroup.order_ids, 'dispatched')}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 12px', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
              🚚 Dispatch ({ready})
            </button>
          )}
          {allDone && (
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '6px 12px' }}>
              ✅ All {total} Dispatched
            </span>
          )}

          <button onClick={() => setExpanded(p => !p)}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {expanded ? '▲ Hide' : `▼ ${mealGroup.orders.length} Patients`}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, display: 'flex', background: '#f1f5f9' }}>
        {queued > 0    && <div style={{ width: `${(queued    / total) * 100}%`, background: '#d97706', transition: 'width 0.4s' }} />}
        {preparing > 0 && <div style={{ width: `${(preparing / total) * 100}%`, background: '#2563eb', transition: 'width 0.4s' }} />}
        {ready > 0     && <div style={{ width: `${(ready     / total) * 100}%`, background: '#059669', transition: 'width 0.4s' }} />}
        {dispatched > 0&& <div style={{ width: `${(dispatched/ total) * 100}%`, background: '#7c3aed', transition: 'width 0.4s' }} />}
      </div>

      {/* Patient roster table */}
      {expanded && (
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ padding: '12px 20px 8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f1f5f9' }}>
            👥 Patient Roster — {mealGroup.orders.length} recipients
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Patient', 'Ward · Bed', 'Diet', 'Allergy Alerts', 'Tray', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mealGroup.orders.map(ord => {
                  const ns = getNextStatus(ord.kitchen_status);
                  const sc = STATUS_CONFIG[ord.kitchen_status] || STATUS_CONFIG.queued;
                  const hasA = ord.allergies && ord.allergies.length > 0;
                  return (
                    <tr key={ord.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>👤</span> {ord.patient_name}
                        </div>
                        {ord.patient_diagnosis && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{ord.patient_diagnosis}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: '#4f46e5' }}>Ward {ord.ward || '—'}</span>
                        {' · '}Bed {ord.bed_no || ord.bed_number || '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 4, padding: '1px 6px' }}>
                          {ord.patient_diet_type || 'Regular'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {hasA ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {ord.allergies.map((a, i) => (
                              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 5px' }}>
                                ⚠️ {a.allergen_family || a.family}
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: 11, color: '#94a3b8' }}>None</span>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#ede9fe', borderRadius: 4, padding: '1px 6px' }}>{ord.tray_code}</span>
                          {ord.qr_image_url && (
                            <img src={ord.qr_image_url} alt={ord.tray_code} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, border: '1px solid #e2e8f0' }} />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 10, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                          {sc.icon} {ord.kitchen_status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        {ns ? (
                          <button disabled={updatingId === ord.id} onClick={() => onSingleUpdate(ord.id, ns)}
                            style={{ background: STATUS_CONFIG[ns].color, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: updatingId === ord.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                            {updatingId === ord.id ? '...' : getNextBtnLabel(ns)}
                          </button>
                        ) : <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ In Cart</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('bulk');
  const [statusFilter, setStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingBatchKey, setUpdatingBatchKey] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const fetchOrders = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.kitchen_status = statusFilter;
      if (sessionFilter) params.meal_slot = sessionFilter;
      if (wardFilter) params.ward = wardFilter;
      const res = await api.get('/orders/', { params });
      const data = res.data.results || res.data || [];
      setOrders(data);
      if (isManual) toast.success(`Refreshed ${data.length} kitchen orders!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load kitchen orders');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [statusFilter, sessionFilter, wardFilter]);

  useEffect(() => { fetchOrders(false); }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      (o.meal_name?.toLowerCase().includes(q)) ||
      (o.patient_name?.toLowerCase().includes(q)) ||
      (o.ward?.toLowerCase().includes(q)) ||
      (o.bed_no?.toLowerCase().includes(q)) ||
      (o.tray_code?.toLowerCase().includes(q)) ||
      (o.patient_diet_type?.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  const bulkMealSummary = useMemo(() => {
    const map = {};
    filteredOrders.forEach(order => {
      const key = `${order.meal_id || order.meal_name}_${order.meal_slot || 'lunch'}`;
      if (!map[key]) {
        map[key] = {
          key, meal_id: order.meal_id,
          meal_name: order.meal_name || 'Standard Meal',
          meal_slot: order.meal_slot || 'lunch',
          diet_tags: order.meal_diet_tags || [],
          ingredients: order.ingredients || [],
          total_portions: 0,
          status_counts: { queued: 0, preparing: 0, ready: 0, dispatched: 0 },
          order_ids: [], orders: [],
        };
      }
      const item = map[key];
      item.total_portions += 1;
      const st = order.kitchen_status || 'queued';
      if (item.status_counts[st] !== undefined) item.status_counts[st] += 1;
      item.order_ids.push(order.id);
      item.orders.push(order);
    });
    return Object.values(map).sort((a, b) => b.total_portions - a.total_portions);
  }, [filteredOrders]);

  const overallCounts = useMemo(() => {
    const c = { queued: 0, preparing: 0, ready: 0, dispatched: 0 };
    filteredOrders.forEach(o => { const st = o.kitchen_status || 'queued'; if (c[st] !== undefined) c[st]++; });
    return c;
  }, [filteredOrders]);

  const totalPortions = filteredOrders.length;
  const uniquePatients = useMemo(() => new Set(filteredOrders.map(o => o.patient_id || o.patient_name)).size, [filteredOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/update_status/`, { kitchen_status: newStatus });
      toast.success(`→ ${newStatus.toUpperCase()}`);
      fetchOrders();
    } catch { toast.error('Update failed'); }
    finally { setUpdatingId(null); }
  };

  const handleBulkUpdate = async (batchKey, orderIds, newStatus) => {
    if (!orderIds?.length) return;
    setUpdatingBatchKey(batchKey);
    try {
      await api.post('/orders/bulk_update_status/', { order_ids: orderIds, kitchen_status: newStatus });
      toast.success(`Bulk updated ${orderIds.length} portions → ${newStatus.toUpperCase()}!`);
      fetchOrders();
    } catch {
      try {
        await Promise.all(orderIds.map(id => api.patch(`/orders/${id}/update_status/`, { kitchen_status: newStatus })));
        toast.success(`Updated ${orderIds.length} portions!`);
        fetchOrders();
      } catch { toast.error('Bulk update failed'); }
    } finally { setUpdatingBatchKey(null); }
  };

  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;

  /* ─── Current session detection ─── */
  const currentHour = new Date().getHours();
  const currentSession = currentHour < 11 ? 'breakfast' : currentHour < 16 ? 'lunch' : 'dinner';
  const sessionCfg = SESSION_CONFIG[currentSession];

  return (
    <div style={{ paddingBottom: 48 }}>

      {/* ═══ PAGE HEADER ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '18px 24px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>🧑‍🍳</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
              Kitchen Command Center
            </h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
              Live meal production pipeline · Tray fulfillment · Ward delivery management
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Live clock */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>🕐 Live Time</div>
            <LiveClock />
          </div>

          {/* Active session chip */}
          <div style={{ background: `${sessionCfg.color}15`, border: `1px solid ${sessionCfg.color}40`, borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: sessionCfg.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 1 }}>Active Session</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: sessionCfg.color }}>
              {sessionCfg.icon} {sessionCfg.label}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{sessionCfg.time}</div>
          </div>

          <button onClick={() => setShowPrintModal(true)}
            style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 9, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            📋 Chef Prep Sheet
          </button>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            style={{
              background: refreshing ? '#94a3b8' : '#4f46e5',
              color: '#fff', border: 'none', borderRadius: 9,
              padding: '9px 16px', fontWeight: 700, fontSize: 13,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Orders'}
          </button>
        </div>
      </div>

      {/* ═══ KPI BAR ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Portions', value: totalPortions, icon: '🍲', color: '#4f46e5', bg: '#ede9fe', border: '#c4b5fd' },
          { label: 'Patients Covered', value: uniquePatients, icon: '👥', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Awaiting Cook', value: overallCounts.queued, icon: '🍳', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          { label: 'In Preparation', value: overallCounts.preparing, icon: '🧑‍🍳', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Ready for Trays', value: overallCounts.ready, icon: '📦', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Dispatched', value: overallCounts.dispatched, icon: '🚚', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1.5px solid ${k.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{k.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.color, opacity: 0.8, marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ PIPELINE BAR ═══ */}
      <PipelineBar counts={overallCounts} />

      {/* ═══ FILTER & VIEW CONTROLS ═══ */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 18 }}>
        {/* Session row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: 4 }}>Session:</span>
            {[
              { id: 'breakfast', icon: '🌅', label: 'Breakfast', color: '#d97706' },
              { id: 'lunch',     icon: '☀️', label: 'Lunch',     color: '#059669' },
              { id: 'dinner',    icon: '🌙', label: 'Dinner',    color: '#7c3aed' },
              { id: '',          icon: '📋', label: 'All',       color: '#4f46e5' },
            ].map(s => (
              <button key={s.id} onClick={() => { setSessionFilter(s.id); setPage(1); }}
                style={{
                  border: `1.5px solid ${sessionFilter === s.id ? s.color : '#e2e8f0'}`,
                  background: sessionFilter === s.id ? s.color : '#ffffff',
                  color: sessionFilter === s.id ? '#fff' : '#374151',
                  borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 3 }}>
            {[
              { id: 'bulk',  label: '🍲 Bulk Cook View' },
              { id: 'trays', label: `📦 Tray Cards (${filteredOrders.length})` },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                style={{
                  borderRadius: 6, padding: '7px 14px', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  background: viewMode === v.id ? '#ffffff' : 'transparent',
                  color: viewMode === v.id ? '#4f46e5' : '#64748b',
                  boxShadow: viewMode === v.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status + search row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <button onClick={() => { setStatusFilter(''); setPage(1); }}
              style={{ border: `1.5px solid ${statusFilter === '' ? '#4f46e5' : '#e2e8f0'}`, background: statusFilter === '' ? '#4f46e5' : '#fff', color: statusFilter === '' ? '#fff' : '#374151', borderRadius: 7, padding: '5px 11px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              All ({orders.length})
            </button>
            {STATUS_ORDER.map(st => {
              const c = STATUS_CONFIG[st];
              return (
                <button key={st} onClick={() => { setStatusFilter(st); setPage(1); }}
                  style={{ border: `1.5px solid ${statusFilter === st ? c.color : '#e2e8f0'}`, background: statusFilter === st ? c.color : '#fff', color: statusFilter === st ? '#fff' : '#374151', borderRadius: 7, padding: '5px 11px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  {c.icon} {c.label} ({overallCounts[st]})
                </button>
              );
            })}
          </div>
          <input type="text" placeholder="🔍 Search meal, patient, ward, bed..."
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: '#f8fafc', width: 240, outline: 'none' }}
          />
          <input type="text" placeholder="Ward filter..."
            value={wardFilter} onChange={e => { setWardFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: '#f8fafc', width: 130, outline: 'none' }}
          />
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      {loading ? (
        <Loading text="Loading kitchen production queue..." />
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon="🍳" title="No Orders in Queue" desc="No orders match your current filters. Try clearing filters or switching sessions." />
      ) : viewMode === 'bulk' ? (
        /* ─── BULK COOK VIEW ─── */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              🔥 Batch Cooking Queue — {bulkMealSummary.length} Dishes · {totalPortions} Portions
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bulkMealSummary.map((mg, i) => (
              <BulkMealCard
                key={mg.key} mealGroup={mg} index={i}
                onBulkUpdate={handleBulkUpdate}
                onSingleUpdate={handleUpdateStatus}
                updatingId={updatingId}
                updatingBatchKey={updatingBatchKey}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ─── INDIVIDUAL TRAY CARDS VIEW ─── */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {paginatedOrders.map(order => (
              <TrayCard key={order.id} order={order} onUpdateStatus={handleUpdateStatus} updatingId={updatingId} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredOrders.length} pageSize={pageSize} />
        </>
      )}

      {/* ═══ CHEF PREP SHEET MODAL ═══ */}
      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 820, width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>📋 Kitchen Batch Prep Manifest</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Session: {sessionFilter ? sessionFilter.toUpperCase() : 'ALL'} · Generated: {new Date().toLocaleTimeString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🖨️ Print</button>
                <button onClick={() => setShowPrintModal(false)} style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Close</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Distinct Dishes', value: bulkMealSummary.length, color: '#4f46e5' },
                  { label: 'Total Portions', value: totalPortions, color: '#059669' },
                  { label: 'Total Patients', value: uniquePatients, color: '#d97706' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Batch cooking table */}
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 10 }}>Batch Cooking Summary</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 24 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    {['Recipe / Dish', 'Session', 'Portions', 'Wards', 'Status', 'Chef Sign-Off'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkMealSummary.map((m, i) => {
                    const wards = [...new Set(m.orders.map(o => o.ward).filter(Boolean))];
                    const allDone = m.status_counts.queued === 0 && m.status_counts.preparing === 0 && m.status_counts.ready === 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0f172a' }}>{m.meal_name}</td>
                        <td style={{ padding: '9px 12px', textTransform: 'capitalize', color: '#374151' }}>{m.meal_slot}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 800, color: '#4f46e5' }}>{m.total_portions}</td>
                        <td style={{ padding: '9px 12px', color: '#64748b' }}>{wards.join(', ') || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {allDone
                            ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>✅ Dispatched</span>
                            : <span style={{ color: '#d97706', fontWeight: 700, fontSize: 11 }}>⏳ In Progress</span>}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#94a3b8' }}>[ &nbsp;&nbsp;&nbsp; ] Cooked</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Patient distribution */}
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 10 }}>Patient Distribution Breakdown</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    {['Patient', 'Ward · Bed', 'Assigned Meal', 'Allergy Alert', 'Tray Code'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o, i) => {
                    const hasA = o.allergies && o.allergies.length > 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{o.patient_name}</td>
                        <td style={{ padding: '7px 10px', color: '#374151' }}>Ward {o.ward} · Bed {o.bed_no}</td>
                        <td style={{ padding: '7px 10px', color: '#374151' }}>{o.meal_name}</td>
                        <td style={{ padding: '7px 10px', color: hasA ? '#dc2626' : '#94a3b8', fontWeight: hasA ? 700 : 400 }}>
                          {hasA ? o.allergies.map(a => a.allergen_family || a.family).join(', ') : 'None'}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#4f46e5' }}>{o.tray_code}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
