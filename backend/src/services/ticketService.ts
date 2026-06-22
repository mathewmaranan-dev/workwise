import { query } from '../config/database.js';

const CLOSED_STATUS_IDS = [5];

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
}

async function resolveStatusId(statusId: unknown, statusName: unknown) {
  if (typeof statusId === 'number' && Number.isFinite(statusId)) {
    return statusId;
  }

  if (typeof statusName === 'string' && statusName.trim()) {
    const result = await query(
      'SELECT status_id FROM status WHERE lower(status_name) = lower($1) LIMIT 1',
      [statusName.trim()]
    );
    if (result.rows.length > 0) {
      return result.rows[0].status_id;
    }
  }

  return undefined;
}

interface TicketFilterOptions {
  ticket_id?: string;
  assigned_to_id?: string;
  assignment_group_id?: string;
  category_id?: string;
  status_id?: string;
  status?: string;
  priority_id?: string;
  priority?: string;
  created_from?: string;
  created_to?: string;
  limit?: string;
  offset?: string;
}

async function buildTicketQuery(filters: TicketFilterOptions, selectClause: string, includeOrder = true) {
  let queryStr = `${selectClause} FROM tickets WHERE 1=1`;
  const params: any[] = [];

  if (typeof filters.ticket_id === 'string' && filters.ticket_id.trim()) {
    queryStr += ` AND ticket_id = $${params.length + 1}`;
    params.push(filters.ticket_id.trim());
  }

  const assignedToId = normalizeOptionalNumber(filters.assigned_to_id);
  if (assignedToId !== undefined) {
    queryStr += ` AND assigned_to_id = $${params.length + 1}`;
    params.push(assignedToId);
  }

  const groupId = normalizeOptionalNumber(filters.assignment_group_id);
  if (groupId !== undefined) {
    queryStr += ` AND assignment_group_id = $${params.length + 1}`;
    params.push(groupId);
  }

  const categoryId = normalizeOptionalNumber(filters.category_id);
  if (categoryId !== undefined) {
    queryStr += ` AND category_id = $${params.length + 1}`;
    params.push(categoryId);
  }

  const priorityId = normalizeOptionalNumber(filters.priority_id ?? filters.priority);
  if (priorityId !== undefined) {
    queryStr += ` AND priority_id = $${params.length + 1}`;
    params.push(priorityId);
  }

  let resolvedStatusId = normalizeOptionalNumber(filters.status_id ?? filters.status);
  if (resolvedStatusId === undefined && typeof filters.status === 'string' && filters.status.trim()) {
    resolvedStatusId = await resolveStatusId(undefined, filters.status.trim());
  }

  if (resolvedStatusId !== undefined) {
    queryStr += ` AND status_id = $${params.length + 1}`;
    params.push(resolvedStatusId);
  }

  if (typeof filters.created_from === 'string' && filters.created_from.trim()) {
    const fromDate = new Date(filters.created_from);
    if (!Number.isNaN(fromDate.getTime())) {
      queryStr += ` AND created_date >= $${params.length + 1}`;
      params.push(fromDate.toISOString());
    }
  }

  if (typeof filters.created_to === 'string' && filters.created_to.trim()) {
    const toDate = new Date(filters.created_to);
    if (!Number.isNaN(toDate.getTime())) {
      queryStr += ` AND created_date <= $${params.length + 1}`;
      params.push(toDate.toISOString());
    }
  }

  if (includeOrder) {
    queryStr += ' ORDER BY created_date DESC';
  }

  return { queryStr, params };
}

