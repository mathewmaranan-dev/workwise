import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, TrendingDown, Clock, RefreshCcw, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateKPIs, getTicketsByPriority, getWeeklyTicketSeries, getAssignmentGroupPerformance } from '../../utils/analytics';
import { getAssignmentGroupById } from '../../data/seedData';
import { LookupPriority, useLookupData } from '../../hooks/useLookupData';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { exportTicketsToCSV } from '../../utils/csvUtils';
import { getKpiStatus } from '../../utils/kpiStatus';
import { toast } from 'sonner';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import ManagerDashboard from './ManagerDashboard';
import HRDashboard from './HRDashboard';
import AgentDashboard from './AgentDashboard';

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

type PriorityChartPoint = {
  priorityId: number;
  priority: string;
  count: number;
};

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

  const { getCategoryName, getPriorityLabel, priorities } = useLookupData(apiBase);

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
            backendTickets={dashboardTickets}
            hasData={hasData}
            user={user}
            apiBase={apiBase}
            getCategoryName={getCategoryName}
            getPriorityLabel={getPriorityLabel}
            priorities={priorities}
            dashboardMetrics={dashboardMetrics}
            dashboardLoading={dashboardLoading}
            dashboardError={dashboardError}
          />
        </TabsContent>

        <TabsContent value="manager">
          {dashboardView === 'manager' ? <ManagerDashboard /> : null}
        </TabsContent>

        <TabsContent value="hr">
          {dashboardView === 'hr' ? <HRDashboard /> : null}
        </TabsContent>

        <TabsContent value="agent">
          {dashboardView === 'agent' ? <AgentDashboard showAgentSelector /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminView({
  currentTickets,
  backendTickets,
  hasData,
  user,
  apiBase,
  getCategoryName,
  getPriorityLabel,
  priorities,
  dashboardMetrics,
  dashboardLoading,
  dashboardError,
}: {
  currentTickets: any[];
  backendTickets: any[];
  hasData: boolean;
  user: any;
  apiBase: string;
  getCategoryName: (id: number | string | undefined | null) => string;
  getPriorityLabel: (id: number | string | undefined | null) => string;
  priorities: LookupPriority[];
  dashboardMetrics: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
}) {
  const [mlForecast, setMlForecast] = useState<{
    forecast: number[];
    model: string | null;
    dataSource: string | null;
    confidence: number | null;
    loading: boolean;
    error: string | null;
  }>({
    forecast: [],
    model: null,
    dataSource: null,
    confidence: null,
    loading: false,
    error: null,
  });

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

  const slaStatus = useMemo(
    () => getKpiStatus('sla', hasData ? dashboardKpis.slaCompliance : null),
    [hasData, dashboardKpis.slaCompliance]
  );

  const fcrStatus = useMemo(
    () => getKpiStatus('fcr', hasData ? dashboardKpis.fcrRate : null),
    [hasData, dashboardKpis.fcrRate]
  );

  const formatTicketCount = (value: number) => new Intl.NumberFormat('en-US').format(Math.round(Number(value || 0)));

  const priorityOrder = useMemo(() => {
    const order = new Map<string, number>();
    priorities.forEach((priority, index) => {
      order.set(String(priority.priority_level), index);
    });
    return order;
  }, [priorities]);

  const priorityData = useMemo<PriorityChartPoint[]>(() => {
    const lookupPriorityLevels = new Set(priorities.map((priority) => String(priority.priority_level)));

    const baseData = dashboardMetrics?.byPriority && Array.isArray(dashboardMetrics.byPriority)
      ? dashboardMetrics.byPriority.map((item: any) => ({
          priorityId: Number(item.priority_id ?? 0),
          priority: String(item.priority_level ?? item.priority ?? getPriorityLabel(item.priority_id)),
          count: Number(item.count ?? 0),
        }))
      : getTicketsByPriority(currentTickets, (id) => getPriorityLabel(id as number));

    const filteredByLookup = lookupPriorityLevels.size > 0
      ? baseData.filter((item: { priority: string }) => lookupPriorityLevels.has(String(item.priority)))
      : baseData;

    return filteredByLookup.sort(
      (a: { priority: string }, b: { priority: string }) => (priorityOrder.get(a.priority) ?? 999) - (priorityOrder.get(b.priority) ?? 999)
    );
  }, [dashboardMetrics, currentTickets, getPriorityLabel, priorities, priorityOrder]);

  const priorityFilterOptions = useMemo(() => priorities.map((priority) => priority.priority_level), [priorities]);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);

  const trendTickets = useMemo(() => {
    if (Array.isArray(backendTickets) && backendTickets.length > 0) {
      return backendTickets;
    }
    return currentTickets;
  }, [backendTickets, currentTickets]);

  const trendSource = backendTickets.length > 0 ? 'tickets table' : 'fallback dataset';

  const latestCreatedDate = useMemo(() => {
    const parsedDates = trendTickets
      .map((ticket: any) => new Date(
        ticket.created_date ??
        ticket.createdDate ??
        ticket.created_at ??
        ticket.createdAt ??
        ticket.opened_at ??
        ticket.openedAt ??
        ticket.updated_at ??
        ticket.updatedAt ??
        ''
      ))
      .filter((date: Date) => !Number.isNaN(date.getTime()));
    if (parsedDates.length === 0) return null;
    return new Date(Math.max(...parsedDates.map((date: Date) => date.getTime())));
  }, [trendTickets]);

  useEffect(() => {
    let isMounted = true;

    const loadMlForecast = async () => {
      setMlForecast((current) => ({ ...current, loading: true, error: null }));
      try {
        const token = localStorage.getItem('workwise_token');
        if (!token) {
          throw new Error('ML forecast request skipped: missing auth token');
        }

        const endpoint = `${apiBase.replace(/\/$/, '')}/api/ml/forecast/tickets`;
        const retryableStatuses = new Set([429, 502, 503, 504]);
        const maxRetries = 2;
        let payload: any = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ days_ahead: 56 }),
            });

            if (!response.ok) {
              const shouldRetry = retryableStatuses.has(response.status) && attempt < maxRetries;
              if (!shouldRetry) {
                throw new Error(`ML forecast request failed with status ${response.status}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 500));
              continue;
            }

            payload = await response.json();
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            const isFinalAttempt = attempt >= maxRetries;
            if (isFinalAttempt) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 500));
          }
        }

        if (!payload && lastError) {
          throw lastError;
        }

        if (!isMounted) return;

        setMlForecast({
          forecast: Array.isArray(payload?.forecast) ? payload.forecast.map((value: any) => Number(value) || 0) : [],
          model: payload?.model ? String(payload.model) : null,
          dataSource: payload?.data_source ? String(payload.data_source) : null,
          confidence: payload?.confidence !== undefined ? Number(payload.confidence) : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) return;
        setMlForecast({
          forecast: [],
          model: null,
          dataSource: null,
          confidence: null,
          loading: false,
          error: String(error),
        });
      }
    };

    loadMlForecast();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const actualWeeklySeries = useMemo(() => {
    const historical = getWeeklyTicketSeries(trendTickets, {
      weeks: 12,
      futureWeeks: 0,
    });

    return historical.map((point) => ({
      ...point,
      actualTickets: point.ticketCount,
    }));
  }, [trendTickets]);

  const weeklySeries = useMemo(() => {
    const canUseMlForecast = mlForecast.forecast.length > 0;
    if (!canUseMlForecast) {
      return actualWeeklySeries.map((point) => ({
        ...point,
        forecastTickets: null as number | null,
      }));
    }

    const forecastSeries = getWeeklyTicketSeries(trendTickets, {
      weeks: 12,
      futureWeeks: 8,
      forecastDaily: mlForecast.forecast,
      predictionStartDate: latestCreatedDate ?? undefined,
    });

    const actualByWeek = new Map(actualWeeklySeries.map((point) => [point.weekStart, point.ticketCount]));
    const latestActualWeekStart = actualWeeklySeries.length > 0
      ? actualWeeklySeries[actualWeeklySeries.length - 1].weekStart
      : null;

    return forecastSeries.map((point) => ({
      ...point,
      actualTickets: actualByWeek.has(point.weekStart) ? actualByWeek.get(point.weekStart)! : null,
      forecastTickets: latestActualWeekStart && point.weekStart === latestActualWeekStart
        ? (actualByWeek.get(point.weekStart) ?? null)
        : point.projected
          ? (point.predictedTickets ?? null)
          : null,
    }));
  }, [trendTickets, mlForecast.forecast, latestCreatedDate, actualWeeklySeries]);

  const groupPerformanceData = groupPerformance.map(g => ({
    name: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    sla: Math.round(g.slaCompliance),
    fcr: Math.round(g.fcrRate),
    tickets: g.totalTickets
  }));

  const systemChecks = useMemo(() => {
    const apiStatus = dashboardLoading
      ? { label: 'Checking', tone: 'checking' as const, detail: 'Loading KPI endpoints...' }
      : dashboardError
        ? { label: 'Warning', tone: 'warning' as const, detail: 'Backend KPI fetch had issues' }
        : { label: 'Healthy', tone: 'healthy' as const, detail: 'KPI endpoints responding' };

    const dataStatus = hasData
      ? { label: 'Healthy', tone: 'healthy' as const, detail: `${trendTickets.length} ticket rows available` }
      : { label: 'Warning', tone: 'warning' as const, detail: 'No ticket data loaded' };

    const mlStatus = mlForecast.loading
      ? { label: 'Checking', tone: 'checking' as const, detail: 'Running forecast health check...' }
      : mlForecast.error
        ? { label: 'Degraded', tone: 'degraded' as const, detail: 'ML forecast unavailable' }
        : mlForecast.forecast.length > 0
          ? {
              label: 'Healthy',
              tone: 'healthy' as const,
              detail: `Forecast ready${mlForecast.confidence !== null ? ` (${Math.round(mlForecast.confidence * 100)}% conf.)` : ''}`,
            }
          : { label: 'Warning', tone: 'warning' as const, detail: 'No ML forecast output yet' };

    return [
      { key: 'api', title: 'Backend API', ...apiStatus },
      { key: 'data', title: 'Data Pipeline', ...dataStatus },
      { key: 'ml', title: 'ML Service', ...mlStatus },
    ];
  }, [dashboardLoading, dashboardError, hasData, trendTickets.length, mlForecast.loading, mlForecast.error, mlForecast.forecast.length, mlForecast.confidence]);

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
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${slaStatus.badgeClass}`}>
                  {slaStatus.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{hasData ? `${formatTicketCount(dashboardKpis.totalTickets)} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-2 px-4 pb-4">
            <div className="text-2xl font-bold text-gray-900">{hasData ? `${dashboardKpis.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${fcrStatus.badgeClass}`}>
                {fcrStatus.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">First Contact Resolution</p>
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
          <span className="font-semibold text-slate-700">Trend source:</span> Weekly Ticket Volume uses {trendSource} ({trendTickets.length} rows).
        </div>
        {dashboardError && <span className="text-rose-600">Backend dashboard fetch warning</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {systemChecks.map((check) => {
          const toneClass =
            check.tone === 'healthy'
              ? 'bg-emerald-500'
              : check.tone === 'degraded'
                ? 'bg-rose-500'
                : check.tone === 'checking'
                  ? 'bg-sky-500'
                  : 'bg-amber-500';

          return (
            <Card key={check.key}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs flex items-center justify-between">
                  <span>{check.title}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                    <span className={`inline-block h-2 w-2 rounded-full ${toneClass}`} />
                    {check.label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <p className="text-[11px] text-slate-600">{check.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader className="pt-2 px-2 pb-1">
            <CardTitle className="text-xs">Weekly Ticket Volume</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="forecastTickets" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" connectNulls={false} name="ML forecast" />
                <Line type="monotone" dataKey="actualTickets" stroke="#4F46E5" strokeWidth={3} dot={{ r: 2 }} connectNulls={false} name="Actual tickets" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-slate-500">
              {mlForecast.error
                ? 'ML forecast unavailable; showing historical volume only.'
                : `Forecast is ML-generated${mlForecast.model ? ` (${mlForecast.model})` : ''}${mlForecast.dataSource ? ` using ${mlForecast.dataSource} data` : ''}${mlForecast.confidence !== null ? ` at ${Math.round(mlForecast.confidence * 100)}% confidence` : ''}.`}
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
                  {priorityData.map((entry: PriorityChartPoint, index: number) => (
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