import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  getUsersByGroup,
  suggestEmail,
  updateUser,
} from '../services/userService.js';

const router = Router();
const isDev = process.env.NODE_ENV !== 'production';

// Get all users (admin only)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Suggest the next available email. If a valid token is provided, return authoritative suggestion.
router.get('/next-email', async (req, res) => {
  try {
    const firstName = String(req.query.first_name || '').trim();
    const lastName = String(req.query.last_name || '').trim();

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name required' });
    }

    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader || '';
    let isAuthenticated = false;

    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'secret');
        isAuthenticated = true;
      } catch (e) {
        isAuthenticated = false;
      }
    }

    if (isAuthenticated) {
      const safe = await suggestEmail(firstName, lastName);
      return res.json(safe);
    }

    const normalizeValue = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const localPreview = `${normalizeValue(firstName)}.${normalizeValue(lastName)}00001@workwise.it.com`;
    const fullName = `${firstName} ${lastName}`.trim();
    return res.json({ email: localPreview, full_name: fullName });
  } catch (error) {
    console.error('Next email suggestion error:', (error as any)?.stack || error);
    res.status(500).json({ error: 'Failed to generate email suggestion' });
  }
});

// Get users by assignment group
router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    const gid = Number.parseInt(req.params.groupId, 10);
    if (Number.isNaN(gid)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const requester = (req as any).user;
    if (!requester) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const users = await getUsersByGroup(gid, { role: requester.role, id: Number(requester.id) });
      return res.json(users);
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Managers can only access their own assignment group' || message === 'Insufficient permissions') {
        return res.status(403).json({ error: message });
      }
      console.error('Get users by group error:', error);
      return res.status(500).json({ error: 'Failed to fetch users for group' });
    }
  } catch (error) {
    console.error('Get users by group error:', error);
    res.status(500).json({ error: 'Failed to fetch users for group' });
  }
});

// Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', (error as any)?.stack || error);
    const message = isDev ? ((error as any)?.message ? (error as any).message : String(error)) : 'Failed to create user';
    res.status(500).json({ error: message });
  }
});

// Update user (admin only)
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const requester = (req as any).user;
    const deleted = await deleteUser(req.params.id, requester?.email);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    const message = (error as any)?.message || 'Failed to delete user';
    if (message === 'Cannot delete the super admin account' || message === 'Only the super admin can delete other admin users') {
      return res.status(403).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

export default router;