export async function getAllTicketsAnalyticsWithSummary(filters: TicketFilterOptions) {
  const selectClause = 'SELECT ticket_id, created_date, resolved_date, status_id, priority_id, assignment_group_id, category_id, assigned_to_id, reopen_count, fcr, made_sla, duration, short_description';
  const { queryStr, params } = await buildTicketQuery(filters, selectClause, false);

  const rawLimit = typeof filters.limit !== 'undefined' ? Number(filters.limit) : NaN;
  const rawOffset = typeof filters.offset !== 'undefined' ? Number(filters.offset) : NaN;
  const maxLimit = 20000;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : maxLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const pagedQuery = `${queryStr} ORDER BY created_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, limit, offset];

  const summaryQuery = queryStr.replace(
    /^SELECT[\s\S]*?FROM tickets/i,
    `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN made_sla = true THEN 1 ELSE 0 END) as sla_met,
         SUM(CASE WHEN fcr = true THEN 1 ELSE 0 END) as fcr_count,
         SUM(CASE WHEN status_id IN (3,4) THEN 1 ELSE 0 END) as resolved_count
       FROM tickets`
  );

  const [ticketsResult, summaryResult] = await Promise.all([
    query(pagedQuery, pagedParams),
    query(summaryQuery, params),
  ]);

  return {
    tickets: ticketsResult.rows,
    summary: summaryResult.rows[0],
  };
}

export async function getAllTickets(filters: TicketFilterOptions) {
  const selectClause = 'SELECT ticket_id, created_date, status_id, priority_id, assignment_group_id, category_id, assigned_to_id, short_description';
  const { queryStr, params } = await buildTicketQuery(filters, selectClause);

  const rawLimit = typeof filters.limit !== 'undefined' ? Number(filters.limit) : NaN;
  const rawOffset = typeof filters.offset !== 'undefined' ? Number(filters.offset) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 100;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const pagedQuery = `${queryStr} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(pagedQuery, params);
  return result.rows;
}

export async function getAllTicketsAnalytics(filters: TicketFilterOptions) {
  const selectClause = 'SELECT ticket_id, created_date, resolved_date, status_id, priority_id, assignment_group_id, category_id, assigned_to_id, reopen_count, fcr, made_sla, duration, short_description';
  const { queryStr, params } = await buildTicketQuery(filters, selectClause);

  const rawLimit = typeof filters.limit !== 'undefined' ? Number(filters.limit) : NaN;
  const rawOffset = typeof filters.offset !== 'undefined' ? Number(filters.offset) : NaN;
  const maxLimit = 20000;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : maxLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const pagedQuery = `${queryStr} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(pagedQuery, params);
  return result.rows;
}

export async function getAllTicketsDetailed(filters: TicketFilterOptions) {
  const selectClause = 'SELECT *';
  const { queryStr, params } = await buildTicketQuery(filters, selectClause);

  const rawLimit = typeof filters.limit !== 'undefined' ? Number(filters.limit) : NaN;
  const rawOffset = typeof filters.offset !== 'undefined' ? Number(filters.offset) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 100;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const pagedQuery = `${queryStr} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(pagedQuery, params);
  return result.rows;
}

export async function getTicketById(id: string) {
  const result = await query('SELECT * FROM tickets WHERE ticket_id = $1', [id]);
  return result.rows[0];
}

