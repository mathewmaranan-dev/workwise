import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

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
      `INSERT INTO tickets (title, description, priority_id, assigned_to, assignment_group_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING *`,
      [title, description, priority_id, assigned_to, assignment_group_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, notes } = req.body;

    const result = await query(
      `UPDATE tickets SET status = $1, assigned_to = $2, work_notes = $3, updated_at = NOW()
       WHERE ticket_id = $4
       RETURNING *`,
      [status, assigned_to, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;
