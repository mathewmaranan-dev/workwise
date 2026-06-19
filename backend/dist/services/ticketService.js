import { query } from '../config/database.js';
const CLOSED_STATUS_IDS = [5];
function normalizeOptionalNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
function normalizeOptionalBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(normalized))
            return true;
        if (['false', '0', 'no'].includes(normalized))
            return false;
    }
    return undefined;
}
async function resolveStatusId(statusId, statusName) {
    if (typeof statusId === 'number' && Number.isFinite(statusId)) {
        return statusId;
    }
    if (typeof statusName === 'string' && statusName.trim()) {
        const result = await query('SELECT status_id FROM status WHERE lower(status_name) = lower($1) LIMIT 1', [statusName.trim()]);
        if (result.rows.length > 0) {
            return result.rows[0].status_id;
        }
    }
    return undefined;
}
export async function getAllTickets(filters) {
    let queryStr = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];
    if (filters.status) {
        queryStr += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
    }
    if (filters.assigned_to) {
        queryStr += ` AND assigned_to_id = $${params.length + 1}`;
        params.push(filters.assigned_to);
    }
    if (filters.priority) {
        queryStr += ` AND priority_id = $${params.length + 1}`;
        params.push(filters.priority);
    }
    queryStr += ' ORDER BY created_at DESC';
    const result = await query(queryStr, params);
    return result.rows;
}
export async function getTicketById(id) {
    const result = await query('SELECT * FROM tickets WHERE ticket_id = $1', [id]);
    return result.rows[0];
}
export async function createTicket(payload) {
    const result = await query(`INSERT INTO tickets (ticket_id, created_date, assigned_to_id, assignment_group_id, priority_id, status_id, requester_id, created_at)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6, NOW())
     RETURNING *`, [
        `NEW-${Date.now()}`,
        payload.assigned_to,
        payload.assignment_group_id,
        payload.priority_id,
        1,
        1,
    ]);
    return result.rows[0];
}
export async function importTickets(tickets) {
    if (!Array.isArray(tickets) || tickets.length === 0) {
        throw new Error('No tickets provided for import');
    }
    const rows = [];
    const placeholders = [];
    const columnCount = 28;
    let rowIndex = 0;
    for (const ticket of tickets) {
        const record = ticket ?? {};
        const ticketId = String(record.ticket_id || '').trim();
        if (!ticketId) {
            continue;
        }
        const statusId = await resolveStatusId(record.status_id, record.status_name || record.status);
        const createdDate = record.created_date ? new Date(record.created_date).toISOString() : new Date().toISOString();
        const resolvedDate = record.resolved_date ? new Date(record.resolved_date).toISOString() : null;
        const lastReopenedAt = record.last_reopened_at ? new Date(record.last_reopened_at).toISOString() : null;
        const duration = normalizeOptionalNumber(record.duration);
        const reopenCount = normalizeOptionalNumber(record.reopen_count);
        const reassignmentCount = normalizeOptionalNumber(record.reassignment_count);
        const shortDescription = record.short_description ? String(record.short_description) : null;
        const workNotes = record.work_notes ? String(record.work_notes) : null;
        const madeSla = normalizeOptionalBoolean(record.made_sla);
        const fcr = normalizeOptionalBoolean(record.fcr);
        const requesterId = normalizeOptionalNumber(record.requester_id) ?? 1;
        const assignedToId = normalizeOptionalNumber(record.assigned_to_id);
        const closedById = normalizeOptionalNumber(record.closed_by_id);
        const resolvedById = normalizeOptionalNumber(record.resolved_by_id);
        const assignmentGroupId = normalizeOptionalNumber(record.assignment_group_id);
        const priorityId = normalizeOptionalNumber(record.priority_id) ?? 3;
        const impactId = normalizeOptionalNumber(record.impact_id) ?? 3;
        const urgencyId = normalizeOptionalNumber(record.urgency_id) ?? 2;
        const statusIdValue = statusId ?? 6;
        const subStatusId = normalizeOptionalNumber(record.sub_status_id);
        const categoryId = normalizeOptionalNumber(record.category_id) ?? 1;
        const subcategoryId = normalizeOptionalNumber(record.subcategory_id) ?? 1;
        const channelId = normalizeOptionalNumber(record.channel_id) ?? 1;
        const sourceId = normalizeOptionalNumber(record.source_id) ?? 1;
        const configItemId = normalizeOptionalNumber(record.config_item_id);
        const slaId = normalizeOptionalNumber(record.sla_id) ?? 3;
        const slaDueDate = record.sla_duedate ? new Date(record.sla_duedate).toISOString() : null;
        const baseIndex = rowIndex * columnCount;
        placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28})`);
        rows.push(ticketId, createdDate, resolvedDate, lastReopenedAt, duration, reopenCount, reassignmentCount, shortDescription, workNotes, madeSla, fcr, requesterId, assignedToId, closedById, resolvedById, assignmentGroupId, priorityId, impactId, urgencyId, statusIdValue, subStatusId, categoryId, subcategoryId, channelId, sourceId, configItemId, slaId, slaDueDate);
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
export async function updateTicket(id, payload) {
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
    const result = await query(`UPDATE tickets SET status_id = $1, assigned_to_id = $2, work_notes = $3, reopen_count = $4, last_reopened_at = ${lastReopenedAt}, updated_at = NOW()
     WHERE ticket_id = $5
     RETURNING *`, [newStatusId, normalizeOptionalNumber(payload.assigned_to_id), payload.notes, reopenCount, id]);
    return result.rows[0];
}
//# sourceMappingURL=ticketService.js.map