export async function createTicket(payload: {
  assigned_to: unknown;
  assignment_group_id: unknown;
  priority_id: unknown;
}) {
  const result = await query(
    `INSERT INTO tickets (ticket_id, created_date, assigned_to_id, assignment_group_id, priority_id, status_id, requester_id, created_at)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      `NEW-${Date.now()}`,
      payload.assigned_to,
      payload.assignment_group_id,
      payload.priority_id,
      1,
      1,
    ]
  );
  return result.rows[0];
}

export async function importTickets(tickets: unknown[]) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('No tickets provided for import');
  }

  const rows = [];
  const placeholders: string[] = [];
  const columnCount = 28;
  let rowIndex = 0;

  for (const ticket of tickets) {
    const record = ticket ?? {};
    const ticketId = String((record as any).ticket_id || '').trim();
    if (!ticketId) {
      continue;
    }

    const statusId = await resolveStatusId((record as any).status_id, (record as any).status_name || (record as any).status);
    const createdDate = (record as any).created_date ? new Date((record as any).created_date).toISOString() : new Date().toISOString();
    const resolvedDate = (record as any).resolved_date ? new Date((record as any).resolved_date).toISOString() : null;
    const lastReopenedAt = (record as any).last_reopened_at ? new Date((record as any).last_reopened_at).toISOString() : null;
    const duration = normalizeOptionalNumber((record as any).duration);
    const reopenCount = normalizeOptionalNumber((record as any).reopen_count);
    const reassignmentCount = normalizeOptionalNumber((record as any).reassignment_count);
    const shortDescription = (record as any).short_description ? String((record as any).short_description) : null;
    const workNotes = (record as any).work_notes ? String((record as any).work_notes) : null;
    const madeSla = normalizeOptionalBoolean((record as any).made_sla);
    const fcr = normalizeOptionalBoolean((record as any).fcr);
    const requesterId = normalizeOptionalNumber((record as any).requester_id) ?? 1;
    const assignedToId = normalizeOptionalNumber((record as any).assigned_to_id);
    const closedById = normalizeOptionalNumber((record as any).closed_by_id);
    const resolvedById = normalizeOptionalNumber((record as any).resolved_by_id);
    const assignmentGroupId = normalizeOptionalNumber((record as any).assignment_group_id);
    const priorityId = normalizeOptionalNumber((record as any).priority_id) ?? 3;
    const impactId = normalizeOptionalNumber((record as any).impact_id) ?? 3;
    const urgencyId = normalizeOptionalNumber((record as any).urgency_id) ?? 2;
    const statusIdValue = statusId ?? 6;
    const subStatusId = normalizeOptionalNumber((record as any).sub_status_id);
    const categoryId = normalizeOptionalNumber((record as any).category_id) ?? 1;
    const subcategoryId = normalizeOptionalNumber((record as any).subcategory_id) ?? 1;
    const channelId = normalizeOptionalNumber((record as any).channel_id) ?? 1;
    const sourceId = normalizeOptionalNumber((record as any).source_id) ?? 1;
    const configItemId = normalizeOptionalNumber((record as any).config_item_id);
    const slaId = normalizeOptionalNumber((record as any).sla_id) ?? 3;
    const slaDueDate = (record as any).sla_duedate ? new Date((record as any).sla_duedate).toISOString() : null;

    const baseIndex = rowIndex * columnCount;
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28})`);
    rows.push(
      ticketId,
      createdDate,
      resolvedDate,
      lastReopenedAt,
      duration,
      reopenCount,
      reassignmentCount,
      shortDescription,
      workNotes,
      madeSla,
      fcr,
      requesterId,
      assignedToId,
      closedById,
      resolvedById,
      assignmentGroupId,
      priorityId,
      impactId,
      urgencyId,
      statusIdValue,
      subStatusId,
      categoryId,
      subcategoryId,
      channelId,
      sourceId,
      configItemId,
      slaId,
      slaDueDate
    );
    rowIndex += 1;
  }

  if (rows.length === 0) {
    throw new Error('No valid tickets were found in the import payload');
  }

  const sql = `INSERT INTO tickets (
      ticket_id,
      created_date,
      resolved_date,
      last_reopened_at,
      duration,
      reopen_count,
      reassignment_count,
      short_description,
      work_notes,
      made_sla,
      fcr,
      requester_id,
      assigned_to_id,
      closed_by_id,
      resolved_by_id,
      assignment_group_id,
      priority_id,
      impact_id,
      urgency_id,
      status_id,
      sub_status_id,
      category_id,
      subcategory_id,
      channel_id,
      source_id,
      config_item_id,
      sla_id,
      sla_duedate
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (ticket_id) DO UPDATE SET
      resolved_date = COALESCE(EXCLUDED.resolved_date, tickets.resolved_date),
      duration = COALESCE(EXCLUDED.duration, tickets.duration),
      reopen_count = CASE
        WHEN tickets.status_id IN (${CLOSED_STATUS_IDS.join(', ')})
          AND EXCLUDED.status_id NOT IN (${CLOSED_STATUS_IDS.join(', ')})
          THEN GREATEST(COALESCE(EXCLUDED.reopen_count, tickets.reopen_count), COALESCE(tickets.reopen_count, 0) + 1)
        ELSE COALESCE(EXCLUDED.reopen_count, tickets.reopen_count)
      END,
      reassignment_count = COALESCE(EXCLUDED.reassignment_count, tickets.reassignment_count),
      short_description = COALESCE(EXCLUDED.short_description, tickets.short_description),
      work_notes = COALESCE(EXCLUDED.work_notes, tickets.work_notes),
      made_sla = COALESCE(EXCLUDED.made_sla, tickets.made_sla),
      fcr = COALESCE(EXCLUDED.fcr, tickets.fcr),
      requester_id = COALESCE(EXCLUDED.requester_id, tickets.requester_id),
      assigned_to_id = COALESCE(EXCLUDED.assigned_to_id, tickets.assigned_to_id),
      closed_by_id = COALESCE(EXCLUDED.closed_by_id, tickets.closed_by_id),
      resolved_by_id = COALESCE(EXCLUDED.resolved_by_id, tickets.resolved_by_id),
      assignment_group_id = COALESCE(EXCLUDED.assignment_group_id, tickets.assignment_group_id),
      priority_id = COALESCE(EXCLUDED.priority_id, tickets.priority_id),
      impact_id = COALESCE(EXCLUDED.impact_id, tickets.impact_id),
      urgency_id = COALESCE(EXCLUDED.urgency_id, tickets.urgency_id),
      status_id = COALESCE(EXCLUDED.status_id, tickets.status_id),
      sub_status_id = COALESCE(EXCLUDED.sub_status_id, tickets.sub_status_id),
      category_id = COALESCE(EXCLUDED.category_id, tickets.category_id),
      subcategory_id = COALESCE(EXCLUDED.subcategory_id, tickets.subcategory_id),
      channel_id = COALESCE(EXCLUDED.channel_id, tickets.channel_id),
      source_id = COALESCE(EXCLUDED.source_id, tickets.source_id),
      config_item_id = COALESCE(EXCLUDED.config_item_id, tickets.config_item_id),
      sla_id = COALESCE(EXCLUDED.sla_id, tickets.sla_id),
      sla_duedate = COALESCE(EXCLUDED.sla_duedate, tickets.sla_duedate),
      last_reopened_at = CASE
        WHEN tickets.status_id IN (${CLOSED_STATUS_IDS.join(', ')})
          AND EXCLUDED.status_id NOT IN (${CLOSED_STATUS_IDS.join(', ')})
          THEN NOW()
        ELSE COALESCE(EXCLUDED.last_reopened_at, tickets.last_reopened_at)
      END,
      updated_at = NOW()
    RETURNING *`;

  const result = await query(sql, rows);
  return result.rows;
}

