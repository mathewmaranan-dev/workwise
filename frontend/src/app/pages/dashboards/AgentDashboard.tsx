import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useLookupData } from '../../hooks/useLookupData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getKpiStatus, KPI_EXPECTATIONS } from '../../utils/kpiStatus';

type Recommendation = {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
};

type TrendPoint = {
  weekStart: string;
  slaCompliance: number;
  fcrRate: number;
  reopenRate: number;
  avgResolutionHours: number;
  resolvedTickets: number;
};

type SkillGap = {
  categoryId: number;
  category: string;
  ticketCount: number;
  slaCompliance: number;
  fcrRate: number;
  reopenRate: number;
  teamSlaCompliance: number;
  teamFcrRate: number;
  action: string;
};

type TaskSnapshot = {
  ticketId: string;
  shortDescription: string;
  priority: string;
  category: string;
  status: string;
  createdDate: string | null;
  slaDueDate: string | null;
  hoursToSla: number | null;
  urgencyState: 'breached' | 'due-soon' | 'today' | 'on-track';
  reopenCount: number;
  nextAction: string;
};

type MetricSummary = {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  slaCompliance: number;
  fcrRate: number;
  reopenRate: number;
  avgResolutionHours: number;
};

type PrioritySummary = {
  priority: string;
  openCount: number;
  breachedCount: number;
  dueSoonCount: number;
  todayCount: number;
};

type AgentInsights = {
  agent: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    assignmentGroupId: number | null;
    assignmentGroupName: string | null;
  };
  expectations: {
    slaCompliance: number;
    fcrRate: number;
  };
  kpis: MetricSummary;
  benchmarks: {
    teamAverage: MetricSummary;
    delta: {
      slaCompliance: number;
      fcrRate: number;
      reopenRate: number;
      avgResolutionHours: number;
    };
  };
  prioritySummary: PrioritySummary[];
  trendSeries: TrendPoint[];
  skillGaps: SkillGap[];
  todayTasks: TaskSnapshot[];
  recommendations: Recommendation[];
  queueHealth: {
    openTickets: number;
    breachedTickets: number;
    dueSoonTickets: number;
    criticalOpenTickets: number;
    highOpenTickets: number;
  };
};

const COLORS = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#475569',
};

function formatDelta(value: number, lowerIsBetter = false) {
  const sign = value > 0 ? '+' : '';
  const isPositive = lowerIsBetter ? value <= 0 : value >= 0;
  return {
    label: `${sign}${value.toFixed(1)}`,
    className: isPositive ? 'text-emerald-700' : 'text-rose-700',
    Icon: isPositive ? TrendingUp : TrendingDown,
  };
}

function getPriorityColor(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized === 'critical') return COLORS.critical;
  if (normalized === 'high') return COLORS.high;
  if (normalized === 'medium') return COLORS.medium;
  return COLORS.low;
}

function getUrgencyClasses(state: TaskSnapshot['urgencyState']) {
  if (state === 'breached') return 'bg-rose-100 text-rose-800 border border-rose-200';
  if (state === 'due-soon') return 'bg-orange-100 text-orange-800 border border-orange-200';
  if (state === 'today') return 'bg-amber-100 text-amber-800 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function formatHoursToSla(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'No SLA due date';
  if (value < 0) return `${Math.abs(value).toFixed(1)}h overdue`;
  return `${value.toFixed(1)}h left`;
}

function formatWeekLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const REOPEN_EXPECTATION = 10;

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value: number, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const multiplier = Math.pow(10, digits);
  return Math.round(value * multiplier) / multiplier;
}

function isResolvedStatus(statusId: number | null | undefined) {
  return Number(statusId) === 3 || Number(statusId) === 4;
}

