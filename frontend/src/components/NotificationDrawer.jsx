/**
 * NotificationDrawer — slide-in panel listing all notifications for the
 * current user, grouped visually by read/unread, with category icons,
 * relative timestamps, and deep-link navigation.
 */
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

/* ── Category meta ─────────────────────────────────────────────────────── */
const CATEGORY_META = {
  patient:   { icon: '🏥', color: '#0284c7', label: 'Patient'       },
  meal_plan: { icon: '🍽', color: '#7c3aed', label: 'Meal Plan'     },
  sign_off:  { icon: '⚖️', color: '#059669', label: 'Sign-Off'      },
  kitchen:   { icon: '👨‍🍳', color: '#d97706', label: 'Kitchen'       },
  feedback:  { icon: '💬', color: '#0891b2', label: 'Feedback'      },
  request:   { icon: '📝', color: '#4f46e5', label: 'Change Request' },
  system:    { icon: '⚙️', color: '#64748b', label: 'System'        },
};

function getCategoryMeta(category) {
  return CATEGORY_META[category] || { icon: '🔔', color: '#6366f1', label: 'Notification' };
}

/* ── Single notification row ──────────────────────────────────────────── */
function NotifItem({ notif, onClose }) {
  const { markRead } = useNotifications();
  const navigate = useNavigate();
  const meta = getCategoryMeta(notif.category);

  const handleClick = () => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      onClose();
    }
  };

  return (
    <div
      className={`notif-item ${notif.is_read ? 'notif-item--read' : 'notif-item--unread'}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      {/* Unread dot */}
      {!notif.is_read && <span className="notif-item__dot" />}

      {/* Category icon */}
      <div
        className="notif-item__icon"
        style={{ background: meta.color + '18', color: meta.color }}
        title={meta.label}
      >
        {meta.icon}
      </div>

      {/* Content */}
      <div className="notif-item__body">
        <div className="notif-item__title">{notif.title}</div>
        <div className="notif-item__message">{notif.message}</div>
        <div className="notif-item__meta">
          <span
            className="notif-item__category"
            style={{ color: meta.color, background: meta.color + '15' }}
          >
            {meta.label}
          </span>
          <span className="notif-item__time">{notif.time_ago}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main drawer ──────────────────────────────────────────────────────── */
export default function NotificationDrawer() {
  const {
    notifications, unreadCount, drawerOpen,
    loading, closeDrawer, markAllRead,
  } = useNotifications();

  if (!drawerOpen) return null;

  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n =>  n.is_read);

  return (
    <>
      {/* Backdrop */}
      <div
        className="notif-backdrop"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside className="notif-drawer" role="dialog" aria-label="Notifications">
        {/* Header */}
        <div className="notif-drawer__header">
          <div className="notif-drawer__title">
            <span>🔔</span>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="notif-drawer__count">{unreadCount} new</span>
            )}
          </div>
          <div className="notif-drawer__actions">
            {unreadCount > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                id="notif-mark-all-btn"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
            <button
              className="notif-drawer__close"
              onClick={closeDrawer}
              aria-label="Close notifications"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="notif-drawer__body">
          {loading ? (
            <div className="notif-empty">
              <div className="spinner" />
              <p>Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty__icon">🎉</div>
              <p className="notif-empty__title">All caught up!</p>
              <p className="notif-empty__sub">No notifications yet.</p>
            </div>
          ) : (
            <>
              {/* Unread section */}
              {unread.length > 0 && (
                <section>
                  <div className="notif-section-label">New</div>
                  {unread.map(n => (
                    <NotifItem key={n.id} notif={n} onClose={closeDrawer} />
                  ))}
                </section>
              )}

              {/* Read section */}
              {read.length > 0 && (
                <section>
                  <div className="notif-section-label notif-section-label--muted">
                    Earlier
                  </div>
                  {read.map(n => (
                    <NotifItem key={n.id} notif={n} onClose={closeDrawer} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
