import { useState, useEffect, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function MealSessionBanner({
  activeSlot,
  onSlotChange,
  showArchive,
  onToggleArchive,
  onAutoAllotCurrentSession,
  autoAssigning = false,
}) {
  const [sessionData, setSessionData] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [serverTimeStr, setServerTimeStr] = useState('');
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Fetch session details from backend
  const fetchSessionInfo = async (simulatedSlot = null) => {
    try {
      const params = simulatedSlot ? { slot: simulatedSlot } : {};
      const res = await api.get('/meal-sessions/current/', { params });
      setSessionData(res.data);
      setRemainingSeconds(res.data.remaining_seconds || 0);
      setServerTimeStr(res.data.server_time || '');
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionInfo();

    // Poll every 60s for server time sync
    const pollInterval = setInterval(() => {
      fetchSessionInfo();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, []);

  // Live 1-second countdown ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          fetchSessionInfo();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  // Handle manual session switch
  const handleSelectSlot = (slot) => {
    if (onSlotChange) onSlotChange(slot);
  };

  // Fast forward / Advance session
  const handleManualAdvance = async () => {
    try {
      const res = await api.post('/meal-sessions/advance/');
      toast.success(res.data.message || 'Session advanced successfully', { icon: '⏭️' });
      await fetchSessionInfo();
      if (res.data.new_session?.slot && onSlotChange) {
        onSlotChange(res.data.new_session.slot);
      }
    } catch {
      toast.error('Failed to advance session');
    }
  };

  if (loading && !sessionData) {
    return null;
  }

  // Format seconds into HHh MMm SSs
  const formatTime = (s) => {
    if (s <= 0) return '00h 00m 00s';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const activeCfg = sessionData?.active_session;
  const nextCfg = sessionData?.next_session;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: '4px solid #4f46e5',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Top Bar: Live Hospital Clock & Session Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontSize: 26,
              width: 48,
              height: 48,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              boxShadow: '0 2px 6px rgba(99, 102, 241, 0.08)',
            }}
          >
            {activeCfg?.icon || '⏱️'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                {activeCfg?.name || 'Meal Planning Session'}
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#059669',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite',
                  }}
                />
                Active Session
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              Schedule: <strong style={{ color: '#0f172a' }}>{activeCfg?.start_time} – {activeCfg?.service_end}</strong> · Service Cutoff: <strong style={{ color: '#b45309', background: '#fef3c7', padding: '2px 7px', borderRadius: 6, border: '1px solid #fde68a' }}>{activeCfg?.cutoff_time}</strong> · <span style={{ color: '#475569' }}>{activeCfg?.prep_target}</span>
            </p>
          </div>
        </div>

        {/* Live Countdown & Advance Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              textAlign: 'right',
              padding: '8px 16px',
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.8 }}>
              Session Cutoff In
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
                fontFamily: 'monospace',
                color: remainingSeconds < 900 ? '#dc2626' : '#0284c7',
                letterSpacing: 1,
              }}
            >
              {formatTime(remainingSeconds)}
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleManualAdvance}
            title="Conclude current session and roll over to prepare the next meal session"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#eef2ff',
              borderColor: '#c7d2fe',
              color: '#4338ca',
              fontWeight: 700,
              fontSize: 12,
              padding: '9px 14px',
              borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            ⏭️ Conclude &amp; Prepare {nextCfg?.short_name || 'Next'} Session
          </button>
        </div>
      </div>

      {/* Middle Row: Session Selector Tabs & Operational Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Session Tabs: Morning, Lunch, Dinner */}
        <div style={{
          display: 'inline-flex',
          gap: 4,
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}>
          <button
            type="button"
            onClick={() => handleSelectSlot('breakfast')}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: activeSlot === 'breakfast' ? '1px solid #fde68a' : '1px solid transparent',
              background: activeSlot === 'breakfast' ? '#ffffff' : 'transparent',
              color: activeSlot === 'breakfast' ? '#b45309' : '#64748b',
              fontWeight: activeSlot === 'breakfast' ? 800 : 600,
              boxShadow: activeSlot === 'breakfast' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🌅 Morning (Breakfast)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSlot('lunch')}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: activeSlot === 'lunch' ? '1px solid #a7f3d0' : '1px solid transparent',
              background: activeSlot === 'lunch' ? '#ffffff' : 'transparent',
              color: activeSlot === 'lunch' ? '#047857' : '#64748b',
              fontWeight: activeSlot === 'lunch' ? 800 : 600,
              boxShadow: activeSlot === 'lunch' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ☀️ Afternoon (Lunch)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSlot('dinner')}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: activeSlot === 'dinner' ? '1px solid #ddd6fe' : '1px solid transparent',
              background: activeSlot === 'dinner' ? '#ffffff' : 'transparent',
              color: activeSlot === 'dinner' ? '#6d28d9' : '#64748b',
              fontWeight: activeSlot === 'dinner' ? 800 : 600,
              boxShadow: activeSlot === 'dinner' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🌙 Evening (Dinner)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSlot('')}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: !activeSlot ? '1px solid #c7d2fe' : '1px solid transparent',
              background: !activeSlot ? '#ffffff' : 'transparent',
              color: !activeSlot ? '#4338ca' : '#64748b',
              fontWeight: !activeSlot ? 800 : 600,
              boxShadow: !activeSlot ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            📋 All Sessions
          </button>
        </div>

        {/* Operational buttons: 1-Click Allot for this session + Archive toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onAutoAllotCurrentSession && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onAutoAllotCurrentSession(activeSlot || 'lunch')}
              disabled={autoAssigning}
              style={{
                background:
                  activeSlot === 'breakfast'
                    ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                    : activeSlot === 'dinner'
                    ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                padding: '8px 16px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              }}
            >
              {autoAssigning
                ? '🤖 Allotting Session...'
                : `⚡ 1-Click Allot for ${
                    activeSlot === 'breakfast'
                      ? 'Morning'
                      : activeSlot === 'dinner'
                      ? 'Dinner'
                      : activeSlot === 'lunch'
                      ? 'Lunch'
                      : 'Active Session'
                  }`}
            </button>
          )}

          {onToggleArchive && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onToggleArchive}
              style={{
                fontSize: 11.5,
                background: '#ffffff',
                color: showArchive ? '#4f46e5' : '#475569',
                borderColor: showArchive ? '#6366f1' : '#cbd5e1',
                fontWeight: 600,
                padding: '7px 12px',
                borderRadius: 8,
              }}
            >
              {showArchive ? '📂 Showing All Session History' : '📦 View Past Archived Sessions'}
            </button>
          )}
        </div>
      </div>

      {/* Next Session Preparation Pill */}
      {nextCfg && (
        <div
          style={{
            marginTop: 14,
            padding: '8px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 11.5,
            color: '#475569',
          }}
        >
          <span>
            Upcoming Next: <strong style={{ color: '#0f172a' }}>{nextCfg.icon} {nextCfg.name}</strong> (Service begins at {nextCfg.service_start || nextCfg.start_time})
          </span>
          <span style={{ color: '#64748b' }}>
            System auto-clears expired session records upon cutoff &amp; readies tray prep for {nextCfg.short_name}.
          </span>
        </div>
      )}
    </div>
  );
}