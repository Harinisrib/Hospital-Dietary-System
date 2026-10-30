import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState, Pagination } from '../../components/UI';

const RESULT_CONFIG = {
  matched:  { icon: '✅', label: 'MATCHED',  color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  missing:  { icon: '⚠️', label: 'MISSING',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  mismatch: { icon: '🚫', label: 'MISMATCH', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

/* ─── Live Clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function DeliveryLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterResult, setFilterResult] = useState('');
  const [searchCart, setSearchCart] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchLogs = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get('/delivery-logs/');
      const data = res.data.results || res.data || [];
      setLogs(data);
      if (isManual) toast.success(`Refreshed ${data.length} audit logs`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load delivery logs');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(false);
  }, [fetchLogs]);

  const filtered = logs.filter(item => {
    if (filterResult && item.scan_result !== filterResult) return false;
    if (searchCart) {
      const q = searchCart.toLowerCase();
      const matchCart = item.cart_id?.toLowerCase().includes(q);
      const matchTray = item.tray_code?.toLowerCase().includes(q);
      const matchPatient = item.patient_name?.toLowerCase().includes(q);
      const matchNote = item.staff_note?.toLowerCase().includes(q);
      if (!matchCart && !matchTray && !matchPatient && !matchNote) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedLogs = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalMatched  = logs.filter(l => l.scan_result === 'matched').length;
  const totalMissing  = logs.filter(l => l.scan_result === 'missing').length;
  const totalMismatch = logs.filter(l => l.scan_result === 'mismatch').length;
  const matchRate = logs.length > 0 ? Math.round((totalMatched / logs.length) * 100) : 0;

  return (
    <div style={{ paddingBottom: 48, maxWidth: 1180, margin: '0 auto' }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
        padding: '20px 24px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #059669, #0d9488)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff',
          }}>📋</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Delivery &amp; Barcode Audit Trail
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Permanent hospital record of tray barcode scans, departures, and staff accountability sign-offs
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Time</div>
            <LiveClock />
          </div>

          <div style={{
            background: matchRate >= 90 ? '#f0fdf4' : matchRate >= 70 ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${matchRate >= 90 ? '#bbf7d0' : matchRate >= 70 ? '#fde68a' : '#fecaca'}`,
            borderRadius: 10, padding: '8px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Accuracy</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: matchRate >= 90 ? '#059669' : matchRate >= 70 ? '#d97706' : '#dc2626' }}>
              {matchRate}%
            </div>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            style={{
              background: refreshing ? '#94a3b8' : '#4f46e5',
              color: '#ffffff', border: 'none', borderRadius: 10,
              padding: '10px 16px', fontWeight: 700, fontSize: 13,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
              transition: 'all 0.15s',
            }}
          >
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Log'}
          </button>
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Scans Logged', value: logs.length, icon: '📊', color: '#4f46e5', bg: '#ede9fe', border: '#c4b5fd' },
          { label: 'Matched (Safe)', value: totalMatched, icon: '✅', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Missing Trays', value: totalMissing, icon: '⚠️', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          { label: 'Mismatched Trays', value: totalMismatch, icon: '🚫', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ FILTERS ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '14px 18px', marginBottom: 18,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            type="text"
            placeholder="🔍 Search cart, tray code, patient, or staff note..."
            value={searchCart}
            onChange={e => { setSearchCart(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '9px 13px', borderRadius: 8,
              border: '1.5px solid #cbd5e1', fontSize: 12,
              color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: '', label: `All (${logs.length})`, color: '#4f46e5', bg: '#ede9fe' },
            { id: 'matched', label: `✅ Matched (${totalMatched})`, color: '#059669', bg: '#f0fdf4' },
            { id: 'missing', label: `⚠️ Missing (${totalMissing})`, color: '#d97706', bg: '#fffbeb' },
            { id: 'mismatch', label: `🚫 Mismatch (${totalMismatch})`, color: '#dc2626', bg: '#fef2f2' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setFilterResult(f.id); setPage(1); }}
              style={{
                border: `1.5px solid ${filterResult === f.id ? f.color : '#e2e8f0'}`,
                background: filterResult === f.id ? f.color : '#ffffff',
                color: filterResult === f.id ? '#ffffff' : '#334155',
                borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 11, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>
          Showing {filtered.length} logs
        </div>
      </div>

      {/* ═══ LOGS TABLE ═══ */}
      {loading ? (
        <Loading text="Loading verified delivery audit records..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🚚"
          title="No Delivery Logs Found"
          desc="Perform tray barcode scans in the QR Scan page to record verification entries."
        />
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Log #', 'Cart ID', 'Tray Code', 'Patient', 'Scan Outcome', 'Staff Accountability Note', 'Timestamp'].map(h => (
                    <th key={h} style={{
                      padding: '11px 14px', textAlign: 'left', fontSize: 10,
                      fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                      borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, i) => {
                  const rc = RESULT_CONFIG[log.scan_result] || RESULT_CONFIG.matched;
                  const isIssue = log.scan_result !== 'matched';
                  const note = log.staff_note || '';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isIssue ? (log.scan_result === 'mismatch' ? '#fef2f2' : '#fffbeb') : (i % 2 === 0 ? '#ffffff' : '#fcfcfd'),
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                        #{log.id}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: 11,
                          color: '#1e293b', background: '#f1f5f9',
                          border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px',
                        }}>
                          {log.cart_id || 'CART-001'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#4f46e5' }}>
                        {log.tray_code || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {log.patient_name || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, padding: '3px 8px', borderRadius: 12,
                          fontWeight: 800, whiteSpace: 'nowrap',
                          background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                        }}>
                          {rc.icon} {rc.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 300 }}>
                        {note ? (
                          <div style={{
                            background: '#fff7ed', border: '1px solid #fed7aa',
                            borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#7c2d12',
                            lineHeight: 1.4,
                          }}>
                            ✍️ {note}
                          </div>
                        ) : isIssue ? (
                          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ Unacknowledged variance
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Verified Safe</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {log.delivered_at
                          ? new Date(log.delivered_at).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            borderTop: '1px solid #f1f5f9', padding: '12px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Page {page} of {totalPages} ({filtered.length} total records)
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={pageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
}
