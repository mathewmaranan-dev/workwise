import { createHashRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ManagerDashboard from './pages/dashboards/ManagerDashboard';
import HRDashboard from './pages/dashboards/HRDashboard';
import AgentDashboard from './pages/dashboards/AgentDashboard';
import UserManagementPage from './pages/UserManagementPage';
import UploadPage from './pages/UploadPage';
import TeamAgentsPage from './pages/TeamAgentsPage';
import NotFoundPage from './pages/NotFoundPage';
import TermsPromptPage from './pages/TermsPromptPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MyAccountPage from './pages/MyAccountPage';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthReady, user } = useAuth();

  if (!isAuthReady) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.termsAccepted) {
    return <Navigate to="/terms" replace />;
  }
  
  return <>{children}</>;
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'hr':
      return <HRDashboard />;
    case 'agent':
      return <AgentDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RoleBasedDashboard />
      },
      {
        path: 'users',
        element: (
          <AdminOnlyRoute>
            <UserManagementPage />
          </AdminOnlyRoute>
        )
      },
      {
        path: 'upload',
        element: (
          <AdminOnlyRoute>
            <UploadPage />
          </AdminOnlyRoute>
        )
      },
      {
        path: 'team-performance',
        element: <ManagerDashboard />
      },
      {
        path: 'team-agents',
        element: <TeamAgentsPage />
      },
      {
        path: 'my-tasks',
        element: <AgentDashboard />
      },
      {
        path: 'account',
        element: <MyAccountPage />
      }
    ]
  },
  {
    path: '/demo',
    element: <ManagerDashboard />
  },
  {
    path: '/terms',
    element: <TermsPromptPage />
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />
  },
  {
    path: '/reset-password/:token',
    element: <ResetPasswordPage />
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);