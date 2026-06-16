import { Category, SubCategory, Ticket, assignmentGroups, categories, channels, configurationItems, impacts, priorities, sources, slas, subCategories, subStatuses, statuses, urgencies, users } from '../data/seedData.js';

export interface WorkloadBalanceSample {
  agent_id: number;
  assignment_group_id: number;
  active_tickets: number;
  average_resolution_time: number; // minutes
  sla_compliance: number; // 0-1
  fcr_rate: number; // 0-1
  reopen_rate: number; // 0-1
  workload_ratio: number; // agent vs group average
  extreme_ratio: number; // busiest vs freest agent in group
  group_average_tickets: number;
  group_max_tickets: number;
  group_min_tickets: number;
  imbalance_label: boolean;
  imbalance_reason: string;
}

export interface NonFCRSample {
  ticket_id: string;
  assignment_group_id: number;
  assigned_to_id: number;
  category_id: number;
  subcategory_id?: number;
  priority_id: number;
  impact_id: number;
  urgency_id: number;
  channel_id: number;
  source_id: number;
  reopen_count: number;
  reassignment_count: number;
  duration: number; // minutes
  ticket_complexity: number;
  agent_fcr_history: number; // 0-1
  category_non_fcr_rate: number; // 0-1
  non_fcr_label: boolean;
}

export interface StaffingIntelligenceRecord {
  period_id: string;
  week_of_year: number;
  month: number;
  season: 'winter' | 'spring' | 'summer' | 'fall';
  ticket_volume: number;
  active_staff: number;
  projected_ticket_volume: number;
  required_staff: number;
  ticket_to_staff_ratio: number;
  sla_compliance: number; // 0-1
  fcr_rate: number; // 0-1
  average_resolution_time: number; // minutes
  workforce_sufficient: boolean;
}

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number): number => Math.random() * (max - min) + min;
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const weightedChoice = <T>(items: T[], weights: number[]): T => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};
const randomChoice = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const categoryRiskMap: Record<number, number> = {
  1: 0.1,
  2: 0.35,
  3: 0.4,
  4: 0.15,
  5: 0.15,
  6: 0.2,
  7: 0.25,
  8: 0.35
};

const getSeason = (month: number): StaffingIntelligenceRecord['season'] => {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'fall';
};

const ticketPriorityToSlaId: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4
};

const activeAgents = users.filter(user => user.role_id === 4);
const activeAgentIds = activeAgents.map(user => user.user_id);
const agentsByGroup = activeAgents.reduce((map: Record<number, number[]>, agent) => {
  if (agent.assignment_group_id) {
    map[agent.assignment_group_id] = map[agent.assignment_group_id] ?? [];
    map[agent.assignment_group_id].push(agent.user_id);
  }
  return map;
}, {});

const chooseAgentByGroup = (groupId?: number): number => {
  if (groupId && Array.isArray(agentsByGroup[groupId]) && agentsByGroup[groupId].length > 0) {
    return randomChoice(agentsByGroup[groupId]);
  }
  return activeAgentIds.length > 0 ? randomChoice(activeAgentIds) : 4;
};

/**
 * Generates synthetic agent-level workload balance data for the workload balancer model.
 */
