#!/usr/bin/env node

/**
 * Seed synthetic tickets into the database
 * Generates 3 months of realistic ticket data with proper distributions
 * 
 * Usage:
 * node scripts/seed_synthetic_tickets.js [ticketCount] [daysBack]
 * 
 * Examples:
 * node scripts/seed_synthetic_tickets.js         # Default: 500 tickets, 90 days
 * node scripts/seed_synthetic_tickets.js 1000    # 1000 tickets, 90 days
 * node scripts/seed_synthetic_tickets.js 500 90  # 500 tickets, 90 days back
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

// Seed data
const categoryRiskMap = {
  1: 0.1,
  2: 0.35,
  3: 0.4,
  4: 0.15,
  5: 0.15,
  6: 0.2,
  7: 0.25,
  8: 0.35
};

const reopenReasons = [
  'Issue resurfaced after a temporary closure',
  'New evidence reopened the ticket',
  'Vendor dependency triggered reopen',
  'Customer provided additional information required for rework'
];

const descriptionTemplates = {
  1: [
    'User unable to access corporate network',
    'VPN connection fails for remote worker',
    'Access control rule blocking essential service'
  ],
  2: [
    'Software installation blocked by license',
    'Application crashes on launch',
    'Update fails during install'
  ],
  3: [
    'Desktop machine will not boot',
    'Server rack power fault detected',
    'Printer hardware failure in office'
  ],
  4: [
    'Password reset required after lockout',
    'Password expired and user cannot log in',
    'User account locked due to repeated failures'
  ],
  5: [
    'Email delivery delays for the team',
    'Inbox synchronization stopped',
    'Mail client cannot send attachments'
  ],
  6: [
    'Two-factor authentication fails intermittently',
    'SSO login returns unexpected error',
    'Authentication token rejected during login'
  ],
  7: [
    'Alert floods from monitoring dashboard',
    'Unable to access log files for audit',
    'System monitoring alerts not updating'
  ],
  8: [
    'Server CPU utilization remains above threshold',
    'Disk space warning on production server',
    'Network latency spike on backend host'
  ]
};

const priorityBreachRates = {
  4: [0.03, 0.06],
  3: [0.05, 0.08],
  2: [0.08, 0.12],
  1: [0.12, 0.16]
};

const assignmentGroupWeights = [
  { id: 5, weight: 0.33 },
  { id: 1, weight: 0.23 },
  { id: 2, weight: 0.18 },
  { id: 3, weight: 0.14 },
  { id: 4, weight: 0.12 }
];

// Assign realistic category weights per assignment group.
// Service Desk is intentionally broader and gets both general and some technical categories at lower rates.
const categoryDistributionByGroup = {
  1: {
    'Software': 0.35,
    'Password': 0.20,
    'Authentication': 0.15,
    'Access Control': 0.10,
    'Email': 0.10,
    'Logging & Monitoring': 0.05,
    'Hardware': 0.03,
    'Server': 0.02
  },
  2: {
    'Access Control': 0.30,
    'Server': 0.25,
    'Logging & Monitoring': 0.20,
    'Hardware': 0.10,
    'Authentication': 0.10,
    'Software': 0.05,
    'Email': 0.00,
    'Password': 0.00
  },
  3: {
    'Authentication': 0.30,
    'Access Control': 0.25,
    'Logging & Monitoring': 0.20,
    'Email': 0.10,
    'Software': 0.10,
    'Hardware': 0.03,
    'Server': 0.02,
    'Password': 0.00
  },
  4: {
    'Hardware': 0.35,
    'Server': 0.25,
    'Software': 0.10,
    'Access Control': 0.10,
    'Authentication': 0.10,
    'Email': 0.05,
    'Logging & Monitoring': 0.05,
    'Password': 0.00
  },
  5: {
    'Password': 0.35,
    'Access Control': 0.10,
    'Email': 0.20,
    'Software': 0.12,
    'Hardware': 0.10,
    'Authentication': 0.06,
    'Logging & Monitoring': 0.04,
    'Server': 0.03
  }
};

const defaultCategoryWeights = {
  'Software': 0.20,
  'Password': 0.15,
  'Access Control': 0.15,
  'Hardware': 0.15,
  'Email': 0.15,
  'Authentication': 0.10,
  'Logging & Monitoring': 0.05,
  'Server': 0.05
};

const ticketPriorityToSlaId = {
  1: 1,
  2: 2,
  3: 2,
  4: 3
};

// Utility functions
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randomChoice = (items) => items[Math.floor(Math.random() * items.length)];
const weightedChoice = (items, weights) => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};

async function fetchSeedData() {
  const client = await pool.connect();
  try {
    console.log('📋 Fetching seed data...');

    const categoriesRes = await client.query('SELECT * FROM category ORDER BY category_id');
    const subcategoriesRes = await client.query('SELECT * FROM subcategory ORDER BY subcategory_id');
    const prioritiesRes = await client.query('SELECT * FROM priority ORDER BY priority_id');
    const impactsRes = await client.query('SELECT * FROM impact ORDER BY impact_id');
    const urgenciesRes = await client.query('SELECT * FROM urgency ORDER BY urgency_id');
    const channelsRes = await client.query('SELECT * FROM channel ORDER BY channel_id');
    const sourcesRes = await client.query('SELECT * FROM source ORDER BY source_id');
    const slasRes = await client.query('SELECT * FROM sla ORDER BY sla_id');
    const statusesRes = await client.query('SELECT * FROM status ORDER BY status_id');
    const subStatusesRes = await client.query('SELECT * FROM sub_status ORDER BY sub_status_id');
    const usersRes = await client.query('SELECT * FROM users ORDER BY user_id');
    const configItemsRes = await client.query('SELECT * FROM configuration_items ORDER BY config_item_id LIMIT 10');
    const rolesRes = await client.query('SELECT * FROM roles ORDER BY role_id');
    const groupsRes = await client.query('SELECT * FROM assignment_groups ORDER BY assignment_group_id');

    return {
      categories: categoriesRes.rows,
      subcategories: subcategoriesRes.rows,
      priorities: prioritiesRes.rows,
      impacts: impactsRes.rows,
      urgencies: urgenciesRes.rows,
      channels: channelsRes.rows,
      sources: sourcesRes.rows,
      slas: slasRes.rows,
      statuses: statusesRes.rows,
      subStatuses: subStatusesRes.rows,
      users: usersRes.rows,
      configItems: configItemsRes.rows.length > 0 ? configItemsRes.rows : [{ config_item_id: 1 }],
      roles: rolesRes.rows,
      groups: groupsRes.rows
    };
  } finally {
    client.release();
  }
}

function buildSeasonalWeight(date) {
  const weekday = date.getDay();
  let weight = (weekday >= 1 && weekday <= 4) ? 1.0 : (weekday === 5) ? 0.85 : 0.65;
  const month = date.getMonth();
  const day = date.getDate();
  
  if ([2, 5, 8, 11].includes(month) && day >= 20) weight += 0.18;
  if (month === 11 && day >= 18) weight -= 0.15;
  if (month === 6 && day <= 7) weight -= 0.12;
  
  return clamp(weight, 0.25, 1.4);
}

function resolveGenerationEndDate(referenceNow, fullWeeksOnly = true) {
  const endDate = new Date(referenceNow);

  if (fullWeeksOnly) {
    // Exclude the in-progress week to avoid a partial weekly bucket dip.
    const daysSinceLastSaturday = endDate.getDay() + 1;
    endDate.setDate(endDate.getDate() - daysSinceLastSaturday);
    endDate.setHours(20, 59, 0, 0);
  }

  return endDate;
}

function generateTicketDataset(ticketCount = 500, daysBack = 90, seedData, options = {}) {
  const runtimeNow = new Date();
  const fullWeeksOnly = options.fullWeeksOnly !== false;
  const generationEndDate = resolveGenerationEndDate(runtimeNow, fullWeeksOnly);
  const tickets = [];

  const statusIds = {
    New: seedData.statuses.find(s => s.status_name === 'New')?.status_id ?? 1,
    InProgress: seedData.statuses.find(s => s.status_name === 'In Progress')?.status_id ?? 2,
    Pending: seedData.statuses.find(s => s.status_name === 'Pending')?.status_id ?? 4,
    Resolved: seedData.statuses.find(s => s.status_name === 'Resolved')?.status_id ?? 3,
    Closed: seedData.statuses.find(s => s.status_name === 'Closed')?.status_id ?? 5,
  };

  const pendingReasonIds = seedData.subStatuses
    .filter(sub => sub.status_id === statusIds.Pending)
    .map(sub => sub.sub_status_id);

  const agentRoleId = seedData.roles.find(r => /agent/i.test(r.role_name))?.role_id;
  const adminRoleId = seedData.roles.find(r => /admin/i.test(r.role_name))?.role_id;

  const activeAgents = seedData.users
    .filter(u => u.role_id === agentRoleId || u.role_id === 4)
    .map(u => u.user_id);

  let requesterIds = seedData.users
    .filter(u => u.role_id !== agentRoleId)
    .map(u => u.user_id);

  if (requesterIds.length < 8) {
    const fallbackRequesters = seedData.users
      .filter(u => u.role_id !== adminRoleId)
      .map(u => u.user_id);
    requesterIds = Array.from(new Set([...requesterIds, ...fallbackRequesters]));
  }

  if (requesterIds.length === 0) {
    requesterIds.push(...seedData.users.map(u => u.user_id));
  }
  if (requesterIds.length > 0 && requesterIds.length < 8) {
    console.warn(`⚠️ Low requester diversity: only ${requesterIds.length} eligible requesters found in users table.`);
  }

  const chooseCreatedDate = () => {
    const offsets = [];
    for (let offset = 0; offset <= daysBack; offset++) {
      const date = new Date(generationEndDate.getTime() - offset * 24 * 60 * 60 * 1000);
      const recency = 1 - offset / daysBack;
      const trendBias = 0.5 + 0.5 * Math.pow(recency, 1.25);
      const weight = buildSeasonalWeight(date) * clamp(trendBias, 0.45, 1.0);
      offsets.push({ offset, date, weight });
    }

    const chosen = weightedChoice(offsets, offsets.map(item => item.weight));
    const createdDate = new Date(chosen.date);
    const isGenerationEndDay = createdDate.toDateString() === generationEndDate.toDateString();
    const earliestHour = (createdDate.getDay() >= 1 && createdDate.getDay() <= 4) ? 8 : 9;
    const latestHour = isGenerationEndDay
      ? generationEndDate.getHours()
      : (createdDate.getDay() >= 1 && createdDate.getDay() <= 4 ? 17 : 20);
    const hour = randomInt(earliestHour, Math.max(earliestHour, latestHour));
    createdDate.setHours(hour, randomInt(0, 59), 0, 0);

    if (createdDate > generationEndDate) {
      createdDate.setTime(generationEndDate.getTime());
    }

    return {
      createdDate,
      daysAgo: chosen.offset,
      seasonalIntensity: chosen.weight,
    };
  };

  const getAgeBucket = (daysAgo) => {
    if (daysAgo <= 3) return 'recent';
    if (daysAgo <= 14) return 'mid';
    return 'older';
  };

  const isCurrentMonthTicket = (date) => (
    date.getMonth() === generationEndDate.getMonth() && date.getFullYear() === generationEndDate.getFullYear()
  );

  const chooseStatus = (bucket, intensity, createdDate) => {
    const statuses = [
      statusIds.New,
      statusIds.InProgress,
      statusIds.Pending,
      statusIds.Closed,
      statusIds.Resolved,
    ];

    const currentMonth = isCurrentMonthTicket(createdDate);
    let weights;

    if (!currentMonth) {
      if (bucket === 'recent') weights = [0.05, 0.05, 0.05, 0.05, 0.80];
      else if (bucket === 'mid') weights = [0.01, 0.03, 0.03, 0.03, 0.90];
      else weights = [0.01, 0.02, 0.02, 0.02, 0.93];
    } else {
      if (bucket === 'recent') weights = [0.40, 0.30, 0.15, 0.05, 0.10];
      else if (bucket === 'mid') weights = [0.25, 0.25, 0.20, 0.10, 0.20];
      else weights = [0.10, 0.20, 0.20, 0.10, 0.40];
    }

    if (intensity > 1.15) {
      weights = [weights[0] * 0.96, weights[1] * 1.04, weights[2] * 1.04, weights[3] * 1.02, weights[4] * 0.94];
    }
    if (intensity < 0.9) {
      weights = [weights[0] * 0.97, weights[1] * 0.96, weights[2] * 1.02, weights[3] * 1.02, weights[4] * 1.03];
    }

    const normalized = weights.map(w => w / weights.reduce((sum, v) => sum + v, 0));
    return weightedChoice(statuses, normalized);
  };

  const chooseAssignmentGroup = () => weightedChoice(
    assignmentGroupWeights.map(item => item.id),
    assignmentGroupWeights.map(item => item.weight)
  );

  const chooseAgentByGroup = (groupId) => {
    const agentsInGroup = seedData.users
      .filter(u => u.assignment_group_id === groupId && (u.role_id === 3 || u.role_id === 4))
      .map(u => u.user_id);

    return agentsInGroup.length > 0 ? randomChoice(agentsInGroup) : randomChoice(activeAgents);
  };

  const chooseRequester = () => randomChoice(requesterIds);

  const chooseCategoryByGroup = (groupId) => {
    const groupWeights = categoryDistributionByGroup[groupId] || defaultCategoryWeights;
    const availableCategories = seedData.categories.filter((category) => groupWeights[category.category_name] > 0);
    const weights = availableCategories.map((category) => groupWeights[category.category_name] ?? 0);
    if (availableCategories.length === 0) {
      return randomChoice(seedData.categories);
    }
    return weightedChoice(availableCategories, weights);
  };

  const calculateSlaMissed = (statusId, priorityId, resolvedDate, slaDueDate, reopenCount, daysAgo, createdDate) => {
    if (!resolvedDate) {
      const [minBreach, maxBreach] = priorityBreachRates[priorityId] ?? [0.06, 0.10];
      let chance = randomFloat(minBreach, maxBreach);
      if (statusId === statusIds.Closed || statusId === statusIds.Pending) chance += 0.03;
      if (reopenCount > 0) chance += 0.04;
      if (daysAgo > 14) chance += 0.01;
      if (!isCurrentMonthTicket(createdDate)) chance *= 0.35;
      chance = clamp(chance, 0.01, 0.20);
      return runtimeNow > slaDueDate && Math.random() < chance;
    }

    return resolvedDate > slaDueDate;
  };

  const shouldHaveReopen = (statusId, priorityId, daysAgo, createdDate) => {
    if (statusId === statusIds.Resolved || statusId === statusIds.Closed) {
      const currentMonth = isCurrentMonthTicket(createdDate);
      let base = currentMonth ? 0.16 : 0.05;
      if (priorityId === 4) base += 0.02;
      if (daysAgo <= 14) base += currentMonth ? 0.03 : 0.01;
      return Math.random() < clamp(base, 0.03, 0.16);
    }
    return false;
  };

  const buildTicket = (ticketId, created, statusId, requesterOverride = null, isReopen = false) => {
    const assignmentGroupId = chooseAssignmentGroup();
    const category = chooseCategoryByGroup(assignmentGroupId);
    const categorySubcats = seedData.subcategories.filter(sub => sub.category_id === category.category_id);
    let subcategory = categorySubcats.length > 0 ? randomChoice(categorySubcats) : null;
    if (!subcategory && seedData.subcategories.length > 0) {
      subcategory = randomChoice(seedData.subcategories);
    }

    const priority = randomChoice(seedData.priorities);
    const impact = randomChoice(seedData.impacts);
    const urgency = randomChoice(seedData.urgencies);
    const slaId = ticketPriorityToSlaId[priority.priority_id] || 3;
    const slaDefinition = seedData.slas.find(s => s.sla_id === slaId) ?? seedData.slas[seedData.slas.length - 1];
    const slaDueDate = new Date(created.createdDate.getTime() + slaDefinition.sla_hours * 60 * 60 * 1000);

    const assignedTo = chooseAgentByGroup(assignmentGroupId);
    const requester = requesterOverride || chooseRequester();

    const workMinutes = clamp(
      randomInt(30, 90)
      + priority.priority_id * 6
      + impact.impact_id * 4
      + urgency.urgency_id * 4,
      20,
      360
    );

    const reopen_count = isReopen ? 1 : (shouldHaveReopen(statusId, priority.priority_id, created.daysAgo, created.createdDate) ? randomInt(1, 2) : 0);
    const reassignment_count = Math.random() < 0.12 ? randomInt(1, 2) : 0;

    const estimateSlaMinutes = Math.max(15, Math.floor(slaDefinition.sla_hours * 60 * 0.75));
    const historical = !isCurrentMonthTicket(created.createdDate);
    let resolvedDate = null;

    if (statusId === statusIds.Resolved || statusId === statusIds.Closed) {
      const beforeSla = historical ? Math.random() < 0.92 : Math.random() < 0.78;
      if (beforeSla) {
        const beforeMinutes = randomInt(15, Math.max(15, estimateSlaMinutes));
        resolvedDate = new Date(created.createdDate.getTime() + beforeMinutes * 60 * 1000);
      } else {
        const afterMinutes = randomInt(Math.max(estimateSlaMinutes + 15, Math.ceil(slaDefinition.sla_hours * 60 * 1.05)), Math.max(Math.ceil(slaDefinition.sla_hours * 60 * 1.25), estimateSlaMinutes + 60));
        resolvedDate = new Date(created.createdDate.getTime() + afterMinutes * 60 * 1000);
      }
    }

    const lastReopenedAt = reopen_count > 0
      ? new Date(Math.min(
          generationEndDate.getTime(),
          created.createdDate.getTime() + randomInt(1, Math.max(1, Math.min(daysBack - 1, 14))) * 24 * 60 * 60 * 1000
        )).toISOString()
      : null;

    const ticketAgeDays = Math.floor((runtimeNow.getTime() - created.createdDate.getTime()) / (24 * 60 * 60 * 1000));
    const madeSla = !calculateSlaMissed(statusId, priority.priority_id, resolvedDate, slaDueDate, reopen_count, ticketAgeDays, created.createdDate);
    const fcrChance = isCurrentMonthTicket(created.createdDate) ? 0.70 : 0.92;
    const fcr = (statusId === statusIds.Resolved || statusId === statusIds.Closed) && reopen_count === 0 && Math.random() < fcrChance;
    const subStatusId = statusId === statusIds.Pending && pendingReasonIds.length > 0
      ? randomChoice(pendingReasonIds)
      : null;

    const descriptions = descriptionTemplates[category.category_id] || ['Issue reported'];
    const shortDescription = `[${priority.priority_level}] ${randomChoice(descriptions)}`;
    const workNotes = statusId === statusIds.Pending
      ? 'Ticket is waiting for additional info from the requester or external dependency.'
      : statusId === statusIds.InProgress
        ? 'Agent analysis in progress; next update pending.'
        : statusId === statusIds.New
          ? 'New ticket created and awaiting triage.'
          : statusId === statusIds.Resolved
            ? 'Issue resolved and awaiting final confirmation.'
            : 'Ticket closed after resolution and verification.';

    return {
      ticket_id: ticketId,
      created_date: created.createdDate.toISOString(),
      resolved_date: resolvedDate ? resolvedDate.toISOString() : null,
      duration: resolvedDate ? Math.round((resolvedDate.getTime() - created.createdDate.getTime()) / 60000) : null,
      last_reopened_at: lastReopenedAt,
      reopen_count,
      reassignment_count,
      short_description: shortDescription,
      work_notes: workNotes,
      made_sla: madeSla,
      fcr,
      requester_id: requester,
      assigned_to_id: assignedTo,
      closed_by_id: statusId === statusIds.Closed ? assignedTo : null,
      resolved_by_id: (statusId === statusIds.Resolved || statusId === statusIds.Closed) ? assignedTo : null,
      assignment_group_id: assignmentGroupId,
      category_id: category.category_id,
      subcategory_id: subcategory?.subcategory_id || seedData.subcategories[0]?.subcategory_id || null,
      priority_id: priority.priority_id,
      impact_id: impact.impact_id,
      urgency_id: urgency.urgency_id,
      status_id: statusId,
      channel_id: randomChoice(seedData.channels).channel_id,
      source_id: randomChoice(seedData.sources).source_id,
      config_item_id: randomChoice(seedData.configItems).config_item_id,
      sla_id: slaId,
      sla_duedate: slaDueDate.toISOString(),
      sub_status_id: subStatusId,
    };
  };

  const parentTicketCount = Math.max(1, Math.floor(ticketCount / 1.08));
  const reopenTicketCount = ticketCount - parentTicketCount;
  const parentTickets = [];

  for (let i = 0; i < parentTicketCount; i++) {
    const created = chooseCreatedDate();
    const statusId = chooseStatus(getAgeBucket(created.daysAgo), created.seasonalIntensity, created.createdDate);
    const baseId = 100000 + i;
    const ticketId = `TKT-${String(baseId).slice(-6)}`;
    const requester = chooseRequester();

    parentTickets.push({
      ticketId,
      requesterId: requester,
      created,
      nextSuffix: 1
    });

    tickets.push(buildTicket(ticketId, created, statusId, requester, false));
  }

  for (let i = 0; i < reopenTicketCount; i++) {
    const parent = randomChoice(parentTickets);
    const suffix = String(parent.nextSuffix).padStart(2, '0');
    const ticketId = `${parent.ticketId}-${suffix}`;
    parent.nextSuffix += 1;

    const reopenedCreatedDate = new Date(parent.created.createdDate.getTime() + randomInt(1, Math.min(14, daysBack)) * 24 * 60 * 60 * 1000);
    if (reopenedCreatedDate > generationEndDate) {
      reopenedCreatedDate.setTime(generationEndDate.getTime());
    }
    const reopenedDaysAgo = Math.floor((generationEndDate.getTime() - reopenedCreatedDate.getTime()) / (24 * 60 * 60 * 1000));
    const reopenedCreated = { createdDate: reopenedCreatedDate, daysAgo: reopenedDaysAgo, seasonalIntensity: parent.created.seasonalIntensity };
    const statusId = chooseStatus(getAgeBucket(reopenedDaysAgo), parent.created.seasonalIntensity, reopenedCreated.createdDate);

    tickets.push(buildTicket(
      ticketId,
      reopenedCreated,
      statusId,
      parent.requesterId,
      true
    ));
  }

  return tickets.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
}

async function resetTicketsTable() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Resetting tickets table...');
    
    // Delete related data first due to foreign key constraints
    await client.query('DELETE FROM survey');
    await client.query('DELETE FROM ticket_forecast');
    await client.query('DELETE FROM tickets');
    
    const result = await client.query('SELECT COUNT(*) FROM tickets');
    console.log(`✅ Tickets table reset. Remaining tickets: ${result.rows[0].count}`);
  } finally {
    client.release();
  }
}

async function insertTickets(tickets) {
  const client = await pool.connect();
  try {
    console.log(`📥 Inserting ${tickets.length} tickets...`);
    
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      batch.forEach((ticket, idx) => {
        const params = [
          ticket.ticket_id,
          ticket.created_date,
          ticket.resolved_date,
          ticket.last_reopened_at,
          ticket.duration,
          ticket.requester_id,
          ticket.assigned_to_id,
          ticket.closed_by_id,
          ticket.resolved_by_id,
          ticket.reopen_count,
          ticket.reassignment_count,
          ticket.short_description,
          ticket.work_notes,
          ticket.made_sla,
          ticket.fcr,
          ticket.assignment_group_id,
          ticket.category_id,
          ticket.subcategory_id,
          ticket.priority_id,
          ticket.impact_id,
          ticket.urgency_id,
          ticket.status_id,
          ticket.sub_status_id,
          ticket.channel_id,
          ticket.source_id,
          ticket.config_item_id,
          ticket.sla_id,
          ticket.sla_duedate
        ];
        values.push(...params);
        
        const placeholderGroup = Array.from({length: params.length}, (_, j) => `$${paramIndex + j}`).join(',');
        placeholders.push(`(${placeholderGroup})`);
        paramIndex += params.length;
      });

      const query = `
        INSERT INTO tickets (
          ticket_id, created_date, resolved_date, last_reopened_at, duration,
          requester_id, assigned_to_id, closed_by_id, resolved_by_id,
          reopen_count, reassignment_count, short_description, work_notes,
          made_sla, fcr, assignment_group_id, category_id, subcategory_id,
          priority_id, impact_id, urgency_id, status_id, sub_status_id,
          channel_id, source_id, config_item_id, sla_id, sla_duedate
        ) VALUES ${placeholders.join(',')}
      `;

      await client.query(query, values);
      inserted += batch.length;
      process.stdout.write(`\r  Progress: ${inserted}/${tickets.length} tickets inserted`);
    }
    
    console.log(`\n✅ Successfully inserted ${tickets.length} tickets`);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Synthetic Ticket Seeder\n');
    
    // Parse arguments
    const ticketCount = parseInt(process.argv[2]) || 500;
    const daysBack = parseInt(process.argv[3]) || 90;
    const fullWeeksOnlyArg = String(process.argv[4] || 'true').toLowerCase();
    const fullWeeksOnly = !['false', '0', 'no', 'partial'].includes(fullWeeksOnlyArg);
    const generationEndDate = resolveGenerationEndDate(new Date(), fullWeeksOnly);

    console.log(`📊 Configuration:`);
    console.log(`   Tickets to generate: ${ticketCount}`);
    console.log(`   Days back from today: ${daysBack}`);
    console.log(`   Full completed weeks only: ${fullWeeksOnly ? 'yes' : 'no'}`);
    console.log(`   Generation end date: ${generationEndDate.toISOString()}`);
    console.log(`   Months of data: ~${Math.round(daysBack / 30)}\n`);

    // Fetch seed data
    const seedData = await fetchSeedData();

    console.log(`✅ Seed data loaded`);
    console.log(`   Categories: ${seedData.categories.length}`);
    console.log(`   Users: ${seedData.users.length}`);
    console.log(`   Statuses: ${seedData.statuses.length}\n`);

    // Reset table
    await resetTicketsTable();

    // Generate tickets
    console.log(`🔄 Generating ${ticketCount} synthetic tickets for ${daysBack} days...`);
    const tickets = generateTicketDataset(ticketCount, daysBack, seedData, { fullWeeksOnly });
    console.log(`✅ Generated ${tickets.length} tickets\n`);

    // Insert tickets
    await insertTickets(tickets);

    // Verify
    console.log('\n📈 Verifying import...');
    const client = await pool.connect();
    try {
      const count = await client.query('SELECT COUNT(*) as count FROM tickets');
      const dateRange = await client.query(`
        SELECT 
          MIN(created_date) as earliest,
          MAX(created_date) as latest,
          COUNT(DISTINCT DATE(created_date)) as unique_days
        FROM tickets
      `);
      
      console.log(`✅ Verification complete:`);
      console.log(`   Total imported: ${count.rows[0].count}`);
      console.log(`   Date range: ${new Date(dateRange.rows[0].earliest).toLocaleDateString()} to ${new Date(dateRange.rows[0].latest).toLocaleDateString()}`);
      console.log(`   Unique days: ${dateRange.rows[0].unique_days}`);
    } finally {
      client.release();
    }

    console.log('\n✨ Seeding complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
main();