function buildMetricSummary(tickets: any[]): MetricSummary {
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter((ticket) => isResolvedStatus(ticket.status_id));
  const resolutionHours = resolvedTickets
    .map((ticket) => {
      if (Number(ticket.duration) > 0) return Number(ticket.duration) / 60;
      const createdDate = toDate(ticket.created_date);
      const resolvedDate = toDate(ticket.resolved_date);
      if (!createdDate || !resolvedDate) return null;
      return (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

  const avgResolutionHours = resolutionHours.length > 0
    ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length
    : 0;

  return {
    totalTickets,
    openTickets: tickets.filter((ticket) => !isResolvedStatus(ticket.status_id)).length,
    resolvedTickets: resolvedTickets.length,
    slaCompliance: totalTickets > 0 ? round((tickets.filter((ticket) => ticket.made_sla === true).length / totalTickets) * 100) : 0,
    fcrRate: totalTickets > 0 ? round((tickets.filter((ticket) => ticket.fcr === true).length / totalTickets) * 100) : 0,
    reopenRate: totalTickets > 0 ? round((tickets.filter((ticket) => Number(ticket.reopen_count ?? 0) > 0).length / totalTickets) * 100) : 0,
    avgResolutionHours: round(avgResolutionHours),
  };
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getUrgencyState(hoursToSla: number | null): TaskSnapshot['urgencyState'] {
  if (hoursToSla === null || !Number.isFinite(hoursToSla)) return 'on-track';
  if (hoursToSla < 0) return 'breached';
  if (hoursToSla <= 4) return 'due-soon';
  if (hoursToSla <= 24) return 'today';
  return 'on-track';
}

function classifyKpiState(metric: 'sla' | 'fcr' | 'reopen', value: number): 'performing' | 'improve' | 'critical' {
  if (metric === 'sla') {
    if (value >= KPI_EXPECTATIONS.sla) return 'performing';
    if (value >= 70) return 'improve';
    return 'critical';
  }

  if (metric === 'fcr') {
    if (value >= KPI_EXPECTATIONS.fcr) return 'performing';
    if (value >= 60) return 'improve';
    return 'critical';
  }

  if (value <= 10) return 'performing';
  if (value <= 15) return 'improve';
  return 'critical';
}

function matchesCurrentAgentTicket(ticket: any, currentAgent: any) {
  if (!ticket || !currentAgent) return false;

  const ticketAssignedToId = Number(
    ticket.assigned_to_id ??
    ticket.assigned_to ??
    ticket.agent_id ??
    ticket.user_id
  );
  const ticketAssignedToText = String(
    ticket.assigned_to ??
    ticket.assigned_to_name ??
    ticket.agent_name ??
    ticket.owner ??
    ''
  ).toLowerCase();

  const currentAgentId = Number(currentAgent.user_id ?? currentAgent.id ?? 0);
  const firstName = String(currentAgent.first_name ?? currentAgent.name ?? '').toLowerCase();
  const lastName = String(currentAgent.last_name ?? '').toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = String(currentAgent.email ?? '').toLowerCase();

  return (
    (!Number.isNaN(ticketAssignedToId) && currentAgentId > 0 && ticketAssignedToId === currentAgentId) ||
    (ticketAssignedToText !== '' && (
      (email !== '' && ticketAssignedToText.includes(email)) ||
      (firstName !== '' && ticketAssignedToText.includes(firstName)) ||
      (lastName !== '' && ticketAssignedToText.includes(lastName)) ||
      (fullName !== '' && ticketAssignedToText.includes(fullName))
    ))
  );
}

function buildFallbackInsights({
  currentAgent,
  allTickets,
  agentPool,
  getCategoryName,
  getStatusName,
  getPriorityLabel,
}: {
  currentAgent: any;
  allTickets: any[];
  agentPool: any[];
  getCategoryName: (id: number | string | undefined | null) => string;
  getStatusName: (id: number | string | undefined | null) => string;
  getPriorityLabel: (id: number | string | undefined | null) => string;
}): AgentInsights | null {
  if (!currentAgent || allTickets.length === 0) return null;

  const currentAgentId = Number(currentAgent.user_id ?? currentAgent.id);
  const currentGroupId = Number(currentAgent.assignment_group_id ?? 0) || null;
  const normalizedTickets = allTickets.map((ticket) => ({
    ...ticket,
    ticket_id: String(ticket.ticket_id ?? ticket.id ?? ''),
    assigned_to_id: Number(ticket.assigned_to_id ?? ticket.assigned_to ?? 0) || null,
    assignment_group_id: Number(ticket.assignment_group_id ?? 0) || null,
    status_id: Number(ticket.status_id ?? 0) || null,
    priority_id: Number(ticket.priority_id ?? 0) || null,
    category_id: Number(ticket.category_id ?? 0) || null,
    priority: ticket.priority || getPriorityLabel(ticket.priority_id),
    category: ticket.category || getCategoryName(ticket.category_id),
    status: ticket.status || ticket.status_name || getStatusName(ticket.status_id),
    reopen_count: Number(ticket.reopen_count ?? 0) || 0,
    fcr: ticket.fcr === true || ticket.fcr === 'true',
    made_sla: ticket.made_sla === true || ticket.made_sla === 'true',
    duration: Number(ticket.duration ?? 0) || 0,
  }));

  const matchedAgentTickets = normalizedTickets.filter((ticket) => matchesCurrentAgentTicket(ticket, currentAgent));
  const groupTickets = currentGroupId
    ? normalizedTickets.filter((ticket) => ticket.assignment_group_id === currentGroupId)
    : [];
  const agentTickets = matchedAgentTickets.length > 0
    ? matchedAgentTickets
    : groupTickets.length > 0
    ? groupTickets
    : normalizedTickets;
  const benchmarkPool = groupTickets.length > 0 ? groupTickets : normalizedTickets;

  if (agentTickets.length === 0) return null;

  const kpis = buildMetricSummary(agentTickets);
  const teamAverage = buildMetricSummary(benchmarkPool);
  const delta = {
    slaCompliance: round(kpis.slaCompliance - teamAverage.slaCompliance),
    fcrRate: round(kpis.fcrRate - teamAverage.fcrRate),
    reopenRate: round(kpis.reopenRate - teamAverage.reopenRate),
    avgResolutionHours: round(kpis.avgResolutionHours - teamAverage.avgResolutionHours),
  };

  const now = new Date();
  const priorityMap = new Map<string, PrioritySummary>();
  const openTickets = agentTickets.filter((ticket) => !isResolvedStatus(ticket.status_id));

  const todayTasks: TaskSnapshot[] = openTickets
    .map((ticket) => {
      const dueDate = toDate(ticket.sla_duedate);
      const hoursToSla = dueDate ? round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)) : null;
      const urgencyState = getUrgencyState(hoursToSla);
      const priority = String(ticket.priority || 'Unspecified');

      const summary = priorityMap.get(priority) || {
        priority,
        openCount: 0,
        breachedCount: 0,
        dueSoonCount: 0,
        todayCount: 0,
      };
      summary.openCount += 1;
      if (urgencyState === 'breached') summary.breachedCount += 1;
      if (urgencyState === 'due-soon') summary.dueSoonCount += 1;
      if (urgencyState === 'today') summary.todayCount += 1;
      priorityMap.set(priority, summary);

      let nextAction = 'Continue working';
      if (urgencyState === 'breached') nextAction = 'Escalate immediately';
      else if (urgencyState === 'due-soon') nextAction = 'Resolve or escalate now';
      else if (priority === 'Critical') nextAction = 'Focus first';
      else if (Number(ticket.reopen_count) > 0) nextAction = 'Review previous fix before closure';

      return {
        ticketId: ticket.ticket_id,
        shortDescription: ticket.short_description || 'No description provided',
        priority,
        category: String(ticket.category || 'Uncategorized'),
        status: String(ticket.status || 'Open'),
        createdDate: ticket.created_date || null,
        slaDueDate: ticket.sla_duedate || null,
        hoursToSla,
        urgencyState,
        reopenCount: Number(ticket.reopen_count ?? 0),
        nextAction,
      };
    })
    .sort((a, b) => {
      const urgencyOrder = { breached: 1, 'due-soon': 2, today: 3, 'on-track': 4 };
      return (urgencyOrder[a.urgencyState] - urgencyOrder[b.urgencyState]) || a.priority.localeCompare(b.priority);
    })
    .slice(0, 8);

  const trendBuckets = new Map<string, any[]>();
  agentTickets.filter((ticket) => isResolvedStatus(ticket.status_id)).forEach((ticket) => {
    const basis = toDate(ticket.resolved_date) || toDate(ticket.created_date);
    if (!basis) return;
    const key = startOfWeek(basis).toISOString().slice(0, 10);
    const bucket = trendBuckets.get(key) || [];
    bucket.push(ticket);
    trendBuckets.set(key, bucket);
  });

  const trendSeries: TrendPoint[] = Array.from(trendBuckets.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-8)
    .map(([weekStart, tickets]) => {
      const metrics = buildMetricSummary(tickets);
      return {
        weekStart,
        slaCompliance: metrics.slaCompliance,
        fcrRate: metrics.fcrRate,
        reopenRate: metrics.reopenRate,
        avgResolutionHours: metrics.avgResolutionHours,
        resolvedTickets: metrics.resolvedTickets,
      };
    });

  const benchmarkCategoryMap = new Map<number, MetricSummary>();
  const benchmarkGroups = new Map<number, any[]>();
  benchmarkPool.forEach((ticket) => {
    const categoryId = Number(ticket.category_id ?? 0);
    const group = benchmarkGroups.get(categoryId) || [];
    group.push(ticket);
    benchmarkGroups.set(categoryId, group);
  });
  benchmarkGroups.forEach((tickets, categoryId) => {
    benchmarkCategoryMap.set(categoryId, buildMetricSummary(tickets));
  });

  const skillGapGroups = new Map<number, any[]>();
  agentTickets.forEach((ticket) => {
    const categoryId = Number(ticket.category_id ?? 0);
    const group = skillGapGroups.get(categoryId) || [];
    group.push(ticket);
    skillGapGroups.set(categoryId, group);
  });

  const skillGaps: SkillGap[] = Array.from(skillGapGroups.entries())
    .map(([categoryId, tickets]) => {
      const metrics = buildMetricSummary(tickets);
      const teamMetrics = benchmarkCategoryMap.get(categoryId);
      let action = 'Monitor';
      if (metrics.reopenRate > 10 && metrics.fcrRate < KPI_EXPECTATIONS.fcr) {
        action = 'Escalate repeat fixes and request coaching';
      } else if (metrics.slaCompliance < KPI_EXPECTATIONS.sla) {
        action = 'Triage earlier and escalate blockers sooner';
      } else if (teamMetrics && metrics.fcrRate + 10 < teamMetrics.fcrRate) {
        action = 'Compare closure patterns with stronger peers';
      }

      return {
        categoryId,
        category: String(tickets[0]?.category || 'Uncategorized'),
        ticketCount: tickets.length,
        slaCompliance: metrics.slaCompliance,
        fcrRate: metrics.fcrRate,
        reopenRate: metrics.reopenRate,
        teamSlaCompliance: teamMetrics?.slaCompliance ?? 0,
        teamFcrRate: teamMetrics?.fcrRate ?? 0,
        action,
      };
    })
    .filter((item) => item.ticketCount >= 2 && (item.slaCompliance < KPI_EXPECTATIONS.sla || item.fcrRate < KPI_EXPECTATIONS.fcr || item.reopenRate > 10 || item.teamFcrRate - item.fcrRate >= 10))
    .sort((a, b) => (b.reopenRate - a.reopenRate) || (a.fcrRate - b.fcrRate))
    .slice(0, 5);

  const prioritySummary = Array.from(priorityMap.values()).sort((a, b) => a.priority.localeCompare(b.priority));
  const queueHealth = {
    openTickets: kpis.openTickets,
    breachedTickets: todayTasks.filter((task) => task.urgencyState === 'breached').length,
    dueSoonTickets: todayTasks.filter((task) => task.urgencyState === 'due-soon').length,
    criticalOpenTickets: prioritySummary.filter((item) => item.priority === 'Critical').reduce((sum, item) => sum + item.openCount, 0),
    highOpenTickets: prioritySummary.filter((item) => item.priority === 'High').reduce((sum, item) => sum + item.openCount, 0),
  };

  const recommendations: Recommendation[] = [];
  if (queueHealth.breachedTickets + queueHealth.dueSoonTickets > 0) {
    recommendations.push({
      title: 'Protect urgent SLAs first',
      detail: `${queueHealth.breachedTickets + queueHealth.dueSoonTickets} tickets are breached or due within 4 hours. Work these before lower-risk items.`,
      severity: 'high',
    });
  }

  const slaState = classifyKpiState('sla', kpis.slaCompliance);
  const fcrState = classifyKpiState('fcr', kpis.fcrRate);
  const reopenState = classifyKpiState('reopen', kpis.reopenRate);

  if (slaState !== 'performing') {
    recommendations.push({
      title: 'Recover SLA compliance',
      detail: `SLA status is ${slaState}. Current ${kpis.slaCompliance}% vs target ${KPI_EXPECTATIONS.sla}%. Prioritize due-today work and escalate blockers earlier.`,
      severity: slaState === 'critical' ? 'high' : 'medium',
    });
  }
  if (fcrState !== 'performing') {
    recommendations.push({
      title: 'Improve first-contact resolution',
      detail: `FCR status is ${fcrState}. Current ${kpis.fcrRate}% vs target ${KPI_EXPECTATIONS.fcr}%. Confirm root cause before closure on repeat categories.`,
      severity: fcrState === 'critical' ? 'high' : 'medium',
    });
  }
  if (reopenState !== 'performing') {
    recommendations.push({
      title: 'Reduce reopen risk',
      detail: `Reopen status is ${reopenState}. Current ${kpis.reopenRate}% vs target <= 10%. Recheck solution completeness before closure.`,
      severity: reopenState === 'critical' ? 'high' : 'medium',
    });
  }

  if (skillGaps.length > 0) {
    skillGaps.slice(0, 2).forEach((gap) => {
      const fcrDelta = round(gap.fcrRate - gap.teamFcrRate);
      const slaDelta = round(gap.slaCompliance - gap.teamSlaCompliance);
      recommendations.push({
        title: `Category focus: ${gap.category}`,
        detail: `${gap.action} FCR ${gap.fcrRate}% (${fcrDelta >= 0 ? '+' : ''}${fcrDelta} vs team), SLA ${gap.slaCompliance}% (${slaDelta >= 0 ? '+' : ''}${slaDelta} vs team), based on ${gap.ticketCount} tickets.`,
        severity: gap.fcrRate < 60 || gap.slaCompliance < 70 || gap.reopenRate > 15 ? 'high' : 'medium',
      });
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Maintain current operating pattern',
      detail: 'Current local metrics are within the expected range. Keep prioritizing the oldest urgent work first.',
      severity: 'low',
    });
  }

  const agentRecord = agentPool.find((agent) => Number(agent.id) === currentAgentId) || currentAgent;

  return {
    agent: {
      id: currentAgentId,
      firstName: agentRecord.first_name || null,
      lastName: agentRecord.last_name || null,
      assignmentGroupId: currentGroupId,
      assignmentGroupName: agentRecord.assignment_group || null,
    },
    expectations: {
      slaCompliance: KPI_EXPECTATIONS.sla,
      fcrRate: KPI_EXPECTATIONS.fcr,
    },
    kpis,
    benchmarks: {
      teamAverage,
      delta,
    },
    prioritySummary,
    trendSeries,
    skillGaps,
    todayTasks,
    recommendations: recommendations.slice(0, 6),
    queueHealth,
  };
}

function buildEmptyInsights(currentAgent: any, agentPool: any[]): AgentInsights | null {
  if (!currentAgent) return null;

  const currentAgentId = Number(currentAgent.user_id ?? currentAgent.id ?? 0);
  const agentRecord = agentPool.find((agent) => Number(agent.id) === currentAgentId) || currentAgent;

  return {
    agent: {
      id: currentAgentId,
      firstName: agentRecord.first_name || null,
      lastName: agentRecord.last_name || null,
      assignmentGroupId: Number(currentAgent.assignment_group_id ?? 0) || null,
      assignmentGroupName: agentRecord.assignment_group || null,
    },
    expectations: {
      slaCompliance: KPI_EXPECTATIONS.sla,
      fcrRate: KPI_EXPECTATIONS.fcr,
    },
    kpis: {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0,
      slaCompliance: 0,
      fcrRate: 0,
      reopenRate: 0,
      avgResolutionHours: 0,
    },
    benchmarks: {
      teamAverage: {
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        slaCompliance: 0,
        fcrRate: 0,
        reopenRate: 0,
        avgResolutionHours: 0,
      },
      delta: {
        slaCompliance: 0,
        fcrRate: 0,
        reopenRate: 0,
        avgResolutionHours: 0,
      },
    },
    prioritySummary: [],
    trendSeries: [],
    skillGaps: [],
    todayTasks: [],
    recommendations: [
      {
        title: 'No agent ticket data available',
        detail: 'The dashboard could not load live insight data, so it is showing an empty fallback state until ticket analytics become available.',
        severity: 'low',
      },
    ],
    queueHealth: {
      openTickets: 0,
      breachedTickets: 0,
      dueSoonTickets: 0,
      criticalOpenTickets: 0,
      highOpenTickets: 0,
    },
  };
}

export default function AgentDashboard({ showAgentSelector = false }: { showAgentSelector?: boolean }) {
  const { user, users: authUsers, isAuthReady } = useAuth();
  const { data: contextTickets } = useData();
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [insights, setInsights] = useState<AgentInsights | null>(null);
  const [fallbackTickets, setFallbackTickets] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingFallbackTickets, setLoadingFallbackTickets] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;
  const { getCategoryName, getStatusName, getPriorityLabel } = useLookupData(apiBase, token || undefined);

  const agents = useMemo(
    () => authUsers.filter((candidate) => String(candidate.role || '').toLowerCase().includes('agent')),
    [authUsers]
  );
  const currentUserId = user ? parseInt(user.id, 10) : null;

  useEffect(() => {
    if (showAgentSelector && selectedAgent === null && agents.length > 0) {
      setSelectedAgent(parseInt(agents[0].id, 10));
    }
    if (!showAgentSelector && selectedAgent !== null) {
      setSelectedAgent(null);
    }
  }, [showAgentSelector, selectedAgent, agents]);

  const currentAgent = showAgentSelector
    ? selectedAgent !== null ? agents.find((agent) => parseInt(agent.id, 10) === selectedAgent) : null
    : (user?.role === 'agent' && currentUserId !== null)
      ? {
          id: currentUserId,
          user_id: currentUserId,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email,
        }
      : null;

  useEffect(() => {
    const agentId = currentAgent ? Number((currentAgent as any).user_id ?? (currentAgent as any).id) : null;
    if (!apiBase || !isAuthReady || !agentId || !token) {
      setInsights(null);
      setInsightError(null);
      setLoadingInsights(false);
      return;
    }

    setLoadingInsights(true);
    setInsightError(null);
    fetch(`${apiBase.replace(/\/$/, '')}/api/kpis/agent/${encodeURIComponent(agentId)}/insights`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const backendError = data && typeof data.error === 'string' ? data.error : '';
          const statusText = `${response.status}${backendError ? ` - ${backendError}` : ''}`;
          throw new Error(`Failed to load agent insights (${statusText})`);
        }
        setInsights(data as AgentInsights);
      })
      .catch((error) => {
        console.warn('Failed to load agent insights from backend', error);
        setInsights(null);
        setInsightError(String(error));
      })
      .finally(() => {
        setLoadingInsights(false);
      });
  }, [apiBase, currentAgent, isAuthReady, token]);

  useEffect(() => {
    const agentId = currentAgent ? Number((currentAgent as any).user_id ?? (currentAgent as any).id) : null;
    if (!apiBase || !isAuthReady || !agentId || !token) {
      setFallbackTickets([]);
      setLoadingFallbackTickets(false);
      return;
    }

    setLoadingFallbackTickets(true);
    fetch(`${apiBase.replace(/\/$/, '')}/api/kpis/dashboard/tickets?limit=20000`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load fallback ticket analytics');
        }
        const data = await response.json();
        setFallbackTickets(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.warn('Failed to load fallback ticket analytics', error);
        setFallbackTickets([]);
      })
      .finally(() => {
        setLoadingFallbackTickets(false);
      });
  }, [apiBase, currentAgent, isAuthReady, token]);

  const displayName = useMemo(() => {
    if (insights?.agent) {
      return `${insights.agent.firstName || ''} ${insights.agent.lastName || ''}`.trim() || 'Agent';
    }
    if (currentAgent) {
      return `${(currentAgent as any).first_name || (currentAgent as any).name || ''} ${(currentAgent as any).last_name || ''}`.trim() || 'Agent';
    }
    return 'Agent';
  }, [currentAgent, insights]);

  const benchmarkCards = useMemo(() => {
    if (!insights) return [];
    return [
      {
        title: 'SLA vs team',
        delta: formatDelta(insights.benchmarks.delta.slaCompliance),
        value: `${insights.kpis.slaCompliance.toFixed(1)}%`,
        benchmark: `${insights.benchmarks.teamAverage.slaCompliance.toFixed(1)}%`,
      },
      {
        title: 'FCR vs team',
        delta: formatDelta(insights.benchmarks.delta.fcrRate),
        value: `${insights.kpis.fcrRate.toFixed(1)}%`,
        benchmark: `${insights.benchmarks.teamAverage.fcrRate.toFixed(1)}%`,
      },
      {
        title: 'Reopen vs team',
        delta: formatDelta(insights.benchmarks.delta.reopenRate, true),
        value: `${insights.kpis.reopenRate.toFixed(1)}%`,
        benchmark: `${insights.benchmarks.teamAverage.reopenRate.toFixed(1)}%`,
      },
      {
        title: 'Resolution time vs team',
        delta: formatDelta(insights.benchmarks.delta.avgResolutionHours, true),
        value: `${insights.kpis.avgResolutionHours.toFixed(1)}h`,
        benchmark: `${insights.benchmarks.teamAverage.avgResolutionHours.toFixed(1)}h`,
      },
    ];
  }, [insights]);

  const kpiStatus = useMemo(() => {
    if (!insights) return null;
    return {
      sla: getKpiStatus('sla', insights.kpis.slaCompliance),
      fcr: getKpiStatus('fcr', insights.kpis.fcrRate),
    };
  }, [insights]);

  const fallbackInsights = useMemo(
    () => buildFallbackInsights({
      currentAgent,
      allTickets: fallbackTickets.length > 0 ? fallbackTickets : contextTickets,
      agentPool: agents,
      getCategoryName,
      getStatusName,
      getPriorityLabel,
    }),
    [agents, contextTickets, currentAgent, fallbackTickets, getCategoryName, getPriorityLabel, getStatusName]
  );

  const displayedInsights = insights ?? fallbackInsights ?? buildEmptyInsights(currentAgent, agents);

  const displayedKpiStatus = useMemo(() => {
    if (!displayedInsights) return null;
    return {
      sla: getKpiStatus('sla', displayedInsights.kpis.slaCompliance),
      fcr: getKpiStatus('fcr', displayedInsights.kpis.fcrRate),
    };
  }, [displayedInsights]);

  const displayedBenchmarkCards = useMemo(() => {
    if (!displayedInsights) return [];
    return [
      {
        title: 'SLA vs team',
        delta: formatDelta(displayedInsights.benchmarks.delta.slaCompliance),
        value: `${displayedInsights.kpis.slaCompliance.toFixed(1)}%`,
        benchmark: `${displayedInsights.benchmarks.teamAverage.slaCompliance.toFixed(1)}%`,
      },
      {
        title: 'FCR vs team',
        delta: formatDelta(displayedInsights.benchmarks.delta.fcrRate),
        value: `${displayedInsights.kpis.fcrRate.toFixed(1)}%`,
        benchmark: `${displayedInsights.benchmarks.teamAverage.fcrRate.toFixed(1)}%`,
      },
      {
        title: 'Reopen vs team',
        delta: formatDelta(displayedInsights.benchmarks.delta.reopenRate, true),
        value: `${displayedInsights.kpis.reopenRate.toFixed(1)}%`,
        benchmark: `${displayedInsights.benchmarks.teamAverage.reopenRate.toFixed(1)}%`,
      },
      {
        title: 'Resolution time vs team',
        delta: formatDelta(displayedInsights.benchmarks.delta.avgResolutionHours, true),
        value: `${displayedInsights.kpis.avgResolutionHours.toFixed(1)}h`,
        benchmark: `${displayedInsights.benchmarks.teamAverage.avgResolutionHours.toFixed(1)}h`,
      },
    ];
  }, [displayedInsights]);

  const categoryActionCards = useMemo(() => {
    if (!displayedInsights) return [];
    return displayedInsights.skillGaps
      .slice(0, 4)
      .map((gap) => {
      const fcrDelta = round(gap.fcrRate - gap.teamFcrRate);
      const slaDelta = round(gap.slaCompliance - gap.teamSlaCompliance);
      const reopenNeedsWork = gap.reopenRate > REOPEN_EXPECTATION;
      const fcrNeedsWork = gap.fcrRate < KPI_EXPECTATIONS.fcr || gap.fcrRate < gap.teamFcrRate;
      const slaNeedsWork = gap.slaCompliance < KPI_EXPECTATIONS.sla || gap.slaCompliance < gap.teamSlaCompliance;

      const kpis = [
        fcrNeedsWork
          ? {
              name: 'FCR',
              value: `${gap.fcrRate.toFixed(1)}%`,
              target: `>= ${KPI_EXPECTATIONS.fcr}%`,
              team: `${fcrDelta >= 0 ? '+' : ''}${fcrDelta} vs team`,
            }
          : null,
        slaNeedsWork
          ? {
              name: 'SLA',
              value: `${gap.slaCompliance.toFixed(1)}%`,
              target: `>= ${KPI_EXPECTATIONS.sla}%`,
              team: `${slaDelta >= 0 ? '+' : ''}${slaDelta} vs team`,
            }
          : null,
        reopenNeedsWork
          ? {
              name: 'Reopen',
              value: `${gap.reopenRate.toFixed(1)}%`,
              target: `<= ${REOPEN_EXPECTATION}%`,
              team: 'Lower is better',
            }
          : null,
      ].filter((item): item is { name: string; value: string; target: string; team: string } => item !== null);

      if (kpis.length === 0) {
        return null;
      }

      return {
        key: `category-${gap.categoryId}`,
        title: `Improve Category: ${gap.category}`,
        kpis,
        next: `${gap.action} Review this category first (${gap.ticketCount} tickets).`,
        severity: gap.fcrRate < 60 || gap.slaCompliance < 70 || gap.reopenRate > 15 ? 'high' as const : 'medium' as const,
      };
    })
      .filter((item): item is { key: string; title: string; kpis: Array<{ name: string; value: string; target: string; team: string }>; next: string; severity: 'high' | 'medium' } => item !== null);
  }, [displayedInsights]);

  if (!isAuthReady) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Loading agent dashboard…</h1>
      </div>
    );
  }

  if (!currentAgent) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Agent dashboard unavailable</h1>
        <p className="text-gray-600 mt-2">Please log in as a valid support agent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IT Support Agent Dashboard</h1>
          <p className="text-gray-600 mt-1">Performance guidance for {displayName}</p>
        </div>
        {showAgentSelector ? (
          <div className="w-full max-w-xs">
            <label className="text-sm font-medium text-gray-700 block mb-2">Select Agent</label>
            <Select value={selectedAgent != null ? String(selectedAgent) : undefined} onValueChange={(value) => setSelectedAgent(parseInt(value, 10))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.first_name || agent.name} {agent.last_name || ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {insightError && !displayedInsights ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4 text-sm text-rose-700">{insightError}</CardContent>
        </Card>
      ) : null}

      {loadingInsights && !displayedInsights && !loadingFallbackTickets ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">Loading agent performance insights…</CardContent>
        </Card>
      ) : null}

      {displayedInsights ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-3xl font-bold text-gray-900">{displayedInsights.kpis.slaCompliance.toFixed(1)}%</div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${displayedKpiStatus?.sla.badgeClass}`}>
                    {displayedKpiStatus?.sla.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">System expectation: {displayedInsights.expectations.slaCompliance ?? KPI_EXPECTATIONS.sla}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">FCR Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-3xl font-bold text-gray-900">{displayedInsights.kpis.fcrRate.toFixed(1)}%</div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${displayedKpiStatus?.fcr.badgeClass}`}>
                    {displayedKpiStatus?.fcr.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">System expectation: {displayedInsights.expectations.fcrRate ?? KPI_EXPECTATIONS.fcr}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Reopen Rate</CardTitle>
                <RefreshMetricIcon />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{displayedInsights.kpis.reopenRate.toFixed(1)}%</div>
                <p className="mt-2 text-xs text-gray-500">Lower is better. Team average: {displayedInsights.benchmarks.teamAverage.reopenRate.toFixed(1)}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg Resolution Time</CardTitle>
                <Clock className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{displayedInsights.kpis.avgResolutionHours.toFixed(1)}h</div>
                <p className="mt-2 text-xs text-gray-500">Resolved tickets: {displayedInsights.kpis.resolvedTickets}</p>
              </CardContent>
            </Card>
          </div>

        
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Benchmark &amp; Guidance Hub</CardTitle>
                <p className="text-xs text-slate-500">Quick comparison and clear next actions.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-900">Peer Benchmark Comparison</p>
                      <p className="text-xs text-slate-500">Your metrics vs team average.</p>
                    </div>
                    <div className="space-y-3">
                      {displayedBenchmarkCards.map((item) => {
                        const DeltaIcon = item.delta.Icon;
                        return (
                          <div key={item.title} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-700">{item.title}</p>
                                <p className="mt-1 text-xl font-bold text-slate-900">{item.value}</p>
                              </div>
                              <div className={`flex items-center gap-1 text-sm font-semibold ${item.delta.className}`}>
                                <DeltaIcon className="h-4 w-4" />
                                {item.delta.label}
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Team average: {item.benchmark}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-900">Actionable Recommendations</p>
                      <p className="text-xs text-slate-500">Category-focused cards with KPIs that need improvement.</p>
                    </div>
                    <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                      {categoryActionCards.length > 0 ? categoryActionCards.map((item) => (
                        <div key={item.key} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.severity === 'high' ? 'bg-rose-100 text-rose-800' : item.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                              {item.severity}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-2">
                            {item.kpis.map((kpi) => (
                              <div key={`${item.key}-${kpi.name}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{kpi.name}</p>
                                <p className="mt-1 text-sm text-slate-800">{kpi.value} <span className="text-slate-500">target {kpi.target}</span></p>
                                <p className="text-xs text-slate-500">{kpi.team}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-sm text-slate-600"><span className="font-medium">Do next:</span> {item.next}</p>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                          No category KPI requires improvement right now.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </>
      ) : null}
    </div>
  );
}

function RefreshMetricIcon() {
  return <AlertCircle className="h-4 w-4 text-rose-600" />;
}
