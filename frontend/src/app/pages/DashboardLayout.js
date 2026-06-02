import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from '../context/AuthContext';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { LayoutDashboard, Upload, Users, User, LogOut, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/dashboard/account', label: 'My Account', icon: User },
        ...(user?.role === 'manager' ? [
            { path: '/dashboard/team-agents', label: 'Team Agents', icon: Users }
        ] : []),
        ...(user?.role === 'admin' ? [
            { path: '/dashboard/users', label: 'User Management', icon: Users }
        ] : []),
        ...(user?.role === 'admin' ? [
            { path: '/dashboard/upload', label: 'Upload Data', icon: Upload }
        ] : [])
    ];
    const SidebarContent = () => (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "p-6 border-b", children: [_jsx("h2", { className: "text-base font-bold text-indigo-900", children: "WORK-WISE" }), _jsx("p", { className: "text-xs text-gray-600 mt-0.5", children: user?.name }), _jsx("p", { className: "text-xs text-gray-500 capitalize", children: user?.role })] }), _jsx("nav", { className: "flex-1 p-4 space-y-2", children: navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (_jsxs(Button, { variant: isActive ? 'default' : 'ghost', className: "w-full justify-start text-xs", onClick: () => navigate(item.path), children: [_jsx(Icon, { className: "w-4 h-4 mr-2" }), item.label] }, item.path));
                }) }), _jsx("div", { className: "p-4 border-t", children: _jsxs(Button, { variant: "ghost", size: "sm", className: "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50", onClick: handleLogout, children: [_jsx(LogOut, { className: "w-4 h-4 mr-2" }), "Logout"] }) })] }));
    return (_jsxs("div", { className: "h-screen flex flex-col bg-gray-50", children: [_jsxs("div", { className: "lg:hidden border-b bg-white p-2 flex items-center justify-between", children: [_jsx("h1", { className: "text-base font-bold text-indigo-900", children: "WORK-WISE" }), _jsxs(Sheet, { children: [_jsx(SheetTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", children: _jsx(Menu, { className: "w-5 h-5" }) }) }), _jsx(SheetContent, { side: "left", className: "p-0 w-48", children: _jsx(SidebarContent, {}) })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx("aside", { className: "hidden lg:block w-64 border-r bg-white overflow-y-auto", children: _jsx(SidebarContent, {}) }), _jsx("main", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { className: "p-4 lg:p-6", children: [_jsx("div", { className: "mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700", children: _jsxs("div", { className: "flex flex-wrap gap-2 items-center", children: [_jsx("span", { className: "font-semibold text-slate-900", children: "Logged in as:" }), _jsx("span", { children: user?.name || 'User' }), _jsxs("span", { className: "text-slate-500", children: ["(", user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : 'Unknown', ")"] })] }) }), _jsx(Outlet, {})] }) })] })] }));
}
