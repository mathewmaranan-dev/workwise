import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ManagerDashboard from './pages/dashboards/ManagerDashboard';
import HRDashboard from './pages/dashboards/HRDashboard';
import AgentDashboard from './pages/dashboards/AgentDashboard';
import UserManagementPage from './pages/UserManagementPage';
import UploadPage from './pages/UploadPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

export const router = createBrowserRouter([
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
        path: 'my-tasks',
        element: <AgentDashboard />
      }
    ]
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);