export async function updateTicket(id: string, payload: { status_id?: unknown; assigned_to_id?: unknown; notes?: string }) {
  const existing = await query('SELECT status_id, reopen_count FROM tickets WHERE ticket_id = $1', [id]);
  if (existing.rows.length === 0) {
    return null;
  }

  const previousStatusId = existing.rows[0].status_id;
  const previousReopenCount = existing.rows[0].reopen_count ?? 0;
  const newStatusId = normalizeOptionalNumber(payload.status_id) ?? previousStatusId;
  const shouldIncrementReopen = CLOSED_STATUS_IDS.includes(previousStatusId) && !CLOSED_STATUS_IDS.includes(newStatusId);
  const reopenCount = shouldIncrementReopen ? previousReopenCount + 1 : previousReopenCount;
  const lastReopenedAt = shouldIncrementReopen ? 'NOW()' : 'last_reopened_at';

  const result = await query(
    `UPDATE tickets SET status_id = $1, assigned_to_id = $2, work_notes = $3, reopen_count = $4, last_reopened_at = ${lastReopenedAt}, updated_at = NOW()
     WHERE ticket_id = $5
     RETURNING *`,
    [newStatusId, normalizeOptionalNumber(payload.assigned_to_id), payload.notes, reopenCount, id]
  );

  return result.rows[0];
}
