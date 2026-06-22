import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import {
  LayoutDashboard,
  Upload,
  Users,
  User,
  Activity,
  ListTodo,
  LogOut,
  Menu
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import Logo from '../components/Logo';

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
      { path: '/dashboard/team-performance', label: 'Team Performance', icon: Activity },
      { path: '/dashboard/team-agents', label: 'Team Agents', icon: Users },
      { path: '/dashboard/tickets', label: 'Ticket Finder', icon: ListTodo }
    ] : []),
    ...(user?.role === 'agent' ? [
      { path: '/dashboard/my-tasks', label: 'My Tasks', icon: ListTodo }
    ] : []),
    ...(user?.role === 'admin' ? [
      { path: '/dashboard/users', label: 'User Management', icon: Users },
      { path: '/dashboard/tickets', label: 'Ticket Finder', icon: ListTodo },
      { path: '/dashboard/upload', label: 'Upload Data', icon: Upload }
    ] : [])
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-6 border-b border-border">
        <Logo />
        <p className="text-xs text-muted-foreground mt-3">{user?.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
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
    <div className="h-screen flex flex-col bg-white text-slate-950">
      {/* Mobile header */}
      <div className="lg:hidden border-b bg-white p-2 flex items-center justify-between">
        <Logo className="h-fit" />
        <div className="flex items-center gap-2">
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 border-r bg-white overflow-y-auto">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background text-foreground">
          <div className="p-4 lg:p-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Logo />
            </div>
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
