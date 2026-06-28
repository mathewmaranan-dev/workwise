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

type LookupSpec = {
  field: keyof NormalizedImportTicket;
  table: string;
  column: string;
  required: boolean;
};

type NormalizedImportTicket = {
  ticket_id: string;
  created_date: string;
  resolved_date: string | null;
  last_reopened_at: string | null;
  duration: number | undefined;
  reopen_count: number | undefined;
  reassignment_count: number | undefined;
  short_description: string | null;
  work_notes: string | null;
  made_sla: boolean | undefined;
  fcr: boolean | undefined;
  requester_id: number | undefined;
  assigned_to_id: number | undefined;
  closed_by_id: number | undefined;
  resolved_by_id: number | undefined;
  assignment_group_id: number | undefined;
  priority_id: number | undefined;
  impact_id: number | undefined;
  urgency_id: number | undefined;
  status_id: number | undefined;
  sub_status_id: number | undefined;
  category_id: number | undefined;
  subcategory_id: number | undefined;
  channel_id: number | undefined;
  source_id: number | undefined;
  config_item_id: number | undefined;
  sla_id: number | undefined;
  sla_duedate: string | null;
};

const LOOKUP_SPECS: LookupSpec[] = [
  { field: 'requester_id', table: 'users', column: 'user_id', required: true },
  { field: 'assigned_to_id', table: 'users', column: 'user_id', required: false },
  { field: 'closed_by_id', table: 'users', column: 'user_id', required: false },
  { field: 'resolved_by_id', table: 'users', column: 'user_id', required: false },
  { field: 'assignment_group_id', table: 'assignment_groups', column: 'assignment_group_id', required: false },
  { field: 'priority_id', table: 'priority', column: 'priority_id', required: true },
  { field: 'impact_id', table: 'impact', column: 'impact_id', required: true },
  { field: 'urgency_id', table: 'urgency', column: 'urgency_id', required: true },
  { field: 'status_id', table: 'status', column: 'status_id', required: true },
  { field: 'sub_status_id', table: 'sub_status', column: 'sub_status_id', required: false },
  { field: 'category_id', table: 'category', column: 'category_id', required: true },
  { field: 'subcategory_id', table: 'subcategory', column: 'subcategory_id', required: true },
  { field: 'channel_id', table: 'channel', column: 'channel_id', required: true },
  { field: 'source_id', table: 'source', column: 'source_id', required: true },
  { field: 'config_item_id', table: 'configuration_items', column: 'config_item_id', required: false },
  { field: 'sla_id', table: 'sla', column: 'sla_id', required: true },
];

async function getStatusNameMap() {
  const result = await query('SELECT status_id, status_name FROM status');
  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(String(row.status_name).trim().toLowerCase(), Number(row.status_id));
  }
  return map;
}

async function getExistingIdSet(table: string, column: string, ids: number[]) {
  if (ids.length === 0) {
    return new Set<number>();
  }
  const result = await query(`SELECT ${column} FROM ${table} WHERE ${column} = ANY($1::int[])`, [ids]);
  return new Set<number>(result.rows.map((row: any) => Number(row[column])));
}

async function getExistingTicketIdSet(ticketIds: string[]) {
  if (ticketIds.length === 0) {
    return new Set<string>();
  }
  const result = await query('SELECT ticket_id FROM tickets WHERE ticket_id = ANY($1::text[])', [ticketIds]);
  return new Set<string>(result.rows.map((row: any) => String(row.ticket_id)));
}

