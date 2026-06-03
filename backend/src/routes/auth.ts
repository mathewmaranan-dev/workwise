import { Router, Response } from 'express';
import { query } from '../config/database.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest, verifyToken } from '../middleware/auth.js';

const router = Router();

interface LoginBody {
  email: string;
  password: string;
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Query user from database
    const result = await query(
      `SELECT u.user_id AS id, u.email, u.password_hash, r.role_name AS role, u.terms_accepted,
                u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        termsAccepted: !!user.terms_accepted,
        assignment_group_id: user.assignment_group_id ?? null,
        assignment_group: user.assignment_group || null,
        shift: user.shift || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await query(
      `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, r.role_name AS role, u.terms_accepted,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    // normalize terms_accepted column
    const responseUser = {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      termsAccepted: !!row.terms_accepted,
      assignment_group_id: row.assignment_group_id ?? null,
      assignment_group: row.assignment_group || null,
      shift: row.shift || null,
    };
    res.json(responseUser);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Accept terms (persist for user)
router.post('/accept-terms', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await query('UPDATE users SET terms_accepted = TRUE, updated_at = NOW() WHERE user_id = $1', [req.user.id]);

    const result = await query(
      `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, r.role_name AS role, u.terms_accepted,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    res.json({ id: row.id, email: row.email, first_name: row.first_name, last_name: row.last_name, role: row.role, termsAccepted: !!row.terms_accepted, assignment_group_id: row.assignment_group_id ?? null, assignment_group: row.assignment_group || null, shift: row.shift || null });
  } catch (error) {
    console.error('Accept terms error:', error);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

router.post('/change-password', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const result = await query(
      `SELECT password_hash FROM users WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash } = result.rows[0];
    const passwordMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
      [hashedPassword, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
