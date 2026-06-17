import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  createTicket,
  getAllTickets,
  getTicketById,
  importTickets,
  updateTicket,
} from '../services/ticketService.js';

const router = Router();

// Get all tickets (with filters)
router.get('/', verifyToken, async (req, res) => {
  try {
    const tickets = await getAllTickets({
      status: String(req.query.status || ''),
      assigned_to: String(req.query.assigned_to || ''),
      priority: String(req.query.priority || ''),
    });
    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get ticket by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket
router.post('/', verifyToken, async (req, res) => {
  try {
    const ticket = await createTicket(req.body);
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Import tickets from CSV and upsert them into the database
router.post('/import', verifyToken, async (req, res) => {
  try {
    const importedTickets = await importTickets(req.body.tickets);
    res.json({ imported: importedTickets.length, tickets: importedTickets });
  } catch (error) {
    console.error('Import tickets error:', error);
    res.status(400).json({ error: (error as Error).message || 'Failed to import tickets' });
  }
});

// Update ticket
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const ticket = await updateTicket(req.params.id, req.body);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;
