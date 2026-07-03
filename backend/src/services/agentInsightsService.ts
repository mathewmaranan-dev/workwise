import { query } from '../config/database.js';

const RESOLVED_STATUS_IDS = new Set([3, 4]);
const SLA_TARGET = 80;
const FCR_TARGET = 70;
const REOPEN_TARGET = 10;

interface TicketInsightRow {
  ticket_id: string;
  created_date: string | null;
  resolved_date: string | null;
  status_id: number | null;
  status_name: string | null;
  priority_id: number | null;
  priority_level: string | null;
  assignment_group_id: number | null;
  category_id: number | null;
  category_name: string | null;
  assigned_to_id: number | null;
  reopen_count: number | null;
  fcr: boolean | null;
  made_sla: boolean | null;
  duration: number | null;
  short_description: string | null;
  sla_duedate: string | null;
}

interface MetricSummary {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  slaCompliance: number;
  fcrRate: number;
  reopenRate: number;
  avgResolutionHours: number;
}

interface AgentProfile {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  assignment_group_id: number | null;
  group_name: string | null;
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function isResolved(ticket: TicketInsightRow): boolean {
  const statusId = Number(ticket.status_id ?? 0);
  return RESOLVED_STATUS_IDS.has(statusId);
}

function isOpen(ticket: TicketInsightRow): boolean {
  return !isResolved(ticket);
}

function getResolutionHours(ticket: TicketInsightRow): number | null {
  const durationMinutes = Number(ticket.duration ?? NaN);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return durationMinutes / 60;
  }

  const createdDate = asDate(ticket.created_date);
  const resolvedDate = asDate(ticket.resolved_date);
  if (!createdDate || !resolvedDate) return null;

