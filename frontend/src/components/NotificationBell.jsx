/**
 * NotificationBell — bell icon with animated unread badge.
 * Renders in the Sidebar; clicking opens the NotificationDrawer.
 */
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const { unreadCount, openDrawer } = useNotifications();

  return (
    <button
      id="notification-bell-btn"
      className={`notif-bell ${unreadCount > 0 ? 'notif-bell--active' : ''}`}
      onClick={openDrawer}
      title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
      aria-label="Open notifications"
    >
      <span className="notif-bell__icon">🔔</span>
      {unreadCount > 0 && (
        <span className="notif-bell__badge" aria-live="polite">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
