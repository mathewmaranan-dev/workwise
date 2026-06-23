import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, TrendingDown, Clock, RefreshCcw, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateKPIs, getTicketsByPriority, getWeeklyTicketSeries, getAssignmentGroupPerformance } from '../../utils/analytics';
import { getAssignmentGroupById } from '../../data/seedData';
import { useLookupData } from '../../hooks/useLookupData';
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
  const { user, isAuthReady } = useAuth();
  const { data: uploadedData } = useData(); // subscribe to uploads to trigger re-render
  const [dashboardTickets, setDashboardTickets] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!isAuthReady) return;

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setDashboardTickets([]);
      setDashboardMetrics(null);
      setDashboardLoading(false);
      setDashboardError('No auth token available');
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const metricsUrl = `${apiBase.replace(/\/$/, '')}/api/kpis/dashboard?t=${Date.now()}`;
    const ticketsUrl = `${apiBase.replace(/\/$/, '')}/api/kpis/dashboard/tickets?t=${Date.now()}`;

    Promise.all([
      fetch(metricsUrl, { method: 'GET', cache: 'no-store', headers }),
      fetch(ticketsUrl, { method: 'GET', cache: 'no-store', headers }),
    ])
      .then(async ([metricsResp, ticketsResp]) => {
        if (!metricsResp.ok) {
          throw new Error(`Failed to load dashboard metrics: ${metricsResp.status}`);
        }
        if (!ticketsResp.ok) {
          throw new Error(`Failed to load dashboard analytics tickets: ${ticketsResp.status}`);
        }

        const metricsJson = await metricsResp.json();
        const ticketsJson = await ticketsResp.json();

        setDashboardMetrics(metricsJson);
        setDashboardTickets(Array.isArray(ticketsJson) ? ticketsJson : []);
      })
      .catch((error) => {
        console.warn('Failed to load dashboard data', error);
        setDashboardTickets([]);
        setDashboardMetrics(null);
        setDashboardError(String(error));
      })
      .finally(() => {
        setDashboardLoading(false);
      });
  }, [apiBase, isAuthReady]);

  const currentTickets = useMemo(() => {
    if (dashboardLoading) {
      return uploadedData && uploadedData.length > 0 ? uploadedData : [];
    }
    if (dashboardTickets && dashboardTickets.length > 0) {
      return dashboardTickets;
    }
    if (uploadedData && uploadedData.length > 0) {
      return uploadedData;
    }
    return [];
  }, [dashboardLoading, dashboardTickets, uploadedData]);
  const hasData = currentTickets.length > 0;

  const { getCategoryName, getPriorityLabel } = useLookupData(apiBase);

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
          <AdminView
            currentTickets={currentTickets}
            hasData={hasData}
            user={user}
            getCategoryName={getCategoryName}
            getPriorityLabel={getPriorityLabel}
            dashboardMetrics={dashboardMetrics}
            dashboardLoading={dashboardLoading}
            dashboardError={dashboardError}
          />
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

function AdminView({
  currentTickets,
  hasData,
  user,
  getCategoryName,
  getPriorityLabel,
  dashboardMetrics,
  dashboardLoading,
  dashboardError,
}: {
  currentTickets: any[];
  hasData: boolean;
  user: any;
  getCategoryName: (id: number | string | undefined | null) => string;
  getPriorityLabel: (id: number | string | undefined | null) => string;
  dashboardMetrics: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
}) {
  const [chartPriorityFilter, setChartPriorityFilter] = useState<'all' | 'Critical' | 'High' | 'Medium' | 'Low'>('all');

  const dashboardKpis = useMemo(() => {
    const fallback = calculateKPIs(currentTickets);
    if (!dashboardMetrics) return fallback;

    const asNumber = (value: any, fallbackValue: number) => {
      if (value === undefined || value === null) return fallbackValue;
      return Number(value);
    };

    return {
      slaCompliance: asNumber(dashboardMetrics.slaCompliance?.percentage ?? dashboardMetrics.slaCompliance, fallback.slaCompliance),
      fcrRate: asNumber(dashboardMetrics.fcrRate?.percentage ?? dashboardMetrics.fcrRate, fallback.fcrRate),
      medianResolutionTime: asNumber(
        dashboardMetrics.avgResolutionTime?.hours ?? dashboardMetrics.medianResolutionTime ?? dashboardMetrics.avg_resolution_time?.hours,
        fallback.medianResolutionTime
      ),
      reopenRate: asNumber(
        dashboardMetrics.reopenRate?.percentage ?? dashboardMetrics.reopenRate ?? dashboardMetrics.reopen_rate?.percentage ?? dashboardMetrics.reopen_rate,
        fallback.reopenRate
      ),
      totalTickets: asNumber(dashboardMetrics.totalTickets?.count ?? dashboardMetrics.totalTickets, fallback.totalTickets),
      resolvedTickets: asNumber(dashboardMetrics.resolvedTickets?.count ?? dashboardMetrics.resolvedTickets, fallback.resolvedTickets),
    };
  }, [dashboardMetrics, currentTickets]);

  const priorityData = getTicketsByPriority(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);

  const filteredChartTickets = useMemo(() => {
    if (chartPriorityFilter === 'all') return currentTickets;
    return currentTickets.filter((ticket: any) => {
      const label = getPriorityLabel(ticket.priority_id);
      return label === chartPriorityFilter;
    });
  }, [chartPriorityFilter, currentTickets, getPriorityLabel]);

  const weeklySeries = useMemo(() => getWeeklyTicketSeries(filteredChartTickets, 4), [filteredChartTickets]);

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
              <div className="text-2xl font-bold text-gray-900">{hasData ? `${dashboardKpis.slaCompliance.toFixed(1)}%` : 'N/A'}</div>
              <p className="text-xs text-gray-500 mt-1">{hasData ? `${dashboardKpis.totalTickets} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${dashboardKpis.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">First Contact Resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">Median Resolution Time</CardTitle>
            <Clock className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${dashboardKpis.medianResolutionTime.toFixed(1)}h` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? `${dashboardKpis.resolvedTickets} resolved tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">Reopen Rate</CardTitle>
            <RefreshCcw className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${dashboardKpis.reopenRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? 'Tickets reopened' : 'No data'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-700">Priority-based chart filter:</span> Volume trend and non-FCR tickets update to the selected priority.
        </div>
        <label className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Priority</span>
          <select
            value={chartPriorityFilter}
            onChange={(event) => setChartPriorityFilter(event.target.value as 'all' | 'Critical' | 'High' | 'Medium' | 'Low')}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <option value="all">All priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader className="pt-2 px-2 pb-1">
            <CardTitle className="text-xs">Weekly Ticket Volume {chartPriorityFilter === 'all' ? '' : `(${chartPriorityFilter})`}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="#4F46E5" strokeWidth={2} name="Actual tickets" />
                <Line type="monotone" dataKey="predictedTickets" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" name="Predicted trend" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-slate-500">
              Predicted trend uses a rolling linear fit over the filtered history so you can compare actual volume to projected workload.
            </p>
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

      {/* Non-FCR Tickets table removed per request */}
    </div>
  );
}