import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Get all users (admin only)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, email, role, assignment_group_id, created_at 
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, first_name, last_name, email, role, assignment_group_id, created_at 
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, assignment_group_id } = req.body;

    if (!first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, assignment_group_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, hashedPassword, role, assignment_group_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, assignment_group_id } = req.body;

    const result = await query(
      `UPDATE users SET first_name = $1, last_name = $2, role = $3, assignment_group_id = $4
       WHERE id = $5
       RETURNING id, first_name, last_name, email, role, assignment_group_id`,
      [first_name, last_name, role, assignment_group_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