export const generateWorkloadBalanceDataset = (
  agentCount: number = 24,
  groupIds: number[] = assignmentGroups.map(group => group.assignment_group_id)
): WorkloadBalanceSample[] => {
  const samples: WorkloadBalanceSample[] = [];

  const agentsPerGroup = Math.max(3, Math.floor(agentCount / groupIds.length));
  const groupLoads: Record<number, number[]> = {};

  groupIds.forEach(groupId => {
    groupLoads[groupId] = [];
    for (let i = 0; i < agentsPerGroup; i += 1) {
      const activeTickets = randomInt(4, 18);
      groupLoads[groupId].push(activeTickets);
    }
  });

  groupIds.forEach(groupId => {
    const groupTickets = groupLoads[groupId];
    const groupAverage = groupTickets.reduce((sum, value) => sum + value, 0) / groupTickets.length;
    const groupMax = Math.max(...groupTickets);
    const groupMin = Math.min(...groupTickets);
    const groupExtremeRatio = groupMin > 0 ? groupMax / groupMin : groupMax;

    groupTickets.forEach((activeTickets, index) => {
      const averageResolutionTime = clamp(randomFloat(140, 320) + (activeTickets - groupAverage) * 8, 90, 540);
      const slaCompliance = clamp(0.55 + 0.4 * (1 - (activeTickets - groupAverage) / Math.max(groupAverage, 1)) + randomFloat(-0.08, 0.08), 0.4, 1);
      const fcrRate = clamp(0.6 + 0.15 * (1 - (activeTickets - groupAverage) / Math.max(groupAverage, 1)) + randomFloat(-0.1, 0.1), 0.3, 0.95);
      const reopenRate = clamp(0.1 + 0.15 * ((activeTickets - groupAverage) / Math.max(groupAverage, 1)) + randomFloat(-0.05, 0.05), 0, 0.5);
      const workloadRatio = activeTickets / Math.max(groupAverage, 1);
      const extremeRatio = groupExtremeRatio;

      const imbalanceLabel =
        workloadRatio >= 1.4 ||
        extremeRatio >= 2.5 ||
        (workloadRatio >= 1.2 && slaCompliance < 0.85) ||
        (slaCompliance < 0.8 && activeTickets > groupAverage);

      const imbalanceReasons: string[] = [];
      if (workloadRatio >= 1.4) imbalanceReasons.push('Agent workload substantially above group average');
      if (extremeRatio >= 2.5) imbalanceReasons.push('Large gap between busiest and freest agent');
      if (workloadRatio >= 1.2 && slaCompliance < 0.85) imbalanceReasons.push('High load with low SLA compliance');
      if (slaCompliance < 0.8) imbalanceReasons.push('SLA compliance below acceptable threshold');
      const imbalanceReason = imbalanceReasons.length > 0 ? imbalanceReasons.join('; ') : 'Balanced distribution';

      samples.push({
        agent_id: groupId * 100 + index + 1,
        assignment_group_id: groupId,
        active_tickets: activeTickets,
        average_resolution_time: Math.round(averageResolutionTime),
        sla_compliance: parseFloat(slaCompliance.toFixed(3)),
        fcr_rate: parseFloat(fcrRate.toFixed(3)),
        reopen_rate: parseFloat(reopenRate.toFixed(3)),
        workload_ratio: parseFloat(workloadRatio.toFixed(3)),
        extreme_ratio: parseFloat(extremeRatio.toFixed(3)),
        group_average_tickets: parseFloat(groupAverage.toFixed(2)),
        group_max_tickets: groupMax,
        group_min_tickets: groupMin,
        imbalance_label: imbalanceLabel,
        imbalance_reason: imbalanceReason
      });
    });
  });

  return samples;
};

/**
 * Generates synthetic ticket-level data for Non-FCR detection.
 */