async function validateAndSanitizeLookupReferences(records: NormalizedImportTicket[], existingTicketIds: Set<string>) {
  const idsBySpec = new Map<LookupSpec, Set<number>>();

  for (const spec of LOOKUP_SPECS) {
    idsBySpec.set(spec, new Set<number>());
  }

  for (const record of records) {
    for (const spec of LOOKUP_SPECS) {
      const rawValue = record[spec.field];
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        idsBySpec.get(spec)?.add(rawValue);
      }
    }
  }

  const existingBySpec = new Map<LookupSpec, Set<number>>();
  for (const spec of LOOKUP_SPECS) {
    const ids = Array.from(idsBySpec.get(spec) || []);
    const existing = await getExistingIdSet(spec.table, spec.column, ids);
    existingBySpec.set(spec, existing);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const record of records) {
    const isExistingTicket = existingTicketIds.has(record.ticket_id);
    for (const spec of LOOKUP_SPECS) {
      const value = record[spec.field];
      const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : undefined;

      if (numericValue === undefined) {
        if (spec.required && !isExistingTicket) {
          errors.push(`${record.ticket_id}: missing ${String(spec.field)}`);
        }
        continue;
      }

      const existing = existingBySpec.get(spec);
      if (!existing?.has(numericValue)) {
        if (isExistingTicket && spec.field !== 'status_id') {
          (record as any)[spec.field] = undefined;
          warnings.push(`${record.ticket_id}: ignored unknown ${String(spec.field)}=${numericValue}`);
          continue;
        }
        errors.push(`${record.ticket_id}: unknown ${String(spec.field)}=${numericValue}`);
      }
    }
  }

  if (errors.length > 0) {
    const preview = errors.slice(0, 25).join(' | ');
    throw new Error(`Import validation failed with ${errors.length} invalid reference(s). ${preview}`);
  }

  return warnings;
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

  const incomingTicketIds = tickets
    .map((ticket) => String((ticket as any)?.ticket_id || '').trim())
    .filter((ticketId) => ticketId.length > 0);
  const existingTicketIds = await getExistingTicketIdSet(incomingTicketIds);

  const normalizedRecords: NormalizedImportTicket[] = [];
  const columnCount = 28;
  const statusNameMap = await getStatusNameMap();

  for (const ticket of tickets) {
    const record = ticket ?? {};
    const ticketId = String((record as any).ticket_id || '').trim();
    if (!ticketId) {
      continue;
    }
    const isExistingTicket = existingTicketIds.has(ticketId);

    const explicitStatusId = normalizeOptionalNumber((record as any).status_id);
    const statusName = typeof (record as any).status_name === 'string'
      ? (record as any).status_name
      : typeof (record as any).status === 'string'
      ? (record as any).status
      : undefined;
    const statusIdFromName = statusName ? statusNameMap.get(statusName.trim().toLowerCase()) : undefined;
    const statusId = explicitStatusId ?? statusIdFromName;
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
    const requesterId = normalizeOptionalNumber((record as any).requester_id) ?? (isExistingTicket ? undefined : 1);
    const assignedToId = normalizeOptionalNumber((record as any).assigned_to_id);
    const closedById = normalizeOptionalNumber((record as any).closed_by_id);
    const resolvedById = normalizeOptionalNumber((record as any).resolved_by_id);
    const assignmentGroupId = normalizeOptionalNumber((record as any).assignment_group_id);
    const priorityId = normalizeOptionalNumber((record as any).priority_id) ?? (isExistingTicket ? undefined : 3);
    const impactId = normalizeOptionalNumber((record as any).impact_id) ?? (isExistingTicket ? undefined : 3);
    const urgencyId = normalizeOptionalNumber((record as any).urgency_id) ?? (isExistingTicket ? undefined : 2);
    const statusIdValue = statusId ?? (isExistingTicket ? undefined : 1);
    const subStatusId = normalizeOptionalNumber((record as any).sub_status_id);
    const categoryId = normalizeOptionalNumber((record as any).category_id) ?? (isExistingTicket ? undefined : 1);
    const subcategoryId = normalizeOptionalNumber((record as any).subcategory_id) ?? (isExistingTicket ? undefined : 1);
    const channelId = normalizeOptionalNumber((record as any).channel_id) ?? (isExistingTicket ? undefined : 1);
    const sourceId = normalizeOptionalNumber((record as any).source_id) ?? (isExistingTicket ? undefined : 1);
    const configItemId = normalizeOptionalNumber((record as any).config_item_id);
    const slaId = normalizeOptionalNumber((record as any).sla_id) ?? (isExistingTicket ? undefined : 3);
    const slaDueDate = (record as any).sla_duedate ? new Date((record as any).sla_duedate).toISOString() : null;

    normalizedRecords.push({
      ticket_id: ticketId,
      created_date: createdDate,
      resolved_date: resolvedDate,
      last_reopened_at: lastReopenedAt,
      duration,
      reopen_count: reopenCount,
      reassignment_count: reassignmentCount,
      short_description: shortDescription,
      work_notes: workNotes,
      made_sla: madeSla,
      fcr,
      requester_id: requesterId,
      assigned_to_id: assignedToId,
      closed_by_id: closedById,
      resolved_by_id: resolvedById,
      assignment_group_id: assignmentGroupId,
      priority_id: priorityId,
      impact_id: impactId,
      urgency_id: urgencyId,
      status_id: statusIdValue,
      sub_status_id: subStatusId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      channel_id: channelId,
      source_id: sourceId,
      config_item_id: configItemId,
      sla_id: slaId,
      sla_duedate: slaDueDate,
    });

  }

  if (normalizedRecords.length === 0) {
    throw new Error('No valid tickets were found in the import payload');
  }

  const validationWarnings = await validateAndSanitizeLookupReferences(normalizedRecords, existingTicketIds);
  if (validationWarnings.length > 0) {
    console.warn(`Import warnings: ${validationWarnings.length} non-fatal lookup reference(s) ignored for existing tickets.`, validationWarnings.slice(0, 10));
  }

  const buildRowValues = (record: NormalizedImportTicket) => [
    record.ticket_id,
    record.created_date,
    record.resolved_date,
    record.last_reopened_at,
    record.duration,
    record.reopen_count,
    record.reassignment_count,
    record.short_description,
    record.work_notes,
    record.made_sla,
    record.fcr,
    record.requester_id,
    record.assigned_to_id,
    record.closed_by_id,
    record.resolved_by_id,
    record.assignment_group_id,
    record.priority_id,
    record.impact_id,
    record.urgency_id,
    record.status_id,
    record.sub_status_id,
    record.category_id,
    record.subcategory_id,
    record.channel_id,
    record.source_id,
    record.config_item_id,
    record.sla_id,
    record.sla_duedate,
  ];

  const PG_MAX_BIND_PARAMS = 32767;
  const maxRowsPerBatch = Math.max(1, Math.floor(PG_MAX_BIND_PARAMS / columnCount));
  const importedRows: any[] = [];

  for (let start = 0; start < normalizedRecords.length; start += maxRowsPerBatch) {
    const batch = normalizedRecords.slice(start, start + maxRowsPerBatch);
    const rows: any[] = [];
    const placeholders: string[] = [];

    for (let rowIndex = 0; rowIndex < batch.length; rowIndex += 1) {
      const baseIndex = rowIndex * columnCount;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28})`);
      rows.push(...buildRowValues(batch[rowIndex]));
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
    importedRows.push(...result.rows);
  }

  return importedRows;
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
