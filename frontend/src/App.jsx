import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Sidebar from './components/Sidebar';

// Pages
import LoginPage from './pages/LoginPage';
import PatientsPage from './pages/doctor/PatientsPage';
import AllergiesPage from './pages/doctor/AllergiesPage';
import MealPlansPage from './pages/dietitian/MealPlansPage';
import SignOffPage from './pages/dietitian/SignOffPage';
import MealsPage from './pages/dietitian/MealsPage';
import PatientMenuPage from './pages/patient/PatientMenuPage';
import PatientDashboardPage from './pages/patient/PatientDashboardPage';
import PatientFeedbackPage from './pages/dietitian/PatientFeedbackPage';
import OrdersPage from './pages/kitchen/OrdersPage';
import BatchScanPage from './pages/kitchen/BatchScanPage';
import DeliveryLogPage from './pages/kitchen/DeliveryLogPage';
import KitchenDashboard from './pages/kitchen/KitchenDashboard';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import AuditLogPage from './pages/admin/AuditLogPage';

import AiMealPlannerPage from './pages/clinical/AiMealPlannerPage';

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function RoleHomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const homeMap = {
    doctor: '/doctor/patients',
    dietitian: '/clinical/ai-planner',
    patient: '/patient/dashboard',
    kitchen: '/kitchen/dashboard',
    admin: '/admin/analytics',
  };

  return <Navigate to={homeMap[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
            },
          }}
        />

        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes inside AppLayout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<RoleHomeRedirect />} />

            {/* Doctor Routes */}
            <Route path="/doctor/patients" element={<PatientsPage />} />
            <Route path="/doctor/allergies" element={<AllergiesPage />} />

            {/* Autonomous Clinical AI Planner, Manual Meal Plans & Senior Audit Routes */}
            <Route path="/clinical/ai-planner" element={<AiMealPlannerPage />} />
            <Route path="/clinical/plans" element={<MealPlansPage />} />
            <Route path="/clinical/audit-queue" element={<SignOffPage />} />
            <Route path="/clinical/meals" element={<MealsPage />} />
            <Route path="/clinical/feedback" element={<PatientFeedbackPage />} />

            {/* Backward-compatible redirects */}
            <Route path="/dietitian/plans" element={<MealPlansPage />} />
            <Route path="/dietitian/signoff" element={<Navigate to="/clinical/audit-queue" replace />} />
            <Route path="/dietitian/meals" element={<Navigate to="/clinical/meals" replace />} />
            <Route path="/dietitian/feedback" element={<Navigate to="/clinical/feedback" replace />} />

            {/* Patient Routes */}
            <Route path="/patient/dashboard" element={<PatientDashboardPage />} />
            <Route path="/patient/menu" element={<PatientMenuPage />} />

            {/* Kitchen Staff Routes */}
            <Route path="/kitchen/dashboard"    element={<KitchenDashboard />} />
            <Route path="/kitchen/orders"       element={<OrdersPage />} />
            <Route path="/kitchen/scan"         element={<BatchScanPage />} />
            <Route path="/kitchen/delivery-log" element={<DeliveryLogPage />} />
            <Route path="/kitchen/delivery"     element={<DeliveryLogPage />} />

            {/* Admin Routes */}
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />
            <Route path="/admin/delivery" element={<DeliveryLogPage />} />
            <Route path="/admin/confidence" element={<Navigate to="/admin/analytics" replace />} />
          </Route>

          {/* Catch all fallback */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  </AuthProvider>
  );
}