export const generateNonFCRDataset = (
  ticketCount: number = 400,
  agentIds: number[] = activeAgentIds,
  groupIds: number[] = assignmentGroups.map(group => group.assignment_group_id)
): NonFCRSample[] => {
  const samples: NonFCRSample[] = [];
  const agentBaseFCR: Record<number, number> = {};
  agentIds.forEach(agentId => {
    agentBaseFCR[agentId] = clamp(randomFloat(0.62, 0.92), 0.5, 0.95);
  });

  for (let i = 0; i < ticketCount; i += 1) {
    const category = weightedChoice(categories, categories.map((_, idx) => idx === 1 || idx === 2 || idx === 7 ? 3 : 1));
    const relevantSubCategories = subCategories.filter(sub => sub.category_id === category.category_id);
    const subcategory = relevantSubCategories.length > 0 ? randomChoice(relevantSubCategories) : undefined;
    const assignedTo = randomChoice(agentIds);
    const groupId = randomChoice(groupIds);
    const priorityId = weightedChoice(priorities, [3, 3, 2, 1]).priority_id;
    const impactId = weightedChoice(impacts, [3, 3, 2, 1]).impact_id;
    const urgencyId = weightedChoice(urgencies, [3, 3, 2]).urgency_id;
    const channelId = randomChoice(channels).channel_id;
    const sourceId = randomChoice(sources).source_id;

    const baseComplexity = categoryRiskMap[category.category_id] * 10;
    const ticketComplexity = clamp(Math.round(baseComplexity + (priorityId - 1) * 1.4 + (impactId - 1) * 1.2 + (urgencyId - 1) * 1), 1, 12);
    const reopenCount = Math.random() < 0.22 ? randomInt(1, 3) : 0;
    const reassignmentCount = Math.random() < 0.15 ? randomInt(1, 2) : 0;
    const duration = clamp(Math.round(60 + ticketComplexity * 25 + reopenCount * 40 + reassignmentCount * 30 + randomFloat(-15, 35)), 45, 840);

    const categoryRisk = categoryRiskMap[category.category_id];
    const rawNonFCRScore =
      0.15 * (priorityId === 1 ? 1 : 0) +
      0.2 * categoryRisk +
      0.18 * (reopenCount > 0 ? 1 : 0) +
      0.12 * (reassignmentCount > 0 ? 1 : 0) +
      0.12 * clamp((duration - 120) / 360, 0, 1) +
      0.23 * (1 - agentBaseFCR[assignedTo]) +
      randomFloat(-0.05, 0.05);

    const nonFCRProbability = clamp(rawNonFCRScore, 0, 1);
    const nonFCRLabel = Math.random() < nonFCRProbability;

    samples.push({
      ticket_id: `SYN-${String(100000 + i).slice(-6)}`,
      assignment_group_id: groupId,
      assigned_to_id: assignedTo,
      category_id: category.category_id,
      subcategory_id: subcategory?.subcategory_id,
      priority_id: priorityId,
      impact_id: impactId,
      urgency_id: urgencyId,
      channel_id: channelId,
      source_id: sourceId,
      reopen_count: reopenCount,
      reassignment_count: reassignmentCount,
      duration,
      ticket_complexity: ticketComplexity,
      agent_fcr_history: parseFloat(agentBaseFCR[assignedTo].toFixed(3)),
      category_non_fcr_rate: parseFloat(clamp(categoryRisk + randomFloat(-0.05, 0.05), 0, 1).toFixed(3)),
      non_fcr_label: nonFCRLabel
    });
  }

  return samples;
};

/**
 * Generates a synthetic staffing intelligence dataset with seasonal ticket volume and workforce sufficiency labels.
 */
export const generateStaffingIntelligenceDataset = (
  periods: number = 52,
  startWeek: number = 1,
  startYear: number = new Date().getFullYear()
): StaffingIntelligenceRecord[] => {
  const records: StaffingIntelligenceRecord[] = [];
  let trendBase = 0;

  for (let i = 0; i < periods; i += 1) {
    const weekOfYear = ((startWeek + i - 1) % 52) + 1;
    const month = Math.ceil(weekOfYear / 4) as StaffingIntelligenceRecord['month'];
    const season = getSeason(month);
    const seasonalVolume =
      80 +
      18 * Math.sin((2 * Math.PI * weekOfYear) / 52) +
      8 * Math.cos((2 * Math.PI * weekOfYear) / 13);
    const trendAdjustment = trendBase + randomFloat(-3, 3);
    const ticketVolume = Math.max(28, Math.round(seasonalVolume + trendAdjustment + randomFloat(-12, 12)));
    const requiredStaff = Math.max(4, Math.ceil(ticketVolume / 9));
    const staffingSlack = randomInt(-2, 2);
    const activeStaff = Math.max(3, requiredStaff + staffingSlack);
    const ticketToStaffRatio = parseFloat((ticketVolume / Math.max(activeStaff, 1)).toFixed(2));
    const baseSLA = clamp(0.92 - 0.04 * Math.max(0, ticketToStaffRatio - 9) + randomFloat(-0.05, 0.04), 0.62, 0.98);
    const baseFCR = clamp(0.8 - 0.03 * Math.max(0, ticketToStaffRatio - 9) + randomFloat(-0.05, 0.03), 0.55, 0.92);
    const avgResolutionTime = clamp(170 + 9 * Math.max(0, ticketToStaffRatio - 8) + randomFloat(-20, 30), 95, 420);
    const workforceSufficient = activeStaff >= requiredStaff && baseSLA >= 0.85;

    records.push({
      period_id: `${startYear}-W${String(weekOfYear).padStart(2, '0')}`,
      week_of_year: weekOfYear,
      month,
      season,
      ticket_volume: ticketVolume,
      active_staff: activeStaff,
      projected_ticket_volume: Math.round(ticketVolume * randomFloat(1.03, 1.16)),
      required_staff: requiredStaff,
      ticket_to_staff_ratio: ticketToStaffRatio,
      sla_compliance: parseFloat(baseSLA.toFixed(3)),
      fcr_rate: parseFloat(baseFCR.toFixed(3)),
      average_resolution_time: Math.round(avgResolutionTime),
      workforce_sufficient: workforceSufficient
    });
  }

  return records;
};

