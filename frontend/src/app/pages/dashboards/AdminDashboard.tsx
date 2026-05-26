import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, TrendingDown, Clock, RefreshCcw, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateKPIs, getTicketsByPriority, getNonFCRTickets, getAssignmentGroupPerformance } from '../../utils/analytics';
import { getAssignmentGroupById, getPriorityById, getCategoryById, tickets as seedDataTickets } from '../../data/seedData';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { exportTicketsToCSV } from '../../utils/csvUtils';
import { toast } from 'sonner';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import ManagerDashboard from './ManagerDashboard';
import HRDashboard from './HRDashboard';
import AgentDashboard from './AgentDashboard';

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

export default function AdminDashboard() {
  const [dashboardView, setDashboardView] = useState('admin');
  const { user } = useAuth();
  const { data: uploadedData } = useData(); // subscribe to uploads to trigger re-render
  const currentTickets = (uploadedData && uploadedData.length > 0) ? uploadedData : seedDataTickets;
  const hasData = currentTickets.length > 0;

  const kpis = calculateKPIs(currentTickets);
  const priorityData = getTicketsByPriority(currentTickets);
  const nonFCRTickets = getNonFCRTickets(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);

  // Aggregate tickets into weekly counts for the chart
  const ticketsToUse = currentTickets;
  const weeklyMap: Record<string, number> = {};
  ticketsToUse.forEach((t: any) => {
    const dateField = t.created_date || t.opened_at;
    if (!dateField) return;
    const d = new Date(dateField);
    if (isNaN(d.getTime())) return;
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().split('T')[0];
    weeklyMap[key] = (weeklyMap[key] || 0) + 1;
  });

  const weeklyData = Object.entries(weeklyMap)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([week, count]) => ({
      week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tickets: count
    }));

  const groupPerformanceData = groupPerformance.map(g => ({
    name: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    sla: Math.round(g.slaCompliance),
    fcr: Math.round(g.fcrRate),
    tickets: g.totalTickets
  }));

  const handleExport = () => {
    exportTicketsToCSV();
    toast.success('Ticket data exported successfully');
  };

  return (
    <div className="space-y-2">
      <WelcomeBanner userName={user?.name || 'User'} role="Admin" />
      
      <Tabs value={dashboardView} onValueChange={setDashboardView} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4 mb-4">
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="manager">Manager</TabsTrigger>
          <TabsTrigger value="hr">HR</TabsTrigger>
          <TabsTrigger value="agent">Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <AdminView currentTickets={currentTickets} hasData={hasData} user={user} />
        </TabsContent>

        <TabsContent value="manager">
          <ManagerDashboard />
        </TabsContent>

        <TabsContent value="hr">
          <HRDashboard />
        </TabsContent>

        <TabsContent value="agent">
          <AgentDashboard showAgentSelector />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminView({ currentTickets, hasData, user }: { currentTickets: any[]; hasData: boolean; user: any }) {
  const kpis = calculateKPIs(currentTickets);
  const priorityData = getTicketsByPriority(currentTickets);
  const nonFCRTickets = getNonFCRTickets(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);

  // Aggregate tickets into weekly counts for the chart
  const ticketsToUse = currentTickets;
  const weeklyMap: Record<string, number> = {};
  ticketsToUse.forEach((t: any) => {
    const dateField = t.created_date || t.opened_at;
    if (!dateField) return;
    const d = new Date(dateField);
    if (isNaN(d.getTime())) return;
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().split('T')[0];
    weeklyMap[key] = (weeklyMap[key] || 0) + 1;
  });

  const weeklyData = Object.entries(weeklyMap)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([week, count]) => ({
      week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tickets: count
    }));

  const groupPerformanceData = groupPerformance.map(g => ({
    name: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    sla: Math.round(g.slaCompliance),
    fcr: Math.round(g.fcrRate),
    tickets: g.totalTickets
  }));

  const handleExport = () => {
    exportTicketsToCSV();
    toast.success('Ticket data exported successfully');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-xs text-gray-600 mt-0">Logged in as: {user?.name || 'Admin'} ({user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'})</p>
          <p className="text-xs text-gray-600 mt-1">System-wide overview and performance metrics</p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs">
          <Download className="w-3 h-3 mr-1" />
          Export Data
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
              <div className="text-2xl font-bold text-gray-900">{hasData ? `${kpis.slaCompliance.toFixed(1)}%` : 'N/A'}</div>
              <p className="text-xs text-gray-500 mt-1">{hasData ? `${kpis.totalTickets} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${kpis.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">First Contact Resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">Median Resolution Time</CardTitle>
            <Clock className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${kpis.medianResolutionTime.toFixed(1)}h` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? `${kpis.resolvedTickets} resolved tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">Reopen Rate</CardTitle>
            <RefreshCcw className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${kpis.reopenRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? 'Tickets reopened' : 'No data'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader className="pt-2 px-2 pb-1">
            <CardTitle className="text-xs">Weekly Ticket Volume</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="#4F46E5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-2 px-2 pb-1">
            <CardTitle className="text-xs">Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ priority, percent }) => `${priority}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Group Performance */}
      <Card>
        <CardHeader className="pt-2 px-2 pb-1">
          <CardTitle className="text-xs">Assignment Group Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={groupPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sla" fill="#4F46E5" name="SLA %" />
              <Bar dataKey="fcr" fill="#06B6D4" name="FCR %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Non-FCR Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Non-FCR Tickets (Priority Order)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Ticket ID</th>
                  <th className="text-left p-2 font-medium">Priority</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Opened</th>
                  <th className="text-left p-2 font-medium">Age (days)</th>
                  <th className="text-left p-2 font-medium">Reopens</th>
                </tr>
              </thead>
              <tbody>
                {nonFCRTickets.slice(0, 10).map(ticket => {
                  const age = Math.floor((new Date().getTime() - new Date(ticket.opened_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{ticket.ticket_id}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.priority_code === 'P1' ? 'bg-red-100 text-red-800' :
                          ticket.priority_code === 'P2' ? 'bg-orange-100 text-orange-800' :
                          ticket.priority_code === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.priority_code}
                        </span>
                      </td>
                      <td className="p-2">{getCategoryById(ticket.category_id)?.category_name}</td>
                      <td className="p-2">{new Date(ticket.opened_at).toLocaleDateString()}</td>
                      <td className="p-2">{age}</td>
                      <td className="p-2 text-center">{ticket.reopen_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}