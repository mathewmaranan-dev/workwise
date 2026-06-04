import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Activity, AlertTriangle, Target, Filter } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { calculateKPIs, getAssignmentGroupPerformance, getNonFCRTickets, getNewTickets, getInProgressTickets, getClosedTickets, getEmployeePerformance } from '../../utils/analytics';
import { predictNonFCRRisk, NonFCRRiskScore } from '../../utils/mlAlgorithms';
import { 
  tickets as seedDataTickets, 
  weeklyCounts, 
  getAssignmentGroupById, 
  getCategoryById,
  getUserById,
  assignmentGroups,
  Ticket,
} from '../../data/seedData';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';

const env = (import.meta as any).env as Record<string, string | undefined>;

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { data: uploadedData } = useData();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'new' | 'closed'>('all');
  const [backendTickets, setBackendTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const apiBase = env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const token = localStorage.getItem('workwise_token');
    if (!token) return;

    setLoadingTickets(true);
    fetch(`${apiBase.replace(/\/$/, '')}/api/tickets?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load tickets');
        return response.json();
      })
      .then((tickets) => setBackendTickets(Array.isArray(tickets) ? tickets : []))
      .catch((error) => {
        console.warn('Failed to load backend tickets for manager dashboard', error);
        setBackendTickets([]);
      })
      .finally(() => setLoadingTickets(false));
  }, [apiBase]);

  const currentTickets = useMemo(() => {
    if (backendTickets.length > 0) return backendTickets;
    return uploadedData && uploadedData.length > 0 ? uploadedData : seedDataTickets;
  }, [backendTickets, uploadedData]);
  const hasData = currentTickets.length > 0;
  
  const initialGroupId = user?.assignment_group_id ?? (user?.role === 'manager' ? 1 : 2);
  const [selectedGroupId, setSelectedGroupId] = useState<number>(initialGroupId);
  const selectedGroup = getAssignmentGroupById(selectedGroupId);

  const selectedGroupTickets = useMemo(
    () => currentTickets.filter(t => t.assignment_group_id === selectedGroupId),
    [currentTickets, selectedGroupId]
  );
  const selectedGroupNonFCRTickets = useMemo(
    () => getNonFCRTickets(selectedGroupTickets),
    [selectedGroupTickets]
  );
  const displayGroupId = selectedGroupId;
  const displayGroup = getAssignmentGroupById(displayGroupId);
  const groupTickets = selectedGroupTickets;
  const groupNonFCRTickets = selectedGroupNonFCRTickets;
  const groupNonFCRTicketRecords = useMemo(() => groupTickets.filter(t => !t.fcr), [groupTickets]);
  const isFallbackGroup = false;
  
  // Calculate KPIs for manager's group only
  const groupKPIs = {
    slaCompliance: groupTickets.length > 0 
      ? (groupTickets.filter(t => t.made_sla).length / groupTickets.length) * 100 
      : 0,
    fcrRate: groupTickets.length > 0 
      ? (groupTickets.filter(t => t.fcr).length / groupTickets.length) * 100 
      : 0,
    totalTickets: groupTickets.length,
    activeTickets: groupTickets.filter(t => t.status_id !== 3 && t.status_id !== 4).length,
    resolvedTickets: groupTickets.filter(t => t.status_id === 3 || t.status_id === 4).length
  };

  // Task allocation by status
  const newTasks = groupTickets.filter(t => t.status_id === 1).length;
  const openTasks = groupTickets.filter(t => t.status_id === 6).length;
  const assignedTasks = groupTickets.filter(t => t.assigned_to_id && t.status_id === 2).length;
  const pendingTasks = groupTickets.filter(t => t.status_id === 5).length;
  

  const [riskScoreMap, setRiskScoreMap] = useState<Record<string, NonFCRRiskScore>>({});
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Ticket[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'recommendations'>('overview');
  const [mlInsights, setMlInsights] = useState({
    forecastMean: null as number | null,
    forecastUpper: null as number | null,
    forecastLower: null as number | null,
    anomalyCount: 0,
    anomalyPeak: null as number | null,
    loading: false,
    error: null as string | null,
  });

  // ML-driven visualizations: risk distribution and driver frequency
  const riskDistributionData = useMemo(() => {
    const buckets: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    Object.values(riskScoreMap).forEach((r) => {
      const score = r?.riskScore ?? 0;
      if (score >= 70) buckets.Critical += 1;
      else if (score >= 50) buckets.High += 1;
      else if (score >= 30) buckets.Medium += 1;
      else buckets.Low += 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [riskScoreMap]);

  const driverFrequencyData = useMemo(() => {
    const freq: Record<string, number> = {};
    Object.values(riskScoreMap).forEach((r) => {
      const factors = Array.isArray(r?.factors) ? r.factors : [];
      factors.forEach((f) => { freq[f] = (freq[f] || 0) + 1; });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [riskScoreMap]);

  const taskAllocationData = [
    { name: 'New', value: newTasks, color: '#3B82F6' },
    { name: 'Open', value: openTasks, color: '#10B981' },
    { name: 'Assigned', value: assignedTasks, color: '#8B5CF6' },
    { name: 'Pending', value: pendingTasks, color: '#F59E0B' }
  ];

  const currentStaffCount = useMemo(() => {
    const assignedAgentIds = new Set(groupTickets
      .map(ticket => ticket.assigned_to_id)
      .filter((value): value is number => typeof value === 'number'));
    return assignedAgentIds.size > 0 ? assignedAgentIds.size : 1;
  }, [groupTickets]);

  const averageRiskScore = useMemo(() => {
    const values = groupNonFCRTickets
      .map(ticket => riskScoreMap[ticket.ticket_id]?.riskScore)
      .filter((value): value is number => typeof value === 'number');

    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [groupNonFCRTickets, riskScoreMap]);

  // Weekly workload for this group (from uploaded data)
  const weeklyGroupData = (() => {
    if (!hasData) return [] as { week: string; tickets: number }[];
    const map: Record<string, number> = {};
    currentTickets.forEach((t: any) => {
      if (t.assignment_group_id !== displayGroupId) return;
      const d = new Date(t.created_date);
      const wk = new Date(d);
      wk.setDate(wk.getDate() - wk.getDay());
      const key = wk.toISOString().split('T')[0];
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([week, count]) => ({ week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tickets: count }));
  })();

  const forecastDemand = mlInsights.forecastMean ?? (groupTickets.length > 0 ? groupTickets.length : 0);
  const agentCapacityTarget = 10;
  const currentCapacity = currentStaffCount * agentCapacityTarget;
  const requiredStaff = Math.ceil(forecastDemand / agentCapacityTarget);
  const staffingGap = requiredStaff - currentStaffCount;
  const demandCapacityRatio = forecastDemand / Math.max(currentCapacity, 1);
  const workloadPerAgent = forecastDemand / Math.max(currentStaffCount, 1);
  const overloadDelta = Math.max(0, forecastDemand - currentCapacity);
  const capacityUtilization = (forecastDemand / Math.max(currentCapacity, 1)) * 100;
  const staffingDecision = demandCapacityRatio > 1.1 ? 'Hire' : demandCapacityRatio >= 0.9 ? 'Redistribute' : 'Maintain';
  const staffingReason = `${workloadPerAgent > agentCapacityTarget ? 'Workload overload is driving SLA risk.' : 'Workload remains within target capacity.'} ${averageRiskScore >= 70 ? 'High repeat-ticket risk is lowering FCR performance.' : 'FCR risk is moderate and monitorable.'} ${demandCapacityRatio > 1.1 ? 'Capacity mismatch warrants staffing action.' : 'Current capacity is broadly aligned with demand.'}`;

  const staffingScenarioData = [0, 1, 2, 3].map((extraAgents) => {
    const scenarioStaff = currentStaffCount + extraAgents;
    const projectedLoadPerAgent = forecastDemand / Math.max(scenarioStaff, 1);
    const projectedSla = Math.max(60, Math.min(98, 96 - Math.max(0, projectedLoadPerAgent - agentCapacityTarget) * 2.5));
    const scenarioCapacityRatio = forecastDemand / Math.max(scenarioStaff * agentCapacityTarget, 1);
    return {
      scenario: extraAgents === 0 ? 'Current' : `+${extraAgents} agent${extraAgents === 1 ? '' : 's'}`,
      staff: scenarioStaff,
      projectedLoadPerAgent: Number(projectedLoadPerAgent.toFixed(1)),
      projectedSla: Number(projectedSla.toFixed(1)),
      capacityRatio: Number(scenarioCapacityRatio.toFixed(2)),
      action: scenarioCapacityRatio > 1.1 ? 'Hire' : scenarioCapacityRatio >= 0.9 ? 'Redistribute' : 'Maintain'
    };
  });

  const recommendedScenario = staffingScenarioData.reduce((best, scenario) => scenario.projectedSla > best.projectedSla ? scenario : best, staffingScenarioData[0]);

  const categoryLoadData = Object.entries(groupTickets.reduce<Record<string, number>>((acc, ticket) => {
    const label = getCategoryById(ticket.category_id)?.category_name || 'Uncategorized';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({
      category,
      tickets: count,
      workloadPerAgent: Number((count / Math.max(currentStaffCount, 1)).toFixed(1))
    }));

  const weightedForecastData = useMemo(() => {
    if (weeklyGroupData.length === 0) return [];
    const averageForecast = mlInsights.forecastMean ?? groupTickets.length;
    const forecastPerWeek = Number((averageForecast / Math.max(weeklyGroupData.length, 1)).toFixed(1));
    return weeklyGroupData.map((entry) => ({
      week: entry.week,
      actualTickets: entry.tickets,
      forecastTarget: forecastPerWeek,
      capacityThreshold: currentStaffCount * agentCapacityTarget,
    }));
  }, [weeklyGroupData, mlInsights.forecastMean, currentStaffCount, agentCapacityTarget, groupTickets.length]);

  const teamStaffingAnalysis = useMemo(() => {
    return assignmentGroups
      .map((group) => {
        const groupTicketsForTeam = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.assignment_group_id);
        const groupNonFCR = groupTicketsForTeam.filter((ticket: any) => !ticket.fcr);
        const assignedAgentIds = new Set(groupTicketsForTeam
          .map((ticket: any) => ticket.assigned_to_id)
          .filter((value): value is number => typeof value === 'number'));
        const currentStaff = assignedAgentIds.size > 0 ? assignedAgentIds.size : 1;
        const forecastVolume = groupTicketsForTeam.length > 0 ? groupTicketsForTeam.length : 0;
        const required = Math.ceil(forecastVolume / agentCapacityTarget);
        const gap = required - currentStaff;
        const demandRatio = forecastVolume / Math.max(currentStaff * agentCapacityTarget, 1);
        const loadPerAgent = forecastVolume / Math.max(currentStaff, 1);
        const avgRisk = groupNonFCR.length > 0
          ? groupNonFCR.reduce((sum, ticket: any) => sum + (riskScoreMap[ticket.ticket_id]?.riskScore ?? 0), 0) / groupNonFCR.length
          : 0;

        return {
          groupId: group.assignment_group_id,
          groupName: group.group_name,
          forecastVolume,
          currentStaff,
          requiredStaff: required,
          staffingGap: gap,
          demandCapacityRatio: Number(demandRatio.toFixed(2)),
          workloadPerAgent: Number(loadPerAgent.toFixed(1)),
          avgRisk: Number(avgRisk.toFixed(1)),
          recommendation: demandRatio > 1.1 ? `Hire ${Math.max(gap, 1)} agent${Math.max(gap, 1) === 1 ? '' : 's'}` : demandRatio >= 0.9 ? 'Redistribute workload' : 'Maintain staffing',
        };
      })
      .sort((a, b) => b.staffingGap - a.staffingGap);
  }, [assignmentGroups, currentTickets, riskScoreMap, agentCapacityTarget]);

  useEffect(() => {
    let isMounted = true;

    const loadRiskScores = async () => {
      if (groupNonFCRTicketRecords.length === 0) {
        setRiskScoreMap({});
        setRiskError(null);
        setRiskLoading(false);
        return;
      }

      setRiskLoading(true);
      setRiskError(null);

      try {
        const scores = await predictNonFCRRisk(groupNonFCRTicketRecords, currentTickets);
        if (!isMounted) return;
        setRiskScoreMap(Object.fromEntries(scores.map(score => [score.ticket_id, score])));
      } catch (error: any) {
        if (!isMounted) return;
        console.warn('Failed to load ML risk scores', error);
        setRiskError('ML scoring unavailable, using fallback heuristics');
      } finally {
        if (isMounted) {
          setRiskLoading(false);
        }
      }
    };

    loadRiskScores();

    return () => {
      isMounted = false;
    };
  }, [groupNonFCRTicketRecords, currentTickets]);

  // Fetch workload recommendations from ML service for this group
  useEffect(() => {
    let isMounted = true;
    const fetchRecommendations = async () => {
      setRecLoading(true);
      setRecError(null);
      try {
        const payload = {
          assignment_group_id: selectedGroupId,
          incoming_tickets: Math.round(mlInsights.forecastMean ?? groupTickets.length)
        };

        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/ml/workload/balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error('Backend did not return recommendations');
        const data = await resp.json();

        let tasks: Ticket[] = [];
        // Preferred shape: data.recommended_tasks: [ { ticket_id, priority_id, category_id, status_id, created_date, made_sla } ]
        if (Array.isArray(data?.recommended_tasks)) {
          tasks = data.recommended_tasks as Ticket[];
        } else if (Array.isArray(data?.recommendations)) {
          // Flatten per-agent recommendations if present
          data.recommendations.forEach((r: any) => {
            if (Array.isArray(r.tickets)) tasks.push(...r.tickets);
          });
        }

        // Fallback: local prioritized ordering when backend doesn't return tasks
        if (tasks.length === 0) {
          tasks = [...groupTickets]
            .sort((a, b) => (a.priority_id - b.priority_id) || (new Date(b.created_date).getTime() - new Date(a.created_date).getTime()))
            .slice(0, 50);
        }

        if (isMounted) setRecommendations(tasks);
      } catch (error) {
        console.warn('Failed to load ML recommendations', error);
        if (isMounted) {
          setRecError('ML recommendations unavailable — showing priority-sorted fallback');
          setRecommendations(
            [...groupTickets]
              .sort((a, b) => (a.priority_id - b.priority_id) || (new Date(b.created_date).getTime() - new Date(a.created_date).getTime()))
              .slice(0, 50)
          );
        }
      } finally {
        if (isMounted) setRecLoading(false);
      }
    };

    fetchRecommendations();
    return () => { isMounted = false; };
  }, [apiBase, selectedGroupId, mlInsights.forecastMean, groupTickets]);

  useEffect(() => {
    let isMounted = true;

    const loadMlInsights = async () => {
      setMlInsights((current) => ({ ...current, loading: true, error: null }));

      try {
        const [forecastResponse, anomalyResponse] = await Promise.all([
          fetch(`${apiBase.replace(/\/$/, '')}/api/ml/forecast/tickets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              assignment_group_id: selectedGroupId,
              days_ahead: 7
            })
          }),
          fetch(`${apiBase.replace(/\/$/, '')}/api/ml/anomalies/detect?group_id=${selectedGroupId}`)
        ]);

        if (!forecastResponse.ok || !anomalyResponse.ok) {
          throw new Error('Failed to load backend ML insights');
        }

        const forecastData = await forecastResponse.json();
        const anomalyData = await anomalyResponse.json();

        const anomalyEntries = Array.isArray(anomalyData?.anomalies_detected) ? anomalyData.anomalies_detected as Array<{ value?: number }> : [];
        const peakAnomaly = anomalyEntries.reduce((max, entry) => Math.max(max, Number(entry?.value ?? 0)), 0);

        if (!isMounted) return;

        setMlInsights({
          forecastMean: forecastData?.forecast?.mean ?? null,
          forecastUpper: forecastData?.forecast?.upper_bound ?? null,
          forecastLower: forecastData?.forecast?.lower_bound ?? null,
          anomalyCount: Number(anomalyData?.total_anomalies ?? anomalyEntries.length ?? 0),
          anomalyPeak: Number.isFinite(peakAnomaly) ? peakAnomaly : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to load backend ML insights', error);
        setMlInsights((current) => ({
          ...current,
          loading: false,
          error: 'Backend ML insights unavailable'
        }));
      }
    };

    loadMlInsights();

    return () => {
      isMounted = false;
    };
  }, [apiBase, selectedGroupId]);

  const computeAgentFcrHistory = (agentId?: number): number => {
    const agentTickets = currentTickets.filter(t => t.assigned_to_id === agentId);
    if (agentTickets.length === 0) return 0.7;
    return agentTickets.filter(t => t.fcr).length / agentTickets.length;
  };

  const computeCategoryNonFcrRate = (categoryId: number): number => {
    const categoryTickets = currentTickets.filter(t => t.category_id === categoryId);
    if (categoryTickets.length === 0) return 0.3;
    return categoryTickets.filter(t => !t.fcr).length / categoryTickets.length;
  };

  // Active tickets based on filter
  let filteredTickets = groupTickets;
  if (filterStatus === 'active') {
    filteredTickets = groupTickets.filter(t => t.status_id !== 3 && t.status_id !== 4);
  } else if (filterStatus === 'new') {
    filteredTickets = groupTickets.filter(t => t.status_id === 1);
  } else if (filterStatus === 'closed') {
    filteredTickets = groupTickets.filter(t => t.status_id === 3 || t.status_id === 4);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Manager Dashboard</h1>
        <p className="text-gray-600 mt-1">Logged in as: {user?.name || 'Manager'} ({user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Manager'})</p>
        <p className="text-gray-600 mt-1">Viewing tickets for: {displayGroup?.group_name || `Group ${displayGroupId}`}</p>
        {isFallbackGroup && (
          <>
            <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              No non-FCR data exists for the selected team. Showing sample data for {displayGroup?.group_name || `Group ${displayGroupId}`} so ML behavior can be validated.
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <p className="text-xs font-semibold text-slate-500">FCR Risk Distribution</p>
                <div className="mt-2 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskDistributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#EF4444" name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <p className="text-xs font-semibold text-slate-500">Top Non-FCR Drivers</p>
                <div className="mt-2 h-40 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={driverFrequencyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={(entry) => `${entry.name}` }>
                        {driverFrequencyData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={["#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4"][idx % 6]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          {assignmentGroups.map(group => (
            <button
              key={group.assignment_group_id}
              type="button"
              onClick={() => setSelectedGroupId(group.assignment_group_id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${selectedGroupId === group.assignment_group_id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {group.group_name}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <div className="inline-flex rounded-md bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSelectedTab('overview')}
              className={`px-3 py-1 text-sm font-medium rounded ${selectedTab === 'overview' ? 'bg-white text-slate-900 shadow' : 'text-slate-700'}`}>
              Overview
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('recommendations')}
              className={`ml-1 px-3 py-1 text-sm font-medium rounded ${selectedTab === 'recommendations' ? 'bg-white text-slate-900 shadow' : 'text-slate-700'}`}>
              Recommended Allocation
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards for Manager's Group */}
      {selectedTab === 'overview' && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
            <Target className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.slaCompliance.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">{hasData ? `${groupKPIs.totalTickets} total tickets` : 'No data'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
            <Activity className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? `${groupKPIs.fcrRate.toFixed(1)}%` : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">First contact resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Tickets</CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupKPIs.activeTickets : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Non-FCR Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{hasData ? groupNonFCRTickets.length : 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Tickets needing review</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live ML Insights</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Backend ML service signals for {displayGroup?.group_name || `Group ${displayGroupId}`}
            {mlInsights.error ? ` · ${mlInsights.error}` : mlInsights.loading ? ' · Loading ML insights…' : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forecasted volume</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{mlInsights.forecastMean !== null ? `${mlInsights.forecastMean.toFixed(1)}` : 'N/A'}</p>
              <p className="mt-1 text-xs text-slate-600">Forecast mean (7-day horizon)</p>
              <p className="mt-2 text-xs text-slate-500">
                Range {mlInsights.forecastLower !== null ? mlInsights.forecastLower.toFixed(1) : 'N/A'} to {mlInsights.forecastUpper !== null ? mlInsights.forecastUpper.toFixed(1) : 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anomaly detections</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{mlInsights.anomalyCount}</p>
              <p className="mt-1 text-xs text-slate-600">Backend anomaly count</p>
              <p className="mt-2 text-xs text-slate-500">
                Peak signal: {mlInsights.anomalyPeak !== null ? mlInsights.anomalyPeak.toFixed(1) : 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average FCR risk</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{groupNonFCRTickets.length > 0 ? `${averageRiskScore.toFixed(1)}%` : 'N/A'}</p>
              <p className="mt-1 text-xs text-slate-600">Derived from backend FCR scoring</p>
              <p className="mt-2 text-xs text-slate-500">
                {groupNonFCRTickets.length} monitored tickets in this view
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staffing Decision Center</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Prescriptive staffing actions for {displayGroup?.group_name || `Group ${displayGroupId}`}: forecast demand, capacity, workload overload, and simulated staffing outcomes.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forecasted demand</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{forecastDemand.toFixed(1)}</p>
              <p className="mt-1 text-xs text-slate-600">Projected tickets in the horizon</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current capacity</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{currentCapacity}</p>
              <p className="mt-1 text-xs text-slate-600">Tickets handled with current staff</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required staff</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{requiredStaff}</p>
              <p className="mt-1 text-xs text-slate-600">Minimum agents needed</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staffing gap</p>
              <p className={`mt-2 text-3xl font-bold ${staffingGap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{staffingGap >= 0 ? `+${staffingGap}` : staffingGap}</p>
              <p className="mt-1 text-xs text-slate-600">Current {currentStaffCount} vs required {requiredStaff}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Decision summary</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${staffingDecision === 'Hire' ? 'bg-rose-100 text-rose-700' : staffingDecision === 'Redistribute' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {staffingDecision}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">Forecasted demand of <span className="font-semibold text-gray-900">{forecastDemand.toFixed(1)} tickets</span> versus current capacity of <span className="font-semibold text-gray-900">{currentCapacity} tickets</span> creates a <span className="font-semibold text-gray-900">{overloadDelta.toFixed(1)}-ticket overload</span>.</p>
              <p className="mt-2 text-sm text-gray-600">Capacity utilization: <span className="font-semibold text-gray-900">{capacityUtilization.toFixed(1)}%</span> of target capacity.</p>
              <p className="mt-2 text-sm text-gray-600">Workload per agent: <span className="font-semibold text-gray-900">{workloadPerAgent.toFixed(1)} tickets/agent</span>.</p>
              <p className="mt-2 text-sm text-gray-600">Root cause: <span className="font-semibold text-gray-900">{staffingReason}</span>.</p>
              <p className="mt-2 text-sm text-gray-600">Recommended action: <span className="font-semibold text-gray-900">{staffingDecision === 'Hire' ? `Add ${Math.max(staffingGap, 1)} agent(s)` : staffingDecision === 'Redistribute' ? 'Redistribute work across the current team' : 'Maintain current staffing and monitor weekly trends'}</span>.</p>
              <p className="mt-2 text-sm text-gray-600">Best simulated outcome: <span className="font-semibold text-gray-900">{recommendedScenario.scenario} reaches {recommendedScenario.projectedSla.toFixed(1)}% SLA</span>.</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-gray-800">Decision rules</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="rounded-lg bg-rose-50 px-3 py-2">If demand exceeds 110% of team capacity, apply <span className="font-semibold text-rose-700">Hire</span>.</li>
                <li className="rounded-lg bg-amber-50 px-3 py-2">If demand stays between 90% and 110%, apply <span className="font-semibold text-amber-700">Redistribute</span>.</li>
                <li className="rounded-lg bg-emerald-50 px-3 py-2">If demand is under 90% of capacity, <span className="font-semibold text-emerald-700">Maintain</span> staffing.</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">Rule outcome for this team: {staffingDecision} because demand-capacity ratio is {demandCapacityRatio.toFixed(2)}x.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-gray-800">What-if staffing scenarios</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Scenario</th>
                      <th className="text-left">Staff</th>
                      <th className="text-left">Load/agent</th>
                      <th className="text-left">Projected SLA</th>
                      <th className="text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffingScenarioData.map((scenario) => (
                      <tr key={scenario.scenario} className={scenario.scenario === recommendedScenario.scenario ? 'bg-indigo-50' : undefined}>
                        <td className="font-medium">{scenario.scenario}</td>
                        <td>{scenario.staff}</td>
                        <td>{scenario.projectedLoadPerAgent.toFixed(1)} tickets</td>
                        <td>{scenario.projectedSla.toFixed(1)}%</td>
                        <td>{scenario.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-gray-800">{displayGroup?.group_name || `Group ${displayGroupId}`} category workload</h2>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={categoryLoadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="category" type="category" width={140} />
                    <Tooltip />
                    <Bar dataKey="tickets" fill="#4F46E5" radius={[0, 6, 6, 0]} name="Tickets" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team staffing gap analysis</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Cross-team staffing needs by forecast volume, capacity utilization, and workload risk.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Team</th>
                  <th className="text-left">Forecast volume</th>
                  <th className="text-left">Current staff</th>
                  <th className="text-left">Required staff</th>
                  <th className="text-left">Gap</th>
                  <th className="text-left">Load / agent</th>
                  <th className="text-left">Avg risk</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {teamStaffingAnalysis.map((entry) => (
                  <tr key={entry.groupId} className={entry.groupId === displayGroupId ? 'bg-indigo-50' : undefined}>
                    <td className="font-medium">{entry.groupName}</td>
                    <td>{entry.forecastVolume}</td>
                    <td>{entry.currentStaff}</td>
                    <td>{entry.requiredStaff}</td>
                    <td className={entry.staffingGap > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>{entry.staffingGap >= 0 ? `+${entry.staffingGap}` : entry.staffingGap}</td>
                    <td>{entry.workloadPerAgent.toFixed(1)} tickets</td>
                    <td>{entry.avgRisk.toFixed(1)}%</td>
                    <td>{entry.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Task Allocation & Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Allocation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskAllocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{newTasks}</div>
                <p className="text-xs text-gray-500">New Tasks</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{assignedTasks}</div>
                <p className="text-xs text-gray-500">Assigned</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{pendingTasks}</div>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forecast vs actual workload</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Actual ticket volume versus forecast target and capacity threshold for {displayGroup?.group_name || `Group ${displayGroupId}`}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weightedForecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={currentStaffCount * agentCapacityTarget} stroke="#F59E0B" strokeDasharray="4 4" label="Capacity threshold" />
                <Line type="monotone" dataKey="actualTickets" stroke="#4F46E5" strokeWidth={2} name="Actual tickets" />
                <Line type="monotone" dataKey="forecastTarget" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" name="Forecast target" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-gray-600">Capacity threshold is derived from {currentStaffCount} current agents × {agentCapacityTarget} tickets/agent. Values above the threshold indicate overload and potential hiring or redistribution.</div>
          </CardContent>
        </Card>
      </div>

      {/* Non-FCR Detection List */}
      <Card>
        <CardHeader>
          <CardTitle>Non-FCR Detection List - Action Required</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Tickets requiring follow-up or escalation
            {riskLoading ? ' · Loading ML scores…' : riskError ? ` · ${riskError}` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Risk</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Age (days)</th>
                  <th className="text-left p-3 font-medium">Reopens</th>
                </tr>
              </thead>
              <tbody>
                {groupNonFCRTickets.length === 0 ? (
                  <tr className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-500" colSpan={8}>
                      No non-FCR tickets found for this team. Check that the manager is assigned to a valid group and that ticket data is loaded.
                    </td>
                  </tr>
                ) : groupNonFCRTickets.slice(0, 10).map(ticket => {
                  const age = Math.floor(
                    (new Date().getTime() - new Date(ticket.created_date).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const fullTicket = groupTickets.find(t => t.ticket_id === ticket.ticket_id);
                  return (
                    <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                          ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                          ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          P{ticket.priority_id}
                        </span>
                      </td>
                      <td className="p-3">{getCategoryById(ticket.category_id)?.category_name}</td>
                      <td className="p-3 text-xs">
                        {fullTicket?.status_id === 1 && 'New'}
                        {fullTicket?.status_id === 2 && 'In Progress'}
                        {fullTicket?.status_id === 3 && 'Resolved'}
                        {fullTicket?.status_id === 4 && 'Closed'}
                        {fullTicket?.status_id === 5 && 'On Hold'}
                      </td>
                      <td className="p-3">
                        {riskScoreMap[ticket.ticket_id] ? (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            riskScoreMap[ticket.ticket_id].riskScore >= 70 ? 'bg-red-100 text-red-800' :
                            riskScoreMap[ticket.ticket_id].riskScore >= 50 ? 'bg-orange-100 text-orange-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {riskScoreMap[ticket.ticket_id].riskScore}%
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="p-3 text-sm text-slate-700">
                        {riskScoreMap[ticket.ticket_id]?.recommendation ?? 'Monitor ticket'}
                      </td>
                      <td className="p-3">{age}d</td>
                      <td className="p-3 text-center">
                        {(fullTicket?.reopen_count ?? 0) > 0 && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            {fullTicket?.reopen_count}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      

      {/* Agent FCR Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent First Contact Resolution (FCR) Performance</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Agents by FCR rate - identify training needs</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Tickets Resolved</th>
                  <th className="text-left p-3 font-medium">FCR Rate</th>
                  <th className="text-left p-3 font-medium">FCR Count</th>
                  <th className="text-left p-3 font-medium">Non-FCR</th>
                </tr>
              </thead>
              <tbody>
                {getEmployeePerformance(currentTickets)
                  .sort((a, b) => b.ticketsResolved - a.ticketsResolved)
                  .slice(0, 10)
                  .map(agent => {
                    const agentTickets = currentTickets.filter(t => t.assigned_to_id === agent.userId);
                    const fcrCount = agentTickets.filter(t => t.fcr === true).length;
                    const nonFcrCount = agentTickets.filter(t => t.fcr === false).length;
                    const user = getUserById(agent.userId);
                    const fcrColor = agent.fcrRate >= 80 ? 'text-green-600' : agent.fcrRate >= 60 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={agent.userId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{user?.first_name} {user?.last_name}</td>
                        <td className="p-3">{agent.ticketsResolved}</td>
                        <td className={`p-3 font-bold ${fcrColor}`}>{agent.fcrRate.toFixed(1)}%</td>
                        <td className="p-3 text-green-600">{fcrCount}</td>
                        <td className="p-3 text-red-600">{nonFcrCount > 0 ? nonFcrCount : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active Tickets List with Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Tickets</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'new' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('new')}
            >
              New ({newTasks})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('active')}
            >
              Active ({groupKPIs.activeTickets})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'closed' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('closed')}
            >
              Closed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.slice(0, 15).map(ticket => (
                  <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                    <td className="p-3 truncate max-w-xs">{ticket.short_description}</td>
                    <td className="p-3 text-xs">
                      <span className={`px-2 py-1 rounded text-xs ${
                        ticket.status_id === 1 ? 'bg-blue-100 text-blue-800' :
                        ticket.status_id === 2 ? 'bg-purple-100 text-purple-800' :
                        ticket.status_id === 3 ? 'bg-green-100 text-green-800' :
                        ticket.status_id === 4 ? 'bg-gray-100 text-gray-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {ticket.status_id === 1 && 'New'}
                        {ticket.status_id === 2 && 'In Progress'}
                        {ticket.status_id === 3 && 'Resolved'}
                        {ticket.status_id === 4 && 'Closed'}
                        {ticket.status_id === 5 && 'Pending'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                        ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                        ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        P{ticket.priority_id}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {new Date(ticket.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
    )}
    {selectedTab === 'recommendations' ? (
      <Card>
        <CardHeader>
          <CardTitle>Recommended Task Allocation - Start Here</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Tasks ordered by priority and age. We recommend starting with P1 critical issues.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Ticket ID</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Age (days)</th>
                  <th className="text-left p-3 font-medium">SLA Status</th>
                </tr>
              </thead>
              <tbody>
                {recLoading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-sm text-gray-500">Loading recommendations…</td>
                  </tr>
                ) : recommendations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-sm text-gray-500">No recommendations available for this team.</td>
                  </tr>
                ) : (
                  recommendations.map((ticket) => {
                    const age = Math.floor((Date.now() - new Date(ticket.created_date).getTime()) / (1000 * 60 * 60 * 24));
                    const categoryName = getCategoryById(ticket.category_id)?.category_name || 'Uncategorized';
                    const statusText = ticket.status_id === 1 ? 'New' : ticket.status_id === 2 ? 'In Progress' : ticket.status_id === 3 ? 'Resolved' : ticket.status_id === 4 ? 'Closed' : ticket.status_id === 5 ? 'On Hold' : 'Other';
                    const slaText = ticket.made_sla ? 'Met' : 'At Risk';
                    return (
                      <tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs font-medium">{ticket.ticket_id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ticket.priority_id === 1 ? 'bg-red-100 text-red-800' :
                            ticket.priority_id === 2 ? 'bg-orange-100 text-orange-800' :
                            ticket.priority_id === 3 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            P{ticket.priority_id}
                          </span>
                        </td>
                        <td className="p-3">{categoryName}</td>
                        <td className="p-3 text-xs">{statusText}</td>
                        <td className="p-3">{age}d</td>
                        <td className="p-3">{slaText}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {recError && <p className="mt-2 text-xs text-amber-700">{recError}</p>}
        </CardContent>
      </Card>
    ) : null}
    </div>
  );
}
