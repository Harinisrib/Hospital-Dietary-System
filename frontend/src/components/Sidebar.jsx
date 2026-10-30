import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import NotificationBell from './NotificationBell';
import NotificationDrawer from './NotificationDrawer';

const NAV_CONFIG = {
  doctor: [
    { to: '/doctor/patients',       label: 'Patients & Requests', icon: '👤' },
    { to: '/doctor/allergies',      label: 'Allergy Records',     icon: '⚠️' },
  ],
  dietitian: [
    { to: '/clinical/ai-planner',   label: 'AI Meal Planner',     icon: '🤖' },
    { to: '/clinical/audit-queue',  label: 'Review & Sign-Off',   icon: '⚖️' },
    { to: '/clinical/feedback',     label: 'Patient Feedback',    icon: '💬' },
    { to: '/clinical/meals',        label: 'Therapeutic Meals',   icon: '📋' },
    { to: '/doctor/patients',       label: 'Patient Directory',   icon: '👤' },
  ],
  patient: [
    { to: '/patient/dashboard', label: 'Patient Dashboard', icon: '👤' },
    { to: '/patient/menu',      label: 'My Daily Menu',     icon: '🥗' },
  ],
  kitchen: [
    { to: '/kitchen/dashboard',    label: 'Live Dashboard',       icon: '📊' },
    { to: '/kitchen/orders',       label: 'Kitchen Queue',        icon: '🍳' },
    { to: '/kitchen/scan',         label: 'QR Scan & Dispatch',   icon: '📷' },
    { to: '/kitchen/delivery-log', label: 'Delivery Audit Log',   icon: '📋' },
  ],
  admin: [
    { to: '/admin/analytics',  label: 'Analytics',     icon: '📊' },
    { to: '/admin/audit',      label: 'Audit Log',     icon: '🔍' },
    { to: '/admin/delivery',   label: 'Delivery Log',  icon: '🚚' },
    { to: '/clinical/ai-planner', label: 'AI Planner', icon: '🤖' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const navItems = NAV_CONFIG[user?.role] || [];
  const initials = (user?.full_name || user?.username || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🏥 Dietary Portal</h1>
          <p>AEARM — Allergy Risk System</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user?.full_name || user?.username}</div>
              <div className="user-role">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Notification Bell */}
          <NotificationBell />

          <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Drawer rendered outside <aside> so it can overlay full viewport */}
      <NotificationDrawer />
    </>
  );
}