  return (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
}

function calculateMetrics(tickets: TicketInsightRow[]): MetricSummary {
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter(isResolved);
  const openTickets = totalTickets - resolvedTickets.length;
  const slaMetCount = tickets.filter((ticket) => ticket.made_sla === true).length;
  const fcrCount = tickets.filter((ticket) => ticket.fcr === true).length;
  const reopenedCount = tickets.filter((ticket) => Number(ticket.reopen_count ?? 0) > 0).length;
  const resolutionHours = resolvedTickets
    .map(getResolutionHours)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

  const avgResolutionHours = resolutionHours.length > 0
    ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length
    : 0;

  return {
    totalTickets,
    openTickets,
    resolvedTickets: resolvedTickets.length,
    slaCompliance: totalTickets > 0 ? round((slaMetCount / totalTickets) * 100) : 0,
    fcrRate: totalTickets > 0 ? round((fcrCount / totalTickets) * 100) : 0,
    reopenRate: totalTickets > 0 ? round((reopenedCount / totalTickets) * 100) : 0,
    avgResolutionHours: round(avgResolutionHours),
  };
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function priorityRank(priorityLevel: string | null): number {
  const normalized = String(priorityLevel || '').toLowerCase();
  if (normalized === 'critical') return 1;
  if (normalized === 'high') return 2;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 4;
  return 99;
}

function getUrgencyState(ticket: TicketInsightRow, now: Date): 'breached' | 'due-soon' | 'today' | 'on-track' {
  const dueDate = asDate(ticket.sla_duedate);
  if (!dueDate) return 'on-track';

  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < 0) return 'breached';
  if (diffHours <= 4) return 'due-soon';
  if (diffHours <= 24) return 'today';
  return 'on-track';
}

function classifyStatus(metric: 'sla' | 'fcr' | 'reopen', value: number): 'performing' | 'improve' | 'critical' {
  if (metric === 'sla') {
    if (value >= SLA_TARGET) return 'performing';
    if (value >= 70) return 'improve';
    return 'critical';
  }

  if (metric === 'fcr') {
    if (value >= FCR_TARGET) return 'performing';
    if (value >= 60) return 'improve';
    return 'critical';
  }

  if (value <= REOPEN_TARGET) return 'performing';
  if (value <= 15) return 'improve';
  return 'critical';
}

function buildRecommendations(
  agentMetrics: MetricSummary,
  benchmarkMetrics: MetricSummary,
  openTickets: TicketInsightRow[],
  prioritySummary: Array<{ priority: string; openCount: number; breachedCount: number; dueSoonCount: number }>,
  skillGaps: Array<{ category: string; reopenRate: number; fcrRate: number; slaCompliance: number; action: string; ticketCount: number; teamFcrRate: number; teamSlaCompliance: number }>,
): Array<{ title: string; detail: string; severity: 'high' | 'medium' | 'low' }> {
  const recommendations: Array<{ title: string; detail: string; severity: 'high' | 'medium' | 'low' }> = [];
  const urgentLoad = prioritySummary.filter((item) => item.priority === 'Critical' || item.priority === 'High');
  const urgentBreaches = urgentLoad.reduce((sum, item) => sum + item.breachedCount + item.dueSoonCount, 0);

  if (urgentBreaches > 0) {
    recommendations.push({
      title: 'Protect urgent SLAs first',
      detail: `${urgentBreaches} critical or high-priority tickets are breached or due within 4 hours. Work these before medium and low queue items.`,
      severity: 'high',
    });
  }

  const slaStatus = classifyStatus('sla', agentMetrics.slaCompliance);
  const fcrStatus = classifyStatus('fcr', agentMetrics.fcrRate);
  const reopenStatus = classifyStatus('reopen', agentMetrics.reopenRate);

  if (slaStatus !== 'performing') {
    recommendations.push({
      title: 'Recover SLA compliance',
      detail: `SLA status is ${slaStatus}. Current ${agentMetrics.slaCompliance}% vs target ${SLA_TARGET}%. Prioritize due-today tickets and escalate blockers before breach.`,
      severity: slaStatus === 'critical' ? 'high' : 'medium',
    });
  }

  if (fcrStatus !== 'performing') {
    recommendations.push({
      title: 'Improve first-contact resolution',
      detail: `FCR status is ${fcrStatus}. Current ${agentMetrics.fcrRate}% vs target ${FCR_TARGET}%. Validate root cause before closure in repeat categories.`,
      severity: fcrStatus === 'critical' ? 'high' : 'medium',
    });
  }

  if (reopenStatus !== 'performing') {
    recommendations.push({
      title: 'Reduce reopen risk',
      detail: `Reopen status is ${reopenStatus}. Current ${agentMetrics.reopenRate}% vs target <= ${REOPEN_TARGET}%. Recheck solution completeness before resolution.`,
      severity: reopenStatus === 'critical' ? 'high' : 'medium',
    });
  }

  if (agentMetrics.fcrRate + 10 < benchmarkMetrics.fcrRate) {
    recommendations.push({
      title: 'Use peer benchmark gap',
      detail: `Your FCR trails the team average by ${round(benchmarkMetrics.fcrRate - agentMetrics.fcrRate)} points. Review handoff notes and resolution patterns on similar tickets before closure.`,
      severity: 'medium',
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
      detail: `You are meeting the current SLA (${SLA_TARGET}%) and FCR (${FCR_TARGET}%) expectations. Keep focusing on the oldest urgent work first.`,
      severity: 'low',
    });
  }

  if (openTickets.length === 0) {
    recommendations.unshift({
      title: 'No open assigned tickets',
      detail: 'Your queue is clear. Use the time to document recent fixes or assist with team backlog.',
      severity: 'low',
    });
  }

  return recommendations.slice(0, 6);
}

export async function getAgentInsights(agentId: number) {
  const profileResult = await query(
    `SELECT u.user_id, u.first_name, u.last_name, u.assignment_group_id, ag.group_name
     FROM users u
     LEFT JOIN assignment_groups ag ON ag.assignment_group_id = u.assignment_group_id
     WHERE u.user_id = $1
     LIMIT 1`,
    [agentId]
  );

  const agentProfile = (profileResult.rows[0] ?? null) as AgentProfile | null;
  if (!agentProfile) {
    throw new Error('Agent not found');
  }

  const teamQueryBase = `SELECT
      t.ticket_id,
      t.created_date,
      t.resolved_date,
      t.status_id,
      s.status_name,
      t.priority_id,
      p.priority_level,
      t.assignment_group_id,
      t.category_id,
      c.category_name,
      t.assigned_to_id,
      t.reopen_count,
      t.fcr,
      t.made_sla,
      t.duration,
      t.short_description,
      t.sla_duedate
    FROM tickets t
    LEFT JOIN status s ON s.status_id = t.status_id
    LEFT JOIN priority p ON p.priority_id = t.priority_id
    LEFT JOIN categories c ON c.category_id = t.category_id`;

  const teamQuery = agentProfile.assignment_group_id
    ? `${teamQueryBase} WHERE t.assignment_group_id = $1`
    : `${teamQueryBase}`;
  const teamParams = agentProfile.assignment_group_id ? [agentProfile.assignment_group_id] : [];

  const [agentTicketsResult, teamTicketsResult] = await Promise.all([
    query(
      `SELECT
         t.ticket_id,
         t.created_date,
         t.resolved_date,
         t.status_id,
         s.status_name,
         t.priority_id,
         p.priority_level,
         t.assignment_group_id,
         t.category_id,
         c.category_name,
         t.assigned_to_id,
         t.reopen_count,
         t.fcr,
         t.made_sla,
         t.duration,
         t.short_description,
         t.sla_duedate
       FROM tickets t
       LEFT JOIN status s ON s.status_id = t.status_id
       LEFT JOIN priority p ON p.priority_id = t.priority_id
       LEFT JOIN categories c ON c.category_id = t.category_id
       WHERE t.assigned_to_id = $1
       ORDER BY t.created_date DESC`,
      [agentId]
    ),
    query(teamQuery, teamParams),
  ]);

  const agentTickets = agentTicketsResult.rows as TicketInsightRow[];
  const teamTickets = teamTicketsResult.rows as TicketInsightRow[];
  const agentMetrics = calculateMetrics(agentTickets);
  const benchmarkMetrics = calculateMetrics(teamTickets);
  const now = new Date();

  const priorityMap = new Map<string, { priority: string; openCount: number; breachedCount: number; dueSoonCount: number; todayCount: number }>();
  agentTickets.filter(isOpen).forEach((ticket) => {
    const priority = ticket.priority_level || 'Unspecified';
    const existing = priorityMap.get(priority) || { priority, openCount: 0, breachedCount: 0, dueSoonCount: 0, todayCount: 0 };
    existing.openCount += 1;
    const urgencyState = getUrgencyState(ticket, now);
    if (urgencyState === 'breached') existing.breachedCount += 1;
    if (urgencyState === 'due-soon') existing.dueSoonCount += 1;
    if (urgencyState === 'today') existing.todayCount += 1;
    priorityMap.set(priority, existing);
  });

  const prioritySummary = Array.from(priorityMap.values())
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  const todayTasks = agentTickets
    .filter(isOpen)
    .map((ticket) => {
      const dueDate = asDate(ticket.sla_duedate);
      const urgencyState = getUrgencyState(ticket, now);
      const hoursToSla = dueDate ? round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)) : null;
      let nextAction = 'Continue working';
      if (urgencyState === 'breached') {
        nextAction = 'Escalate immediately';
      } else if (urgencyState === 'due-soon') {
        nextAction = 'Resolve or escalate now';
      } else if ((ticket.priority_level || '').toLowerCase() === 'critical') {
        nextAction = 'Focus first';
      } else if (Number(ticket.reopen_count ?? 0) > 0) {
        nextAction = 'Review previous fix before closure';
      }

      return {
        ticketId: ticket.ticket_id,
        shortDescription: ticket.short_description || 'No description provided',
        priority: ticket.priority_level || 'Unspecified',
        category: ticket.category_name || 'Uncategorized',
        status: ticket.status_name || 'Open',
        createdDate: ticket.created_date,
        slaDueDate: ticket.sla_duedate,
        hoursToSla,
        urgencyState,
        reopenCount: Number(ticket.reopen_count ?? 0),
        nextAction,
      };
    })
    .sort((a, b) => {
      const urgencyOrder: Record<string, number> = { breached: 1, 'due-soon': 2, today: 3, 'on-track': 4 };
      const urgencyDiff = (urgencyOrder[a.urgencyState] || 99) - (urgencyOrder[b.urgencyState] || 99);
      if (urgencyDiff !== 0) return urgencyDiff;
      return priorityRank(a.priority) - priorityRank(b.priority);
    })
    .slice(0, 8);

  const weeklyBuckets = new Map<string, TicketInsightRow[]>();
  agentTickets.filter(isResolved).forEach((ticket) => {
    const resolvedDate = asDate(ticket.resolved_date) ?? asDate(ticket.created_date);
    if (!resolvedDate) return;
    const bucketKey = toDateKey(startOfWeek(resolvedDate));
    const existing = weeklyBuckets.get(bucketKey) || [];
    existing.push(ticket);
    weeklyBuckets.set(bucketKey, existing);
  });

  const trendSeries = Array.from(weeklyBuckets.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-8)
    .map(([weekStart, tickets]) => {
      const metrics = calculateMetrics(tickets);
      return {
        weekStart,
        slaCompliance: metrics.slaCompliance,
        fcrRate: metrics.fcrRate,
        reopenRate: metrics.reopenRate,
        avgResolutionHours: metrics.avgResolutionHours,
        resolvedTickets: metrics.resolvedTickets,
      };
    });

  const teamCategoryMetrics = new Map<number, MetricSummary & { category: string }>();
  const groupedTeamCategories = new Map<number, TicketInsightRow[]>();
  teamTickets.forEach((ticket) => {
    const categoryId = Number(ticket.category_id ?? 0);
    const existing = groupedTeamCategories.get(categoryId) || [];
    existing.push(ticket);
    groupedTeamCategories.set(categoryId, existing);
  });
  groupedTeamCategories.forEach((tickets, categoryId) => {
    teamCategoryMetrics.set(categoryId, {
      ...calculateMetrics(tickets),
      category: tickets[0]?.category_name || 'Uncategorized',
    });
  });

  const groupedAgentCategories = new Map<number, TicketInsightRow[]>();
  agentTickets.forEach((ticket) => {
    const categoryId = Number(ticket.category_id ?? 0);
    const existing = groupedAgentCategories.get(categoryId) || [];
    existing.push(ticket);
    groupedAgentCategories.set(categoryId, existing);
  });

  const skillGaps = Array.from(groupedAgentCategories.entries())
    .map(([categoryId, tickets]) => {
      const metrics = calculateMetrics(tickets);
      const benchmark = teamCategoryMetrics.get(categoryId);
      const category = tickets[0]?.category_name || 'Uncategorized';
      let action = 'Monitor';

      if (metrics.reopenRate > 10 && metrics.fcrRate < FCR_TARGET) {
        action = 'Escalate repeat fixes and request coaching';
      } else if (metrics.slaCompliance < SLA_TARGET) {
        action = 'Triage earlier and escalate blockers sooner';
      } else if (benchmark && metrics.fcrRate + 10 < benchmark.fcrRate) {
        action = 'Compare closure patterns with stronger peers';
      }

      return {
        categoryId,
        category,
        ticketCount: tickets.length,
        slaCompliance: metrics.slaCompliance,
        fcrRate: metrics.fcrRate,
        reopenRate: metrics.reopenRate,
        teamSlaCompliance: benchmark?.slaCompliance ?? 0,
        teamFcrRate: benchmark?.fcrRate ?? 0,
        action,
      };
    })
    .filter((item) => item.ticketCount >= 2 && (item.slaCompliance < SLA_TARGET || item.fcrRate < FCR_TARGET || item.reopenRate > 10 || item.teamFcrRate - item.fcrRate >= 10))
    .sort((a, b) => (b.reopenRate - a.reopenRate) || (a.fcrRate - b.fcrRate))
    .slice(0, 5);

  const benchmarkDelta = {
    slaCompliance: round(agentMetrics.slaCompliance - benchmarkMetrics.slaCompliance),
    fcrRate: round(agentMetrics.fcrRate - benchmarkMetrics.fcrRate),
    reopenRate: round(agentMetrics.reopenRate - benchmarkMetrics.reopenRate),
    avgResolutionHours: round(agentMetrics.avgResolutionHours - benchmarkMetrics.avgResolutionHours),
  };

  const recommendations = buildRecommendations(
    agentMetrics,
    benchmarkMetrics,
    agentTickets.filter(isOpen),
    prioritySummary,
    skillGaps.map((item) => ({
      category: item.category,
      reopenRate: item.reopenRate,
      fcrRate: item.fcrRate,
      slaCompliance: item.slaCompliance,
      action: item.action,
      ticketCount: item.ticketCount,
      teamFcrRate: item.teamFcrRate,
      teamSlaCompliance: item.teamSlaCompliance,
    }))
  );

  return {
    agent: {
      id: agentProfile.user_id,
      firstName: agentProfile.first_name,
      lastName: agentProfile.last_name,
      assignmentGroupId: agentProfile.assignment_group_id,
      assignmentGroupName: agentProfile.group_name,
    },
    expectations: {
      slaCompliance: SLA_TARGET,
      fcrRate: FCR_TARGET,
    },
    generatedAt: new Date().toISOString(),
    kpis: agentMetrics,
    benchmarks: {
      teamAverage: benchmarkMetrics,
      delta: benchmarkDelta,
    },
    prioritySummary,
    trendSeries,
    skillGaps,
    todayTasks,
    recommendations,
    queueHealth: {
      openTickets: agentMetrics.openTickets,
      breachedTickets: todayTasks.filter((ticket) => ticket.urgencyState === 'breached').length,
      dueSoonTickets: todayTasks.filter((ticket) => ticket.urgencyState === 'due-soon').length,
      criticalOpenTickets: prioritySummary
        .filter((item) => item.priority === 'Critical')
        .reduce((sum, item) => sum + item.openCount, 0),
      highOpenTickets: prioritySummary
        .filter((item) => item.priority === 'High')
        .reduce((sum, item) => sum + item.openCount, 0),
    },
  };
}