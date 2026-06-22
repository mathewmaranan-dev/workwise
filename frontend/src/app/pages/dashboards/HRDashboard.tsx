import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, TrendingUp, Award, AlertCircle, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  calculateKPIs, 
  getAssignmentGroupPerformance, 
  calculateEmployeeSatisfaction, 
  calculateProductivityTrend,
  getOptimizationNeeds 
} from '../../utils/analytics';
import { weeklyCounts, getAssignmentGroupById, getUserById, assignmentGroups, tickets as seedDataTickets } from '../../data/seedData';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

export default function HRDashboard() {
  const { isAuthReady } = useAuth();
  const { data: uploadedData } = useData();
  const [backendTickets, setBackendTickets] = useState<any[]>([]);
  const [backendTicketsLoaded, setBackendTicketsLoaded] = useState(false);
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!isAuthReady) return;

    const token = localStorage.getItem('workwise_token');
    if (!token) {
      setBackendTickets([]);
      setBackendTicketsLoaded(true);
      return;
    }

    setBackendTicketsLoaded(false);
    fetch(`${apiBase.replace(/\/$/, '')}/api/kpis/dashboard/tickets?t=${Date.now()}`, {
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
      .then((tickets) => {
        setBackendTickets(Array.isArray(tickets) ? tickets : []);
      })
      .catch((error) => {
        console.warn('Failed to load backend tickets for HR dashboard', error);
        setBackendTickets([]);
      })
      .finally(() => {
        setBackendTicketsLoaded(true);
      });
  }, [apiBase, isAuthReady]);

  const currentTickets = useMemo(() => {
    if (backendTicketsLoaded) return backendTickets;
    if (uploadedData && uploadedData.length > 0) return uploadedData;
    return [];
  }, [backendTickets, backendTicketsLoaded, uploadedData]);
  const hasData = currentTickets.length > 0;

  const kpis = calculateKPIs(currentTickets);
  const groupPerformance = getAssignmentGroupPerformance(currentTickets);
  const employeeSatisfaction = calculateEmployeeSatisfaction(currentTickets);
  const productivityTrend = calculateProductivityTrend(currentTickets);
  const optimizationNeeds = getOptimizationNeeds(currentTickets);

  const weeklyData = hasData
    ? (() => {
        const map: Record<string, number> = {};
        currentTickets.forEach((t: any) => {
          const d = new Date(t.created_date || t.opened_at);
          if (isNaN(d.getTime())) return;
          const wk = new Date(d);
          wk.setDate(wk.getDate() - wk.getDay());
          const key = wk.toISOString().split('T')[0];
          map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([week, count]) => ({ week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tickets: count }));
      })()
    : weeklyCounts.map(w => ({
        week: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tickets: w.ticket_count
      }));

  // Get top and bottom performing groups
  const performanceScores = groupPerformance.map(g => ({
    ...g,
    teamName: getAssignmentGroupById(g.groupId)?.group_name || `Group ${g.groupId}`,
    overallScore: (g.slaCompliance + g.fcrRate) / 2
  }));

  const staffingSummary = performanceScores.map(group => {
    const groupTickets = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.groupId);
    const assignedAgentIds = new Set(groupTickets
      .map((ticket: any) => ticket.assigned_to_id)
      .filter((value): value is number => typeof value === 'number'));

    const currentStaff = Math.max(assignedAgentIds.size, 1);
    const recommendedStaff = Math.max(Math.ceil(group.totalTickets / 12), currentStaff);
    const staffingGap = Math.max(recommendedStaff - currentStaff, 0);

    return {
      ...group,
      currentStaff,
      recommendedStaff,
      staffingGap,
      priority: staffingGap >= 3 ? 'High' : staffingGap >= 1 ? 'Medium' : 'Low'
    };
  });

  const topPerformers = [...performanceScores]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5);

  const underperformers = [...performanceScores]
    .filter(g => g.overallScore < 75)
    .sort((a, b) => a.overallScore - b.overallScore);

  const recommendationData = useMemo(() => {
    const now = new Date();
    const recentWindowMs = 21 * 24 * 60 * 60 * 1000;
    const previousWindowMs = 42 * 24 * 60 * 60 * 1000;

    const recentTickets = currentTickets.filter((ticket: any) => {
      const date = new Date(ticket.created_date || ticket.created_at || ticket.opened_at || ticket.updated_at || 0);
      return !isNaN(date.getTime()) && date.getTime() >= now.getTime() - recentWindowMs;
    });
    const previousTickets = currentTickets.filter((ticket: any) => {
      const date = new Date(ticket.created_date || ticket.created_at || ticket.opened_at || ticket.updated_at || 0);
      return !isNaN(date.getTime()) &&
        date.getTime() >= now.getTime() - previousWindowMs &&
        date.getTime() < now.getTime() - recentWindowMs;
    });

    const recentCount = recentTickets.length;
    const previousCount = previousTickets.length;
    const growthRate = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 0;
    const isShortTermSpike = recentCount >= 8 && growthRate <= 10 && kpis.slaCompliance >= 88 && kpis.fcrRate >= 75;
    const isSustainedGrowth = growthRate > 10 && recentCount >= 10;

    const groupSummary = performanceScores.map((group) => {
      const groupTickets = currentTickets.filter((ticket: any) => ticket.assignment_group_id === group.groupId);
      const assignedAgentIds = new Set(groupTickets
        .map((ticket: any) => ticket.assigned_to_id)
        .filter((value): value is number => typeof value === 'number'));
      const currentStaff = Math.max(assignedAgentIds.size, 1);
      const targetLoadPerAgent = 12;
      const currentLoadPerAgent = group.totalTickets / Math.max(currentStaff, 1);
      const projectedLoadPerAgent = group.totalTickets / Math.max(currentStaff, 1) * (1 + Math.max(growthRate, 0) / 100);
      const recommendedStaff = Math.max(
        currentStaff,
        Math.ceil(Math.max(group.totalTickets / targetLoadPerAgent, projectedLoadPerAgent / targetLoadPerAgent))
      );
      const capacityGap = Math.max(recommendedStaff - currentStaff, 0);
      const loadRatio = currentLoadPerAgent / targetLoadPerAgent;
      const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(loadRatio - 1) * 40)));
      const teamName = getAssignmentGroupById(group.groupId)?.group_name || `Group ${group.groupId}`;

      const decision = (() => {
        const hasKpiPressure = group.slaCompliance < 90 || group.fcrRate < 75 || group.avgResolutionTime > 1.6;
        if (capacityGap > 0 && hasKpiPressure && (isSustainedGrowth || loadRatio > 1.1)) {
          return 'Hire';
        }
        if (loadRatio > 1.05 && (group.slaCompliance >= 90 || group.fcrRate >= 75)) {
          return 'Temporary staffing / reassign';
        }
        if (group.slaCompliance < 88 || group.fcrRate < 72) {
          return 'Training';
        }
        return 'Retain & monitor';
      })();

      const predictedImpact = (() => {
        switch (decision) {
          case 'Hire':
            return {
              followed: { sla: '+2.5 pts', fcr: '+1.5 pts', resolution: '-0.4h' },
              notFollowed: { sla: '-1.2 pts', fcr: '-1.0 pts', resolution: '+0.3h' },
            };
          case 'Temporary staffing / reassign':
            return {
              followed: { sla: '+1.8 pts', fcr: '+1.0 pts', resolution: '-0.3h' },
              notFollowed: { sla: '-0.8 pts', fcr: '-0.7 pts', resolution: '+0.2h' },
            };
          case 'Training':
            return {
              followed: { sla: '+1.5 pts', fcr: '+3.0 pts', resolution: '-0.4h' },
              notFollowed: { sla: '-0.6 pts', fcr: '-1.8 pts', resolution: '+0.2h' },
            };
          default:
            return {
              followed: { sla: '+0.5 pts', fcr: '+0.4 pts', resolution: '-0.1h' },
              notFollowed: { sla: '-0.3 pts', fcr: '-0.2 pts', resolution: '+0.1h' },
            };
        }
      })();

      return {
        groupId: group.groupId,
        teamName,
        currentLoad: group.totalTickets,
        recommendedLoad: Math.max(group.totalTickets, recommendedStaff * targetLoadPerAgent),
        capacityGap,
        fairnessScore,
        loadRatio,
        decision,
        predictedImpact,
        rationale: (() => {
          if (decision === 'Hire') {
            return `Sustained load above target and KPI pressure indicate a permanent staffing fit.`;
          }
          if (decision === 'Temporary staffing / reassign') {
            return `Workload is elevated, but KPI quality is still acceptable so a short-term response is better.`;
          }
          if (decision === 'Training') {
            return `Performance indicators are below target, so coaching and process improvements should lead first.`;
          }
          return `Current demand is stable and the team is performing within acceptable limits.`;
        })(),
      };
    });

    const agentSummary = Array.from(
      currentTickets.reduce((acc: Map<number, { assignedCount: number; resolvedCount: number; totalMinutes: number }>, ticket: any) => {
        const agentId = typeof ticket.assigned_to_id === 'number' ? ticket.assigned_to_id : null;
        if (!agentId) return acc;

        const entry = acc.get(agentId) || { assignedCount: 0, resolvedCount: 0, totalMinutes: 0 };
        entry.assignedCount += 1;
        if (ticket.status_id === 3 || ticket.status_id === 4) {
          entry.resolvedCount += 1;
          if (typeof ticket.duration === 'number') entry.totalMinutes += ticket.duration;
        }
        acc.set(agentId, entry);
        return acc;
      }, new Map())
    )
      .map(([agentId, stats]) => {
        const user = getUserById(agentId as number);
        const groupId = user?.assignment_group_id;
        const groupName = groupId ? getAssignmentGroupById(groupId)?.group_name : 'Unassigned';
        const avgResolution = stats.resolvedCount > 0 ? stats.totalMinutes / stats.resolvedCount / 60 : 0;
        const currentLoad = stats.assignedCount;
        const recommendedLoad = Math.max(currentLoad, Math.round(currentLoad * (1 + Math.max(growthRate, 0) / 100)));
        const capacityGap = Math.max(recommendedLoad - currentLoad, 0);
        const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs((currentLoad - 8) * 4))));

        return {
          agentId,
          name: user ? `${user.first_name} ${user.last_name}` : `Agent ${agentId}`,
          groupName,
          currentLoad,
          recommendedLoad,
          capacityGap,
          avgResolution,
          fairnessScore,
        };
      })
      .sort((a, b) => b.currentLoad - a.currentLoad)
      .slice(0, 8);

    const recommendations = groupSummary
      .filter((entry) => entry.decision !== 'Retain & monitor' || groupSummary.length <= 3)
      .sort((a, b) => {
        const priorityValue = (decision: string) => decision === 'Hire' ? 3 : decision === 'Training' ? 2 : decision === 'Temporary staffing / reassign' ? 1 : 0;
        return priorityValue(b.decision) - priorityValue(a.decision);
      })
      .slice(0, 6)
      .map((entry) => ({
        category: entry.decision === 'Hire' ? 'Hiring' : entry.decision === 'Training' ? 'Training' : entry.decision === 'Temporary staffing / reassign' ? 'Temporary staffing' : 'Retention',
        teamName: entry.teamName,
        action: (() => {
          if (entry.decision === 'Hire') {
            return `Add ${entry.capacityGap || 1} agent${entry.capacityGap === 1 ? '' : 's'} to ${entry.teamName} to close the sustained capacity gap.`;
          }
          if (entry.decision === 'Temporary staffing / reassign') {
            return `Use temporary staffing or cross-team reassignment for ${entry.teamName} to handle the short-term demand spike.`;
          }
          if (entry.decision === 'Training') {
            return `Run coaching and process improvement for ${entry.teamName} to improve FCR and reduce resolution time.`;
          }
          return `Retain current staffing in ${entry.teamName} and monitor the weekly trend.`;
        })(),
        impact: `${entry.predictedImpact.followed.sla} SLA, ${entry.predictedImpact.followed.fcr} FCR, ${entry.predictedImpact.followed.resolution} resolution`,
        predictedIfFollowed: `If followed: SLA ${entry.predictedImpact.followed.sla}, FCR ${entry.predictedImpact.followed.fcr}, resolution ${entry.predictedImpact.followed.resolution}`,
        predictedIfNotFollowed: `If not followed: SLA ${entry.predictedImpact.notFollowed.sla}, FCR ${entry.predictedImpact.notFollowed.fcr}, resolution ${entry.predictedImpact.notFollowed.resolution}`,
        businessImpact: entry.decision === 'Hire'
          ? 'Reduces overload risk and helps protect SLA during sustained growth.'
          : entry.decision === 'Training'
            ? 'Improves first-contact resolution and lowers avoidable rework.'
            : entry.decision === 'Temporary staffing / reassign'
              ? 'Covers demand peaks without committing to permanent headcount.'
              : 'Maintains service stability while keeping hiring decisions evidence-based.',
        priority: entry.decision === 'Hire' ? 'High' : entry.decision === 'Training' ? 'High' : entry.decision === 'Temporary staffing / reassign' ? 'Medium' : 'Low',
        rationale: entry.rationale,
      }));

    return {
      groupSummary,
      agentSummary,
      recommendations,
      recentCount,
      previousCount,
      growthRate,
      isShortTermSpike,
      isSustainedGrowth,
    };
  }, [currentTickets, kpis, performanceScores, groupPerformance]);

  const {
    groupSummary,
    agentSummary,
    recommendations,
    recentCount,
    previousCount,
    growthRate,
    isShortTermSpike,
    isSustainedGrowth,
  } = recommendationData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">HR & Senior Management Dashboard</h1>
        <p className="text-gray-600 mt-1">Organizational performance, team health, and strategic insights</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Overall Performance</CardTitle>
            <Award className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {((kpis.slaCompliance + kpis.fcrRate) / 2).toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Composite score (SLA + FCR)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Employee Satisfaction</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{employeeSatisfaction.toFixed(1)}/5.0</div>
            <p className="text-xs text-gray-500 mt-1">Based on performance metrics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Productivity Trend</CardTitle>
            <TrendingUp className={`w-4 h-4 ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {productivityTrend >= 0 ? '+' : ''}{productivityTrend.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">vs. previous period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teams Needing Support</CardTitle>
            <AlertCircle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{underperformers.length}</div>
            <p className="text-xs text-gray-500 mt-1">Teams with score &lt;75%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Organizational Workload Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tickets" stroke="#4F46E5" strokeWidth={2} name="Weekly Volume" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={topPerformers.map(g => ({ name: g.teamName, performance: g.overallScore }))} 
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={140} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="performance" fill="#10B981" name="Performance Score" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Staffing Gap Planning */}
      <Card>
        <CardHeader>
          <CardTitle>Team Staffing Gap Planning</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Quantified headcount targets versus current assigned staff by team</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffingSummary.map(group => ({
              name: group.teamName,
              currentStaff: group.currentStaff,
              recommendedStaff: group.recommendedStaff
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="currentStaff" fill="#8B5CF6" name="Current Staff" />
              <Bar dataKey="recommendedStaff" fill="#10B981" name="Recommended Staff" />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Workload</th>
                  <th className="text-left p-3 font-medium">Current Staff</th>
                  <th className="text-left p-3 font-medium">Recommended Staff</th>
                  <th className="text-left p-3 font-medium">Gap</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {staffingSummary
                  .sort((a, b) => b.staffingGap - a.staffingGap)
                  .map(group => (
                    <tr key={group.groupId} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{group.teamName}</td>
                      <td className="p-3">{group.totalTickets} tickets</td>
                      <td className="p-3">{group.currentStaff} agents</td>
                      <td className="p-3">{group.recommendedStaff} agents</td>
                      <td className="p-3 font-medium text-orange-700">{group.staffingGap > 0 ? `+${group.staffingGap}` : 'Balanced'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          group.priority === 'High' ? 'bg-red-100 text-red-800' :
                          group.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {group.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Underperforming Teams Alert */}
      {underperformers.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <CardTitle>Teams Requiring Immediate Attention</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {underperformers.map(group => (
                <div key={group.groupId} className="border rounded p-3 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{group.teamName}</h4>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                      Score: {group.overallScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">SLA Compliance</p>
                      <p className="font-medium">{group.slaCompliance.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">FCR Rate</p>
                      <p className="font-medium">{group.fcrRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Resolution</p>
                      <p className="font-medium">{group.avgResolutionTime.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Team Performance Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">All teams ranked by overall performance score</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team Name</th>
                  <th className="text-left p-3 font-medium">Workload</th>
                  <th className="text-left p-3 font-medium">SLA</th>
                  <th className="text-left p-3 font-medium">FCR</th>
                  <th className="text-left p-3 font-medium">Avg Resolution</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {performanceScores
                  .sort((a, b) => b.overallScore - a.overallScore)
                  .map(group => {
                    const status = group.overallScore >= 80 ? 'Excellent' : 
                                   group.overallScore >= 70 ? 'Good' : 'Needs Support';
                    return (
                      <tr key={group.groupId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{group.teamName}</td>
                        <td className="p-3">{group.totalTickets} tickets</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.slaCompliance >= 90 ? 'bg-green-100 text-green-800' :
                            group.slaCompliance >= 80 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.slaCompliance.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            group.fcrRate >= 75 ? 'bg-green-100 text-green-800' :
                            group.fcrRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {group.fcrRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3">{group.avgResolutionTime.toFixed(1)}h</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            status === 'Excellent' ? 'bg-green-100 text-green-800' :
                            status === 'Good' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Demand Outlook */}
      <Card>
        <CardHeader>
          <CardTitle>Demand Outlook & Scenario Signals</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Recent demand vs. prior period to separate short spikes from sustained growth</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Recent tickets</p>
              <p className="text-2xl font-semibold text-gray-900">{recentCount}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Previous window</p>
              <p className="text-2xl font-semibold text-gray-900">{previousCount}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Growth rate</p>
              <p className="text-2xl font-semibold text-gray-900">{growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Scenario class</p>
              <p className="text-sm font-semibold text-gray-900">{isShortTermSpike ? 'Short-term spike' : isSustainedGrowth ? 'Sustained growth' : 'Stable / monitor'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group Capacity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Group Capacity & Fairness Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Current vs. recommended load, capacity gap, and fairness score</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Current Load</th>
                  <th className="text-left p-3 font-medium">Recommended Load</th>
                  <th className="text-left p-3 font-medium">Gap</th>
                  <th className="text-left p-3 font-medium">Fairness Score</th>
                  <th className="text-left p-3 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {groupSummary.map((entry) => (
                  <tr key={entry.groupId} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{entry.teamName}</td>
                    <td className="p-3">{entry.currentLoad}</td>
                    <td className="p-3">{entry.recommendedLoad}</td>
                    <td className="p-3 font-medium text-orange-700">{entry.capacityGap > 0 ? `+${entry.capacityGap}` : '0'}</td>
                    <td className="p-3">{entry.fairnessScore}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.decision === 'Hire' ? 'bg-red-100 text-red-800' :
                        entry.decision === 'Training' ? 'bg-amber-100 text-amber-800' :
                        entry.decision === 'Temporary staffing / reassign' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {entry.decision}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Agent Load Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Agent-Level Load Summary</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Current vs. recommended workload per agent</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Agent</th>
                  <th className="text-left p-3 font-medium">Team</th>
                  <th className="text-left p-3 font-medium">Current Load</th>
                  <th className="text-left p-3 font-medium">Recommended Load</th>
                  <th className="text-left p-3 font-medium">Gap</th>
                  <th className="text-left p-3 font-medium">Avg Resolution</th>
                  <th className="text-left p-3 font-medium">Fairness</th>
                </tr>
              </thead>
              <tbody>
                {agentSummary.map((agent) => (
                  <tr key={agent.agentId} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{agent.name}</td>
                    <td className="p-3">{agent.groupName}</td>
                    <td className="p-3">{agent.currentLoad}</td>
                    <td className="p-3">{agent.recommendedLoad}</td>
                    <td className="p-3 font-medium text-orange-700">{agent.capacityGap > 0 ? `+${agent.capacityGap}` : '0'}</td>
                    <td className="p-3">{agent.avgResolution.toFixed(1)}h</td>
                    <td className="p-3">{agent.fairnessScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Strategic Actions</CardTitle>
          <p className="text-xs text-gray-500 mt-1">Data-driven recommendations for organizational improvement</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{rec.category}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{rec.action}</p>
                    <p className="text-xs text-gray-500 mb-2">{rec.impact}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If followed</p>
                        <p className="mt-1 text-sm text-gray-700">{rec.predictedIfFollowed}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If not followed</p>
                        <p className="mt-1 text-sm text-gray-700">{rec.predictedIfNotFollowed}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-700"><span className="font-semibold">Business impact:</span> {rec.businessImpact}</p>
                    <p className="mt-1 text-sm text-gray-700"><span className="font-semibold">Rationale:</span> {rec.rationale}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
