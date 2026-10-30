import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

/* ─── Helpers ─────────────────────────────────────────────────── */
const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});

const WARD_THEMES = {
  A: { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe', bar: '#4f46e5' },
  B: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', bar: '#059669' },
  C: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', bar: '#d97706' },
  D: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', bar: '#dc2626' },
  E: { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', bar: '#0284c7' },
  F: { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff', bar: '#7c3aed' },
  G: { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8', bar: '#db2777' },
  H: { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4', bar: '#0d9488' },
};
const getWardTheme = (w) => WARD_THEMES[w?.[0]?.toUpperCase()] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', bar: '#64748b' };

/* ═══════════════════════════════════════════════════════════════
   ACCOUNTABILITY MODAL
═══════════════════════════════════════════════════════════════ */
function AccountabilityModal({ issues, cartId, defaultStaff, onConfirm, onClose }) {
  const [staffName, setStaffName] = useState(defaultStaff || '');
  const [reasonPreset, setReasonPreset] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!defaultStaff && nameRef.current) nameRef.current.focus();
  }, [defaultStaff]);

  const mismatches = issues.filter(r => r.result === 'mismatch');
  const missing = issues.filter(r => r.result === 'missing');

  const finalReason = reasonPreset === 'other' || !reasonPreset 
    ? reasonCustom 
    : (reasonCustom ? `${reasonPreset} — ${reasonCustom}` : reasonPreset);

  const handleConfirm = async () => {
    if (!staffName.trim()) return toast.error('Please enter the responsible staff member’s name');
    if (!finalReason.trim()) return toast.error('Please provide a reason or select an explanation');
    if (!agreed) return toast.error('You must formally accept responsibility to proceed');

    setBusy(true);
    try {
      await api.post('/delivery-logs/batch_scan/', {
        cart_id: cartId,
        tray_codes: issues.map(r => r.tray_code),
        staff_note: `ACKNOWLEDGED BY: ${staffName.trim()} | REASON: ${finalReason.trim()}`,
      }).catch(() => null);
    } finally {
      setBusy(false);
      onConfirm({ staffName: staffName.trim(), reason: finalReason.trim() });
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 580,
        boxShadow: '0 25px 70px rgba(0,0,0,0.3)', overflow: 'hidden',
        border: '1px solid #fecaca', animation: 'fadeIn 0.15s ease-out',
      }}>
        {/* Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          padding: '20px 24px', color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
            }}>🚨</div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px' }}>
                Cart Locked — Discrepancy Found
              </div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                Cart <strong>{cartId}</strong> cannot depart until kitchen staff formally acknowledges the variance.
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Discrepancy List */}
          <div style={{ display: 'grid', gridTemplateColumns: mismatches.length > 0 && missing.length > 0 ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 16 }}>
            {mismatches.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  🚫 {mismatches.length} Wrong / Unrecognized Tray{mismatches.length > 1 ? 's' : ''}
                </div>
                <div style={{ maxHeight: 110, overflowY: 'auto' }}>
                  {mismatches.map((r, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#7f1d1d', padding: '3px 0', borderBottom: '1px dashed #fecaca' }}>
                      <strong style={{ fontFamily: 'monospace' }}>{r.tray_code}</strong>
                      {r.patient_name && r.patient_name !== 'Unknown' && ` (${r.patient_name})`}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {missing.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 800, color: '#d97706', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  ⚠️ {missing.length} Missing Tray{missing.length > 1 ? 's' : ''}
                </div>
                <div style={{ maxHeight: 110, overflowY: 'auto' }}>
                  {missing.map((r, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#78350f', padding: '3px 0', borderBottom: '1px dashed #fde68a' }}>
                      <strong style={{ fontFamily: 'monospace' }}>{r.tray_code}</strong>
                      {r.patient_name && ` (${r.patient_name})`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Kitchen Staff Member Taking Responsibility *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              placeholder="Full name of staff member"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9,
                border: '1.5px solid #cbd5e1', fontSize: 13,
                color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Explanation / Root Cause *
            </label>
            <select
              value={reasonPreset}
              onChange={e => {
                setReasonPreset(e.target.value);
                if (e.target.value !== 'other' && !reasonCustom) setReasonCustom('');
              }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9,
                border: '1.5px solid #cbd5e1', fontSize: 13,
                color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', marginBottom: 8, outline: 'none',
              }}
            >
              <option value="">-- Choose reason or write below --</option>
              <option value="Tray verified manually and placed on cart; barcode label scratched">Tray verified manually and placed on cart; barcode label scratched</option>
              <option value="Patient transferred to another ward; tray intentionally reassigned">Patient transferred to another ward; tray intentionally reassigned</option>
              <option value="Extra tray prepared by chef for emergency admission">Extra tray prepared by chef for emergency admission</option>
              <option value="Missing tray held back in kitchen for special dietary preparation">Missing tray held back in kitchen for special dietary preparation</option>
              <option value="other">Other custom reason (type below)</option>
            </select>
            <textarea
              rows={2}
              value={reasonCustom}
              onChange={e => setReasonCustom(e.target.value)}
              placeholder="Provide specific details about this discrepancy..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9,
                border: '1.5px solid #cbd5e1', fontSize: 12,
                color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {/* Legal sign-off agreement */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10,
            padding: '12px 14px', cursor: 'pointer', marginBottom: 18,
          }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#dc2626', width: 17, height: 17, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, color: '#7f1d1d', lineHeight: 1.5 }}>
              I, <strong>{staffName || '(Staff Name)'}</strong>, hereby certify that I have verified the physical cart,
              accept full operational accountability for this variance, and authorize cart departure.
              This acknowledgement is <strong>permanently stamped into the hospital delivery audit log</strong>.
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '11px', background: '#f1f5f9', color: '#475569',
                border: '1px solid #cbd5e1', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              ← Hold Cart & Fix Trays
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              style={{
                flex: 1.5, padding: '11px', background: busy ? '#94a3b8' : '#dc2626', color: '#ffffff',
                border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
              }}
            >
              {busy ? '⏳ Recording Stamp...' : '✍️ Accept Responsibility & Clear Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN QR DISPATCH COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function BatchScanPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [activeTab, setActiveTab] = useState('scan'); // 'manifest' | 'scan' | 'results'

  // Scan state
  const [cartId, setCartId] = useState('CART-001');
  const [scannedInput, setScannedInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Result state
  const [scanResult, setScanResult] = useState(null);
  const [lastCartId, setLastCartId] = useState('');
  const [lastWard, setLastWard] = useState('');
  const [acknowledgement, setAcknowledgement] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingData, setPendingData] = useState(null);

  // Load all dispatched kitchen orders
  const fetchDispatched = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/orders/', { params: { kitchen_status: 'dispatched' } });
      const data = res.data.results || res.data || [];
      setOrders(data);
      if (isManual) toast.success(`Refreshed ${data.length} dispatched trays!`);
    } catch {
      toast.error('Failed to load kitchen dispatched orders');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDispatched(false);
  }, [fetchDispatched]);

  // Grouping
  const byWard = groupBy(orders, 'ward');
  const wardList = Object.keys(byWard).sort();

  const displayedOrders = selectedWard === 'ALL'
    ? orders
    : (byWard[selectedWard] || []);

  // Auto-load codes
  const handleAutoLoad = (ward = selectedWard) => {
    const target = ward === 'ALL' ? orders : (byWard[ward] || []);
    if (!target.length) {
      toast('No dispatched trays in this selection', { icon: 'ℹ️' });
      return;
    }
    const codes = target.map(o => o.tray_code).join('\n');
    setScannedInput(codes);
    toast.success(`Loaded ${target.length} tray codes for ${ward === 'ALL' ? 'all wards' : `Ward ${ward}`}`);
  };

  // Inject a fake mismatch code for quick testing
  const handleTestMismatch = () => {
    const fake = `TRAY-FAKE-${Math.floor(1000 + Math.random() * 9000)}`;
    setScannedInput(prev => prev ? `${prev}\n${fake}` : fake);
    toast('Added fake mismatch barcode for testing', { icon: '🧪' });
  };

  // Perform Scan Verification
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const codes = scannedInput.split(/[\n,\s]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
    if (!codes.length) {
      toast.error('Scan or enter at least one tray code');
      return;
    }

    setVerifying(true);
    try {
      const payload = {
        cart_id: cartId.trim() || 'CART-001',
        ward: selectedWard,
        tray_codes: codes,
      };

      const res = await api.post('/delivery-logs/batch_scan/', payload);
      const data = res.data;
      const issues = data.results.filter(r => r.result !== 'matched');

      if (issues.length > 0) {
        // Discrepancy -> trigger Accountability Modal
        setPendingData({ data, cartId: payload.cart_id, ward: selectedWard });
        setShowModal(true);
      } else {
        // Perfect match
        setScanResult(data);
        setLastCartId(payload.cart_id);
        setLastWard(selectedWard);
        setAcknowledgement(null);
        setActiveTab('results');
        toast.success(`✅ All ${data.summary.matched} trays verified! Cart cleared for departure.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification request failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleModalConfirm = ({ staffName, reason }) => {
    setShowModal(false);
    setScanResult(pendingData.data);
    setLastCartId(pendingData.cartId);
    setLastWard(pendingData.ward);
    setAcknowledgement({ staffName, reason });
    setActiveTab('results');
    toast(`⚠️ Cart dispatched under responsibility of ${staffName}`, { icon: '📋', duration: 4000 });
  };

  const handleReset = () => {
    setScanResult(null);
    setAcknowledgement(null);
    setScannedInput('');
    setActiveTab('scan');
  };

  const totalScanned = scannedInput.split(/[\n,\s]+/).filter(c => c.trim()).length;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 50 }}>

      {/* Accountability Modal */}
      {showModal && pendingData && (
        <AccountabilityModal
          issues={pendingData.data.results.filter(r => r.result !== 'matched')}
          cartId={pendingData.cartId}
          defaultStaff={user?.full_name || user?.username || ''}
          onConfirm={handleModalConfirm}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
        padding: '20px 24px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff',
          }}>📷</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              QR Scan &amp; Ward Dispatch
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Instant barcode verification for meal carts · Mandatory staff accountability on variances
            </p>
          </div>
        </div>

        {/* Global KPIs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Ready to Dispatch</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>{loading ? '…' : orders.length}</div>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Active Wards</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8', lineHeight: 1.1 }}>{wardList.length}</div>
          </div>
          <button
            onClick={() => fetchDispatched(true)}
            disabled={refreshing}
            style={{
              background: refreshing ? '#e2e8f0' : '#f8fafc',
              border: '1px solid #cbd5e1', borderRadius: 10,
              padding: '10px 16px', fontSize: 13, fontWeight: 700,
              color: refreshing ? '#94a3b8' : '#334155',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Trays'}
          </button>
        </div>
      </div>

      {/* ═══ NAVIGATION TABS & WARD FILTER BAR ═══ */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '12px 18px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
          {[
            { id: 'scan', label: '📷 Scan & Dispatch', badge: null },
            { id: 'manifest', label: '📦 Tray Manifest', badge: displayedOrders.length },
            { id: 'results', label: '✅ Verification Results', badge: scanResult ? scanResult.results.length : null, disabled: !scanResult },
          ].map(tab => (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                background: activeTab === tab.id ? '#ffffff' : 'transparent',
                color: tab.disabled ? '#94a3b8' : activeTab === tab.id ? '#4f46e5' : '#475569',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {tab.badge !== null && (
                <span style={{
                  background: activeTab === tab.id ? '#ede9fe' : '#e2e8f0',
                  color: activeTab === tab.id ? '#6366f1' : '#64748b',
                  fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 10,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Ward Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ward Filter:</span>
          <button
            onClick={() => setSelectedWard('ALL')}
            style={{
              border: `1.5px solid ${selectedWard === 'ALL' ? '#4f46e5' : '#e2e8f0'}`,
              background: selectedWard === 'ALL' ? '#4f46e5' : '#ffffff',
              color: selectedWard === 'ALL' ? '#ffffff' : '#334155',
              borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            All Wards ({orders.length})
          </button>
          {wardList.map(w => {
            const count = (byWard[w] || []).length;
            const theme = getWardTheme(w);
            const active = selectedWard === w;
            return (
              <button
                key={w}
                onClick={() => setSelectedWard(w)}
                style={{
                  border: `1.5px solid ${active ? theme.bar : '#e2e8f0'}`,
                  background: active ? theme.bar : '#ffffff',
                  color: active ? '#ffffff' : theme.text,
                  borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Ward {w} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAB 1: SCAN & DISPATCH (Default)
      ═══════════════════════════════════════════════ */}
      {activeTab === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>

          {/* Left: Input Form */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
            padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  ⚡ Meal Cart Barcode Scanner
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Scan tray QR labels into the box below or use Auto-Load for Ward {selectedWard}
                </div>
              </div>
              <span style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '4px 10px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5',
              }}>
                Target: {selectedWard === 'ALL' ? 'All Wards' : `Ward ${selectedWard}`}
              </span>
            </div>

            <form onSubmit={handleVerify}>
              {/* Cart ID */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Delivery Cart Identifier *
                </label>
                <input
                  type="text"
                  value={cartId}
                  onChange={e => setCartId(e.target.value)}
                  placeholder="e.g. CART-001, CART-WARD-A"
                  required
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700,
                    fontFamily: 'monospace', color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>

              {/* Scanned Barcodes */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Scanned Tray Barcodes (one per line) *
                  </label>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: totalScanned > 0 ? '#4f46e5' : '#94a3b8',
                    background: totalScanned > 0 ? '#ede9fe' : '#f1f5f9',
                    borderRadius: 12, padding: '2px 8px',
                  }}>
                    {totalScanned} Trays Input
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={scannedInput}
                  onChange={e => setScannedInput(e.target.value)}
                  placeholder={'TRAY-A101\nTRAY-A102\n...'}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 9,
                    border: '1.5px solid #cbd5e1', fontSize: 12, fontFamily: 'monospace',
                    color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box',
                    resize: 'vertical', outline: 'none', lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={() => handleAutoLoad(selectedWard)}
                  style={{
                    background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                    borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  📋 Auto-Load {selectedWard === 'ALL' ? `All (${orders.length})` : `Ward ${selectedWard} (${displayedOrders.length})`}
                </button>
                <button
                  type="button"
                  onClick={handleTestMismatch}
                  style={{
                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                    borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  🧪 Test Mismatch Trigger
                </button>
                <button
                  type="button"
                  onClick={() => setScannedInput('')}
                  style={{
                    background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1',
                    borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✕ Clear
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={verifying}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                  background: verifying ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: verifying ? 'not-allowed' : 'pointer',
                  boxShadow: verifying ? 'none' : '0 4px 14px rgba(79,70,229,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {verifying ? (
                  <>⏳ Verifying Against Kitchen Database...</>
                ) : (
                  <>⚡ Verify Cart &amp; Authorize Dispatch ({totalScanned} Trays)</>
                )}
              </button>
            </form>
          </div>

          {/* Right: Real-time Expected List & Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Guide Card */}
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
              padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                🛡️ Three-Tier Safety Verification
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 15 }}>✅</span>
                  <div>
                    <strong style={{ color: '#15803d' }}>MATCHED:</strong> Confirmed dispatched meal. Clear to load onto cart.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 15 }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#d97706' }}>MISSING:</strong> Expected tray left behind in kitchen staging.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 15 }}>🚫</span>
                  <div>
                    <strong style={{ color: '#dc2626' }}>MISMATCH:</strong> Unrecognized tray or wrong ward. <strong>Blocks cart departure</strong> until formal sign-off.
                  </div>
                </div>
              </div>
            </div>

            {/* Expected Trays Roster */}
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
              padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flex: 1,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  📋 Dispatched Trays Waiting ({displayedOrders.length})
                </h4>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {selectedWard === 'ALL' ? 'All Wards' : `Ward ${selectedWard}`}
                </span>
              </div>

              {displayedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 12 }}>
                  No dispatched orders found for this selection.
                </div>
              ) : (
                <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {displayedOrders.slice(0, 30).map((o, idx) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>
                            {o.tray_code}
                          </td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1e293b' }}>
                            {o.patient_name}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>
                            W{o.ward} · B{o.bed_no || o.bed_number || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayedOrders.length > 30 && (
                    <div style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, color: '#64748b', background: '#f8fafc' }}>
                      + {displayedOrders.length - 30} more trays
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2: TRAY MANIFEST (With QR Visuals)
      ═══════════════════════════════════════════════ */}
      {activeTab === 'manifest' && (
        <div>
          {displayedOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
              <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No Dispatched Trays</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                Move orders to 'Dispatched' in the Kitchen Queue to generate barcodes for delivery.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
              {displayedOrders.map(order => {
                const theme = getWardTheme(order.ward);
                const hasA = order.allergies && order.allergies.length > 0;
                return (
                  <div
                    key={order.id}
                    style={{
                      background: '#ffffff', border: `1.5px solid ${theme.border}`,
                      borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    {/* Header Strip */}
                    <div style={{
                      background: theme.bg, padding: '7px 12px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: `1px solid ${theme.border}`,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: theme.text }}>
                        Ward {order.ward} · Bed {order.bed_no || order.bed_number || '—'}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#fff', background: theme.bar,
                        borderRadius: 8, padding: '1px 6px', textTransform: 'uppercase',
                      }}>
                        {order.meal_slot || 'Meal'}
                      </span>
                    </div>

                    {/* QR Code / Placeholder */}
                    <div style={{ padding: '12px', textAlign: 'center', background: '#fafbfc' }}>
                      {order.qr_image_url ? (
                        <img
                          src={order.qr_image_url}
                          alt={order.tray_code}
                          style={{ width: 78, height: 78, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff' }}
                        />
                      ) : (
                        <div style={{
                          width: 78, height: 78, margin: '0 auto', background: '#fff',
                          border: '1.5px dashed #cbd5e1', borderRadius: 6,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 20 }}>📱</span>
                          <span style={{ fontSize: 7, fontFamily: 'monospace', color: '#94a3b8', marginTop: 2 }}>QR</span>
                        </div>
                      )}
                      <div style={{
                        marginTop: 6, fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                        color: theme.text, background: '#fff', border: `1px solid ${theme.border}`,
                        borderRadius: 4, padding: '2px 6px', display: 'inline-block',
                      }}>
                        {order.tray_code}
                      </div>
                    </div>

                    {/* Patient & Meal */}
                    <div style={{ padding: '10px 12px', flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{order.patient_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>{order.meal_name}</div>
                      {hasA && (
                        <div style={{
                          marginTop: 6, fontSize: 10, color: '#dc2626', fontWeight: 700,
                          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 6px',
                        }}>
                          ⚠️ {order.allergies.map(a => a.allergen_family || a.family).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3: VERIFICATION RESULTS
      ═══════════════════════════════════════════════ */}
      {activeTab === 'results' && scanResult && (
        <div>
          {/* Accountability Banner if signed */}
          {acknowledgement && (
            <div style={{
              background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12,
              padding: '14px 18px', marginBottom: 16,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 24 }}>✍️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#c2410c' }}>
                  Accountability Stamped &amp; Authorized
                </div>
                <div style={{ fontSize: 12, color: '#7c2d12', marginTop: 2 }}>
                  Staff member <strong>{acknowledgement.staffName}</strong> accepted full responsibility for this cart:
                  <em> "{acknowledgement.reason}"</em>
                </div>
                <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>
                  Permanently recorded in the hospital audit trail.
                </div>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Verified & Matched', count: scanResult.summary.matched, icon: '✅', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'Missing From Cart', count: scanResult.summary.missing, icon: '⚠️', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
              { label: 'Mismatched / Blocked', count: scanResult.summary.mismatch, icon: '🚫', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              { label: 'Total Checked', count: scanResult.summary.scanned, icon: '📊', color: '#4f46e5', bg: '#ede9fe', border: '#c4b5fd' },
            ].map(m => (
              <div key={m.label} style={{
                background: m.bg, border: `1.5px solid ${m.border}`, borderRadius: 12,
                padding: '14px 18px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, marginBottom: 2 }}>{m.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.count}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Cart Status Strip */}
          <div style={{
            background: scanResult.summary.mismatch === 0 && scanResult.summary.missing === 0 ? '#f0fdf4' : '#fff7ed',
            border: `1px solid ${scanResult.summary.mismatch === 0 && scanResult.summary.missing === 0 ? '#bbf7d0' : '#fed7aa'}`,
            borderRadius: 12, padding: '12px 18px', marginBottom: 18,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: scanResult.summary.mismatch === 0 && scanResult.summary.missing === 0 ? '#15803d' : '#c2410c' }}>
              {scanResult.summary.mismatch === 0 && scanResult.summary.missing === 0
                ? '✅ Cart Cleared for Delivery: All trays verified safe and ready.'
                : '⚠️ Cart Cleared with Exceptions: Variances recorded and signed off.'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
              Cart: <strong>{lastCartId}</strong> {lastWard && lastWard !== 'ALL' ? `(Ward ${lastWard})` : ''}
            </div>
          </div>

          {/* Results Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
              Detailed Scan Roster ({scanResult.results.length} items)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tray Code', 'Patient', 'Ward · Bed', 'Meal', 'Verification', 'Status Note'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scanResult.results.map((r, i) => {
                    const isM = r.result === 'matched';
                    const isMs = r.result === 'missing';
                    const badge = isM
                      ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: '✅ MATCHED' }
                      : isMs
                      ? { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: '⚠️ MISSING' }
                      : { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: '🚫 MISMATCH' };

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: isM ? '#ffffff' : badge.bg }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          {r.tray_code}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                          {r.patient_name || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {r.ward ? `W${r.ward} · B${r.bed_number || '—'}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {r.meal_name || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                            borderRadius: 12, padding: '3px 9px', fontSize: 11, fontWeight: 800,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#475569' }}>
                          {r.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                background: '#4f46e5', color: '#ffffff', border: 'none',
                borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🔄 Scan Another Delivery Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
