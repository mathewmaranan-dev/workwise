import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import {
  LayoutDashboard,
  Upload,
  Users,
  User,
  LogOut,
  Menu
} from 'lucide-react';
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
    ...(user?.role === 'admin' ? [
      { path: '/dashboard/users', label: 'User Management', icon: Users }
    ] : []),
    ...(user?.role === 'admin' ? [
      { path: '/dashboard/upload', label: 'Upload Data', icon: Upload }
    ] : [])
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-base font-bold text-indigo-900">WORK-WISE</h2>
        <p className="text-xs text-gray-600 mt-0.5">{user?.name}</p>
        <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start text-xs"
              onClick={() => navigate(item.path)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {item.label}
            </Button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden border-b bg-white p-2 flex items-center justify-between">
        <h1 className="text-base font-bold text-indigo-900">WORK-WISE</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-48">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 border-r bg-white overflow-y-auto">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-semibold text-slate-900">Logged in as:</span>
                <span>{user?.name || 'User'}</span>
                <span className="text-slate-500">({user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : 'Unknown'})</span>
              </div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
