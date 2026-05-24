import { Category, SubCategory, Ticket, assignmentGroups, categories, channels, configurationItems, impacts, priorities, sources, slas, subCategories, subStatuses, urgencies } from '../data/seedData.js';

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
  agentIds: number[] = Array.from({ length: 12 }, (_, i) => i + 1),
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
  const requesterIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const agentIds = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const openStatuses = [1, 2, 5, 6];
  const resolvedStatuses = [3, 4];
  const statusWeights = [0.15, 0.25, 0.3, 0.08, 0.08, 0.14];

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

  const statusPool = [1, 2, 3, 4, 5, 6];
  const statusProbabilities = [0.15, 0.25, 0.3, 0.1, 0.1, 0.1];

  const lightNotes = [
    'Initial diagnostics performed.',
    'User contacted, issue replicated.',
    'Temporary workaround applied.'
  ];
  const heavyNotes = [
    'Repeated troubleshooting required before resolving.',
    'Escalated to specialist team and monitored ticket progression.',
    'Multiple handoffs and configuration changes were necessary.'
  ];

  const ticketPriorityToSlaId: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4
  };

  for (let i = 0; i < ticketCount; i += 1) {
    const createdDaysAgo = randomInt(1, 90);
    const createdDate = new Date(now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);

    const category = randomChoice(categories);
    const categorySubcats = subCategories.filter(sub => sub.category_id === category.category_id);
    const subcategory = categorySubcats.length > 0 ? randomChoice(categorySubcats) : undefined;
    const priority = randomChoice(priorities);
    const impact = randomChoice(impacts);
    const urgency = randomChoice(urgencies);
    const status = weightedChoice(statusPool, statusProbabilities);
    const slaId = ticketPriorityToSlaId[priority.priority_id] || 4;
    const slaDefinition = slas.find(s => s.sla_id === slaId) ?? slas[slas.length - 1];
    const slaDueDate = new Date(createdDate.getTime() + slaDefinition.sla_hours * 60 * 60 * 1000);

    const reopenCount = Math.random() < 0.25 ? randomInt(1, 3) : 0;
    const reassignmentCount = Math.random() < 0.18 ? randomInt(1, 2) : 0;
    const hasServiceDesk = Math.random() < 0.22;
    const assignedTo = randomChoice(agentIds);
    const requestor = randomChoice(requesterIds);
    const assignmentGroupId = hasServiceDesk ? 5 : randomChoice(assignmentGroups).assignment_group_id;
    const configItem = randomChoice(configurationItems);
    const channel = randomChoice(channels);
    const source = randomChoice(sources);

    const baseDuration = 60 + priority.priority_id * 45 + impact.impact_id * 15 + urgency.urgency_id * 10;
    const durationNoise = randomInt(-20, 80);
    const duration = clamp(baseDuration + durationNoise + reopenCount * 35 + reassignmentCount * 25, 30, 960);

    const resolved = resolvedStatuses.includes(status);
    const resolvedDate = resolved ? new Date(createdDate.getTime() + duration * 60 * 1000) : undefined;
    const lastReopenedAt = reopenCount > 0 ? new Date(createdDate.getTime() + randomInt(12, 72) * 60 * 60 * 1000) : undefined;
    const madeSLA = resolved
      ? resolvedDate! <= slaDueDate
      : now <= slaDueDate;

    const fcrBase = hasServiceDesk ? 0.82 : 0.58;
    const fcrModifier = -0.18 * reopenCount - 0.12 * reassignmentCount - 0.08 * (priority.priority_id === 1 ? 1 : 0);
    const fcrScore = clamp(fcrBase + fcrModifier + randomFloat(-0.06, 0.06), 0.2, 0.95);
    const fcr = fcrScore > 0.55 && reopenCount === 0;

    const availableSubStatuses = subStatuses.filter(sub => [1, 2, 3].includes(sub.status_id));
    const subStatusId = status === 1 || status === 2 || status === 5
      ? randomChoice(availableSubStatuses).sub_status_id
      : undefined;

    const workNotes = `${randomChoice(reopenCount > 0 ? heavyNotes : lightNotes)} ${reassignmentCount > 0 ? 'Reassigned once for specialist review.' : ''}`;

    const ticket: Ticket = {
      ticket_id: `TKT-${String(100000 + i).slice(-6)}`,
      created_date: createdDate.toISOString(),
      resolved_date: resolved ? resolvedDate!.toISOString() : undefined,
      last_reopened_at: lastReopenedAt ? lastReopenedAt.toISOString() : undefined,
      duration: resolved ? duration : undefined,
      reopen_count: reopenCount,
      reassignment_count: reassignmentCount,
      short_description: randomChoice(descriptionTemplates[category.category_id] || ['Ticket created for support request.']),
      work_notes: workNotes,
      made_sla: madeSLA,
      fcr,
      requester_id: requestor,
      assigned_to_id: assignedTo,
      closed_by_id: resolved ? assignedTo : undefined,
      assignment_group_id: assignmentGroupId,
      priority_id: priority.priority_id,
      impact_id: impact.impact_id,
      urgency_id: urgency.urgency_id,
      status_id: status,
      sub_status_id: subStatusId,
      category_id: category.category_id,
      subcategory_id: subcategory?.subcategory_id,
      channel_id: channel.channel_id,
      source_id: source.source_id,
      config_item_id: configItem.config_item_id,
      sla_id: slaDefinition.sla_id,
      sla_duedate: slaDueDate.toISOString()
    };

    tickets.push(ticket);
  }

  return tickets;
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
