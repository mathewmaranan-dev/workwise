import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const CLOSED_STATUS_IDS = [5]; // Only 'Closed' should be treated as temporary parked work

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

// Get all tickets (with filters)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, assigned_to, priority } = req.query;
    
    let queryStr = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];

    if (status) {
      queryStr += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    if (assigned_to) {
      queryStr += ` AND assigned_to_id = $${params.length + 1}`;
      params.push(assigned_to);
    }
    if (priority) {
      queryStr += ` AND priority_id = $${params.length + 1}`;
      params.push(priority);
    }

    queryStr += ' ORDER BY created_at DESC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get ticket by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM tickets WHERE ticket_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, priority_id, assigned_to, assignment_group_id } = req.body;

    const result = await query(
      `INSERT INTO tickets (ticket_id, created_date, assigned_to_id, assignment_group_id, priority_id, status_id, requester_id, created_at)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        `NEW-${Date.now()}`,
        assigned_to,
        assignment_group_id,
        priority_id,
        1, // New
        1,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Import tickets from CSV and upsert them into the database
router.post('/import', verifyToken, async (req, res) => {
  try {
    const { tickets } = req.body;
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: 'No tickets provided for import' });
    }

    const rows = [];
    const placeholders: string[] = [];
    const columnCount = 28;
    let rowIndex = 0;

    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i] ?? {};
      const ticketId = String(ticket.ticket_id || '').trim();
      if (!ticketId) {
        continue;
      }

      const statusId = await resolveStatusId(ticket.status_id, ticket.status_name || ticket.status);
      const createdDate = ticket.created_date ? new Date(ticket.created_date).toISOString() : new Date().toISOString();
      const resolvedDate = ticket.resolved_date ? new Date(ticket.resolved_date).toISOString() : null;
      const lastReopenedAt = ticket.last_reopened_at ? new Date(ticket.last_reopened_at).toISOString() : null;
      const duration = normalizeOptionalNumber(ticket.duration);
      const reopenCount = normalizeOptionalNumber(ticket.reopen_count);
      const reassignmentCount = normalizeOptionalNumber(ticket.reassignment_count);
      const shortDescription = ticket.short_description ? String(ticket.short_description) : null;
      const workNotes = ticket.work_notes ? String(ticket.work_notes) : null;
      const madeSla = normalizeOptionalBoolean(ticket.made_sla);
      const fcr = normalizeOptionalBoolean(ticket.fcr);
      const requesterId = normalizeOptionalNumber(ticket.requester_id) ?? 1;
      const assignedToId = normalizeOptionalNumber(ticket.assigned_to_id);
      const closedById = normalizeOptionalNumber(ticket.closed_by_id);
      const resolvedById = normalizeOptionalNumber(ticket.resolved_by_id);
      const assignmentGroupId = normalizeOptionalNumber(ticket.assignment_group_id);
      const priorityId = normalizeOptionalNumber(ticket.priority_id) ?? 3;
      const impactId = normalizeOptionalNumber(ticket.impact_id) ?? 3;
      const urgencyId = normalizeOptionalNumber(ticket.urgency_id) ?? 2;
      const statusIdValue = statusId ?? 6;
      const subStatusId = normalizeOptionalNumber(ticket.sub_status_id);
      const categoryId = normalizeOptionalNumber(ticket.category_id) ?? 1;
      const subcategoryId = normalizeOptionalNumber(ticket.subcategory_id) ?? 1;
      const channelId = normalizeOptionalNumber(ticket.channel_id) ?? 1;
      const sourceId = normalizeOptionalNumber(ticket.source_id) ?? 1;
      const configItemId = normalizeOptionalNumber(ticket.config_item_id);
      const slaId = normalizeOptionalNumber(ticket.sla_id) ?? 3;
      const slaDueDate = ticket.sla_duedate ? new Date(ticket.sla_duedate).toISOString() : null;

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
      return res.status(400).json({ error: 'No valid tickets were found in the import payload' });
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
    res.json({ imported: result.rows.length, tickets: result.rows });
  } catch (error) {
    console.error('Import tickets error:', error);
    res.status(500).json({ error: 'Failed to import tickets' });
  }
});

// Update ticket
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status_id, assigned_to_id, notes } = req.body;

    const existing = await query('SELECT status_id, reopen_count FROM tickets WHERE ticket_id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const previousStatusId = existing.rows[0].status_id;
    const previousReopenCount = existing.rows[0].reopen_count ?? 0;
    const newStatusId = normalizeOptionalNumber(status_id) ?? previousStatusId;
    const shouldIncrementReopen = CLOSED_STATUS_IDS.includes(previousStatusId) && !CLOSED_STATUS_IDS.includes(newStatusId);
    const reopenCount = shouldIncrementReopen ? previousReopenCount + 1 : previousReopenCount;
    const lastReopenedAt = shouldIncrementReopen ? 'NOW()' : 'last_reopened_at';

    const result = await query(
      `UPDATE tickets SET status_id = $1, assigned_to_id = $2, work_notes = $3, reopen_count = $4, last_reopened_at = ${lastReopenedAt}, updated_at = NOW()
       WHERE ticket_id = $5
       RETURNING *`,
      [newStatusId, normalizeOptionalNumber(assigned_to_id), notes, reopenCount, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;