/**
 * Generates synthetic raw ticket rows matching the tickets table schema.
 */
export const generateTicketDataset = (
  ticketCount: number = 500,
  now: Date = new Date()
): Ticket[] => {
  const tickets: Ticket[] = [];
  const requesterIds = users.filter(user => user.role_id !== 4).map(user => user.user_id).filter(id => id !== 1);

  const chooseAssignmentGroup = () => weightedChoice(
    assignmentGroupWeights.map(item => item.id),
    assignmentGroupWeights.map(item => item.weight)
  );

  const descriptionTemplates: Record<number, string[]> = {
    1: [
      'User unable to access corporate network',
      'Wi-Fi disconnects intermittently',
      'VPN connection fails for remote worker'
    ],
    2: [
      'Software installation blocked by license',
      'Application crashes on launch',
      'Update fails during install'
    ],
    3: [
      'Desktop machine will not boot',
      'Server fan alert detected',
      'Printer hardware failure in office'
    ],
    4: [
      'Account locked after too many attempts',
      'Cannot access shared drive',
      'User requires password reset'
    ],
    5: [
      'Email delivery delays for the team',
      'Inbox synchronization stopped',
      'Mail client cannot send attachments'
    ],
    6: [
      'VPN tunnel drops after login',
      'Remote site cannot authenticate',
      'Two-factor authentication fails intermittently'
    ],
    7: [
      'Password reset required for locked account',
      'Password expired and user cannot log in',
      'MFA device not recognized during login'
    ],
    8: [
      'Printer cannot complete job',
      'Paper feed error persists',
      'Printer queue stalled on network printer'
    ]
  };

  const batchId = `BATCH-${now.toISOString().slice(0, 10).replace(/-/g, '')}`;
  const statusIds = {
    New: statuses.find(s => s.status_name === 'New')?.status_id ?? 1,
    InProgress: statuses.find(s => s.status_name === 'In Progress')?.status_id ?? 2,
    Resolved: statuses.find(s => s.status_name === 'Resolved')?.status_id ?? 3,
    Closed: statuses.find(s => s.status_name === 'Closed')?.status_id ?? 4,
    Pending: statuses.find(s => s.status_name === 'Pending')?.status_id ?? 7
  };

  const pendingReasonIds = subStatuses
    .filter(sub => sub.status_id === statusIds.Pending)
    .map(sub => sub.sub_status_id);

  const assignmentGroupWeights = [
    { id: 5, weight: 0.33 },
    { id: 1, weight: 0.23 },
    { id: 2, weight: 0.18 },
    { id: 3, weight: 0.14 },
    { id: 4, weight: 0.12 }
  ];

  const priorityBreachRates: Record<number, [number, number]> = {
    4: [0.05, 0.08],
    3: [0.10, 0.12],
    2: [0.15, 0.20],
    1: [0.20, 0.25]
  };

  const reopenReasons = [
    'Issue resurfaced after a temporary closure',
    'New evidence reopened the ticket',
    'Vendor dependency triggered reopen',
    'Customer provided additional information required for rework'
  ];

  const buildSeasonalWeight = (date: Date) => {
    const weekday = date.getDay();
    let weight = weekday >= 1 && weekday <= 4 ? 1.0 : weekday === 5 ? 0.85 : 0.65;
    const month = date.getMonth();
    const day = date.getDate();
    if ([2, 5, 8, 11].includes(month) && day >= 20) weight += 0.18;
    if (month === 11 && day >= 18) weight -= 0.15;
    if (month === 6 && day <= 7) weight -= 0.12;
    return clamp(weight, 0.25, 1.4);
  };

  const chooseCreatedDate = () => {
    const offsets: { offset: number; date: Date; weight: number }[] = [];
    for (let offset = 0; offset <= 89; offset += 1) {
      const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      const weight = buildSeasonalWeight(date) * clamp(1.05 - offset / 140, 0.3, 1.0);
      offsets.push({ offset, date, weight });
    }
    const days = weightedChoice(offsets, offsets.map(item => item.weight));
    const createdDate = new Date(days.date);
    const hour = createdDate.getDay() >= 1 && createdDate.getDay() <= 4 ? randomInt(8, 17) : randomInt(9, 20);
    createdDate.setHours(hour, randomInt(0, 59), 0, 0);
    return {
      createdDate,
      daysAgo: days.offset,
      seasonalIntensity: days.weight
    };
  };

  const getAgeBucket = (daysAgo: number) => {
    if (daysAgo <= 3) return 'recent';
    if (daysAgo <= 14) return 'mid';
    return 'older';
  };

  const chooseStatus = (bucket: 'recent' | 'mid' | 'older', intensity: number) => {
    const statuses = [
      statusIds.New,
      statusIds.InProgress,
      statusIds.Pending,
      statusIds.Closed,
      statusIds.Resolved
    ];

    let weights: number[];
    if (bucket === 'recent') weights = [0.35, 0.30, 0.15, 0.045, 0.105];
    else if (bucket === 'mid') weights = [0.09, 0.25, 0.15, 0.095, 0.415];
    else weights = [0.025, 0.09, 0.09, 0.115, 0.68];

    if (intensity > 1.15) weights = [weights[0] * 0.95, weights[1] * 1.08, weights[2] * 1.05, weights[3] * 1.04, weights[4] * 0.88];
    if (intensity < 0.9) weights = [weights[0] * 0.96, weights[1] * 0.92, weights[2] * 1.03, weights[3] * 1.03, weights[4] * 1.06];

    const normalized = weights.map(w => w / weights.reduce((sum, value) => sum + value, 0));
    return weightedChoice(statuses, normalized);
  };

  const chooseAssignmentGroup = () => weightedChoice(
    assignmentGroupWeights.map(item => item.id),
    assignmentGroupWeights.map(item => item.weight)
  );

  const slaMissed = (
    statusId: number,
    priorityId: number,
    reopenCount: number,
    daysAgo: number,
    dueDate: Date,
    resolvedDate?: Date
  ) => {
    const [minBreach, maxBreach] = priorityBreachRates[priorityId] ?? [0.1, 0.15];
    let chance = randomFloat(minBreach, maxBreach);
    if (statusId === statusIds.Closed || statusId === statusIds.Pending) chance += 0.05;
    if (reopenCount > 0) chance += 0.06;
    if (daysAgo > 14) chance += 0.04;
    chance = clamp(chance, 0.05, 0.45);
    if (statusId === statusIds.Resolved) return resolvedDate ? resolvedDate > dueDate : Math.random() < chance;
    return now > dueDate && Math.random() < chance;
  };

  const buildTicket = (
    ticketId: string,
    createdDate: Date,
    statusId: number,
    rootId?: string,
    parentId?: string,
    reopenReason?: string,
    followUpReopenCount?: number,
    overrideAssignmentGroup?: number
  ): Ticket => {
    const category = randomChoice(categories);
    const categorySubcats = subCategories.filter(sub => sub.category_id === category.category_id);
    const subcategory = categorySubcats.length > 0 ? randomChoice(categorySubcats) : undefined;
    const priority = randomChoice(priorities);
    const impact = randomChoice(impacts);
    const urgency = randomChoice(urgencies);
    const slaId = ticketPriorityToSlaId[priority.priority_id] || 4;
    const slaDefinition = slas.find(s => s.sla_id === slaId) ?? slas[slas.length - 1];
    const slaDueDate = new Date(createdDate.getTime() + slaDefinition.sla_hours * 60 * 60 * 1000);
    const assignmentGroupId = overrideAssignmentGroup ?? chooseAssignmentGroup();
    const assignedTo = chooseAgentByGroup(assignmentGroupId);
    const requestor = randomChoice(requesterIds.length > 0 ? requesterIds : activeAgentIds);

    const reopenCount = followUpReopenCount !== undefined
      ? followUpReopenCount
      : statusId === statusIds.Closed && Math.random() < 0.88
        ? randomInt(1, 3)
        : Math.random() < 0.16
          ? randomInt(1, 2)
          : 0;

    const reassignmentCount = Math.random() < 0.16 ? randomInt(1, 3) : 0;
    const workMinutes = clamp(45 + priority.priority_id * 28 + impact.impact_id * 12 + urgency.urgency_id * 10 + reopenCount * 28 + reassignmentCount * 18 + randomInt(-10, 40), 15, 720);
    const resolvedDate = statusId === statusIds.Resolved
      ? new Date(createdDate.getTime() + workMinutes * 60 * 1000)
      : undefined;
    const lastReopenedAt = reopenCount > 0
      ? new Date(Math.min(now.getTime(), createdDate.getTime() + randomInt(8, 72) * 60 * 60 * 1000)).toISOString()
      : undefined;

    const madeSLA = !slaMissed(statusId, priority.priority_id, reopenCount, Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000)), slaDueDate, resolvedDate);
    const fcr = statusId === statusIds.Resolved && reopenCount === 0 && Math.random() < 0.7;

    const subStatusId = statusId === statusIds.Pending && pendingReasonIds.length > 0
      ? randomChoice(pendingReasonIds)
      : undefined;

    return {
      ticket_id: ticketId,
      created_date: createdDate.toISOString(),
      resolved_date: resolvedDate ? resolvedDate.toISOString() : undefined,
      last_reopened_at: lastReopenedAt,
      duration: statusId === statusIds.New ? undefined : workMinutes,
      reopen_count: reopenCount,
      reassignment_count: reassignmentCount,
      short_description: randomChoice(descriptionTemplates[category.category_id] || ['Ticket created for support request.']),
      work_notes: `${randomChoice(reopenCount > 0 ? [
        'Reopened ticket requires follow-up work and detailed logging.',
        'Customer returned with new details after the prior closure.',
        'Workflow resumed after dependency clearance and specialist review.'
      ] : [
        'Initial diagnostics performed.',
        'User contacted, issue replicated.',
        'Temporary workaround applied.'
      ])} ${reassignmentCount > 0 ? 'Reassigned once for specialist review.' : ''}`,
      made_sla: madeSLA,
      fcr,
      requester_id: requestor,
      assigned_to_id: assignedTo,
      closed_by_id: statusId === statusIds.Closed ? assignedTo : undefined,
      resolved_by_id: statusId === statusIds.Resolved ? assignedTo : undefined,
      assignment_group_id: assignmentGroupId,
      priority_id: priority.priority_id,
      impact_id: impact.impact_id,
      urgency_id: urgency.urgency_id,
      status_id: statusId,
      sub_status_id: subStatusId,
      category_id: category.category_id,
      subcategory_id: subcategory?.subcategory_id,
      channel_id: randomChoice(channels).channel_id,
      source_id: randomChoice(sources).source_id,
      config_item_id: randomChoice(configurationItems).config_item_id,
      sla_id: slaDefinition.sla_id,
      sla_duedate: slaDueDate.toISOString(),
      ticket_series_id: rootId ?? ticketId,
      parent_ticket_id: parentId,
      reopen_reason: reopenReason,
      batch_id: batchId
    };
  };

  const followUpCount = Math.max(1, Math.round(ticketCount * 0.14));
  const rootCount = ticketCount - followUpCount;
  const rootTickets: Ticket[] = [];

  for (let i = 0; i < rootCount; i += 1) {
    const created = chooseCreatedDate();
    const statusId = chooseStatus(getAgeBucket(created.daysAgo) as 'recent' | 'mid' | 'older', created.seasonalIntensity);
    const ticketId = `TKT-${String(100000 + i).slice(-6)}`;
    rootTickets.push(buildTicket(ticketId, created.createdDate, statusId));
  }

  for (let i = 0; i < followUpCount; i += 1) {
    const root = randomChoice(rootTickets);
    const rootCreated = new Date(root.created_date);
    const followUpDate = new Date(Math.min(now.getTime(), rootCreated.getTime() + randomInt(1, 28) * 24 * 60 * 60 * 1000));
    const ticketId = `REOPEN-${root.ticket_id}-${String(i + 1).padStart(2, '0')}`;
    const statusId = weightedChoice([statusIds.InProgress, statusIds.Closed, statusIds.Resolved], [0.58, 0.32, 0.10]);
    tickets.push(buildTicket(ticketId, followUpDate, statusId, root.ticket_series_id ?? root.ticket_id, root.ticket_id, randomChoice(reopenReasons), randomInt(1, 3), root.assignment_group_id));
  }

  tickets.push(...rootTickets);
  return tickets.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
};

/**
 * Generic CSV exporter for synthetic datasets.
 */
export const exportSyntheticDatasetAsCSV = <T extends object>(data: T[]): string => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => {
    const record = row as Record<string, unknown>;
    return headers
      .map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      })
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
};
