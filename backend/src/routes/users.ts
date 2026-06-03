import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const isDev = process.env.NODE_ENV !== 'production';

const sanitizeForEmail = (value: string) => {
  return String(value || '').trim().toLowerCase().replace(/[\s']/g, '').replace(/[^a-z0-9]/g, '');
};

const capitalizeName = (value: string) => {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const generateEmailCandidate = (firstName: string, lastName: string, suffix: number) => {
  const localPart = `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}`;
  return `${localPart}${String(suffix).padStart(5, '0')}@workwise.it.com`;
};

const getSuggestedEmail = async (firstName: string, lastName: string) => {
  const cleanFirst = sanitizeForEmail(firstName);
  const cleanLast = sanitizeForEmail(lastName);
  const fullName = `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim();

  if (!cleanFirst || !cleanLast) {
    return { email: '', password: '', full_name: fullName };
  }

  const nextIdResult = await query(
    `SELECT COALESCE(MAX(user_id), 0) + 1 AS next_id FROM users WHERE user_id > 0`
  );
  let nextId = Number(nextIdResult.rows[0]?.next_id || 1);
  let candidate = generateEmailCandidate(firstName, lastName, nextId);
  let attempts = 0;

  while (attempts < 1000) {
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [candidate]);
    if (exists.rows.length === 0) {
      break;
    }
    nextId += 1;
    candidate = generateEmailCandidate(firstName, lastName, nextId);
    attempts += 1;
  }

  const password = `${capitalizeName(firstName)}.${capitalizeName(lastName)}${String(nextId).padStart(5, '0')}`;
  return { email: candidate, password, full_name: fullName };
};

// Get all users (admin only)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
            u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
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

    // Check for optional token; don't reject if absent or invalid.
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader || '';
    let isAuthenticated = false;
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'secret');
        isAuthenticated = true;
      } catch (e) {
        // invalid token: treat as unauthenticated but do not fail
        isAuthenticated = false;
      }
    }

    if (isAuthenticated) {
      const suggested = await getSuggestedEmail(firstName, lastName);
      // Do not return generated password in the suggestion response
      const { password, ...safe } = suggested as any;
      return res.json(safe);
    }

    // Unauthenticated: return a safe local preview without touching DB or revealing password
    const localPreview = `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}00001@workwise.it.com`;
    const fullName = `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim();
    return res.json({ email: localPreview, full_name: fullName });
  } catch (error) {
    console.error('Next email suggestion error:', (error as any)?.stack || error);
    res.status(500).json({ error: 'Failed to generate email suggestion' });
  }
});

// Get users by assignment group (admins, or the manager of that group)
router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const gid = parseInt(groupId as string, 10);
    if (Number.isNaN(gid)) return res.status(400).json({ error: 'Invalid group id' });

    // requester info from verifyToken
    const requester = (req as any).user;
    if (!requester) return res.status(401).json({ error: 'Not authenticated' });

    // Admins can access any group; managers only their own group
    if (requester.role !== 'admin') {
      if (requester.role === 'manager') {
        const mgr = await query('SELECT assignment_group_id FROM users WHERE user_id = $1', [requester.id]);
        const mgrGroup = mgr.rows[0]?.assignment_group_id;
        if (!mgrGroup || Number(mgrGroup) !== gid) {
          return res.status(403).json({ error: 'Managers can only access their own assignment group' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const result = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, ag.group_name AS assignment_group, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.assignment_group_id = $1
       ORDER BY u.first_name, u.last_name`,
      [gid]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users by group error:', error);
    res.status(500).json({ error: 'Failed to fetch users for group' });
  }
});

// Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
            u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
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

// Get users by assignment group (admins, or the manager of that group)
router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const gid = parseInt(groupId as string, 10);
    if (Number.isNaN(gid)) return res.status(400).json({ error: 'Invalid group id' });

    // requester info from verifyToken
    const requester = (req as any).user;
    if (!requester) return res.status(401).json({ error: 'Not authenticated' });

    // Admins can access any group; managers only their own group
    if (requester.role !== 'admin') {
      if (requester.role === 'manager') {
        const mgr = await query('SELECT assignment_group_id FROM users WHERE user_id = $1', [requester.id]);
        const mgrGroup = mgr.rows[0]?.assignment_group_id;
        if (!mgrGroup || Number(mgrGroup) !== gid) {
          return res.status(403).json({ error: 'Managers can only access their own assignment group' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const result = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.assignment_group_id = $1
       ORDER BY u.first_name, u.last_name`,
      [gid]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users by group error:', error);
    res.status(500).json({ error: 'Failed to fetch users for group' });
  }
});

// Create user (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, assignment_group_id } = req.body;

    // log request metadata for debugging (avoid logging raw passwords)
    console.log('Create user request:', { first_name, last_name, email, role, assignment_group_id });

    if (!first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const suggested = await getSuggestedEmail(first_name, last_name);
    const finalEmail = String(email || '').trim().toLowerCase() || suggested.email;
    const finalPassword = String(password || '').trim() || suggested.password;

    if (!finalEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!finalPassword) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const existingEmail = await query('SELECT 1 FROM users WHERE email = $1', [finalEmail]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const roleId = roleResult.rows[0].role_id;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const insertResult = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING user_id`,
      [first_name, last_name, finalEmail, hashedPassword, roleId, assignment_group_id || null]
    );

    const userId = insertResult.rows[0].user_id;
    const userResult = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
      [userId]
    );

    res.status(201).json(userResult.rows[0]);
  } catch (error) {
    console.error('Create user error:', (error as any)?.stack || error);
    const message = isDev ? ((error as any)?.message ? (error as any).message : String(error)) : 'Failed to create user';
    res.status(500).json({ error: message });
  }
});

// Update user (admin only)
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, assignment_group_id } = req.body;

    const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const roleId = roleResult.rows[0].role_id;
    const result = await query(
      `UPDATE users SET first_name = $1, last_name = $2, role_id = $3, assignment_group_id = $4, updated_at = NOW()
       WHERE user_id = $5
       RETURNING user_id AS id`,
      [first_name, last_name, roleId, assignment_group_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userResult = await query(
      `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
      [id]
    );

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Identify super-admin by email (configurable via env)
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workwise.app';

    // Fetch target user and role
    const targetResult = await query(
      `SELECT u.user_id AS id, u.email, r.role_name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [id]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const target = targetResult.rows[0];

    // Prevent deleting the super admin account
    if (String(target.email).toLowerCase() === String(SUPER_ADMIN_EMAIL).toLowerCase()) {
      return res.status(403).json({ error: 'Cannot delete the super admin account' });
    }

    // If target is an admin, only the super admin may delete them
    if (String(target.role).toLowerCase() === 'admin') {
      const requesterEmail = String(req.user?.email || '').toLowerCase();
      if (requesterEmail !== String(SUPER_ADMIN_EMAIL).toLowerCase()) {
        return res.status(403).json({ error: 'Only the super admin can delete other admin users' });
      }
    }

    await query('DELETE FROM users WHERE user_id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
