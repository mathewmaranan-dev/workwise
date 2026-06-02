import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from 'react-router';
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
function ProtectedRoute({ children }) {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    if (user && !user.termsAccepted) {
        return _jsx(Navigate, { to: "/terms", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
function RoleBasedDashboard() {
    const { user } = useAuth();
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    switch (user.role) {
        case 'admin':
            return _jsx(AdminDashboard, {});
        case 'manager':
            return _jsx(ManagerDashboard, {});
        case 'hr':
            return _jsx(HRDashboard, {});
        case 'agent':
            return _jsx(AgentDashboard, {});
        default:
            return _jsx(Navigate, { to: "/login", replace: true });
    }
}
function AdminOnlyRoute({ children }) {
    const { user } = useAuth();
    if (user?.role !== 'admin') {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
export const router = createBrowserRouter([
    {
        path: '/',
        element: _jsx(Navigate, { to: "/login", replace: true })
    },
    {
        path: '/login',
        element: _jsx(LoginPage, {})
    },
    {
        path: '/dashboard',
        element: (_jsx(ProtectedRoute, { children: _jsx(DashboardLayout, {}) })),
        children: [
            {
                index: true,
                element: _jsx(RoleBasedDashboard, {})
            },
            {
                path: 'users',
                element: (_jsx(AdminOnlyRoute, { children: _jsx(UserManagementPage, {}) }))
            },
            {
                path: 'upload',
                element: (_jsx(AdminOnlyRoute, { children: _jsx(UploadPage, {}) }))
            },
            {
                path: 'team-performance',
                element: _jsx(ManagerDashboard, {})
            },
            {
                path: 'team-agents',
                element: _jsx(TeamAgentsPage, {})
            },
            {
                path: 'my-tasks',
                element: _jsx(AgentDashboard, {})
            },
            {
                path: 'account',
                element: _jsx(MyAccountPage, {})
            }
        ]
    },
    {
        path: '/terms',
        element: _jsx(TermsPromptPage, {})
    },
    {
        path: '/forgot-password',
        element: _jsx(ForgotPasswordPage, {})
    },
    {
        path: '/reset-password/:token',
        element: _jsx(ResetPasswordPage, {})
    },
    {
        path: '*',
        element: _jsx(NotFoundPage, {})
    }
]);
