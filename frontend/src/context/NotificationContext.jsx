/**
 * NotificationContext — provides notifications, unread count, and actions
 * to the entire app. Polls /api/notifications/unread_count/ every 30 s
 * to keep the bell badge fresh. Full list is fetched lazily when the
 * drawer opens.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [loading, setLoading]               = useState(false);
  const pollRef = useRef(null);

  // ── Poll unread count every 30 s ────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/unread_count/');
      setUnreadCount(data.count ?? 0);
    } catch {
      // Silent — do not spam the console on auth failures / server down
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(pollRef.current);
  }, [user, fetchUnreadCount]);

  // ── Fetch full list (called when drawer opens) ───────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/');
      // Handle DRF pagination or plain array
      setNotifications(Array.isArray(data) ? data : (data.results ?? []));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ── Mark single notification read ────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    try {
      await api.post(`/notifications/${id}/mark_read/`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, []);

  // ── Mark all read ─────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      drawerOpen,
      loading,
      openDrawer,
      closeDrawer,
      markRead,
      markAllRead,
      refresh: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
