import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
const router = Router();
const sanitizeForEmail = (value) => {
    return String(value || '').trim().toLowerCase().replace(/[\s']/g, '').replace(/[^a-z0-9]/g, '');
};
const capitalizeName = (value) => {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};
const generateEmailCandidate = (firstName, lastName, suffix) => {
    const localPart = `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}`;
    return `${localPart}${String(suffix).padStart(5, '0')}@workwise.it.com`;
};
const getSuggestedEmail = async (firstName, lastName) => {
    const cleanFirst = sanitizeForEmail(firstName);
    const cleanLast = sanitizeForEmail(lastName);
    const fullName = `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim();
    if (!cleanFirst || !cleanLast) {
        return { email: '', password: '', full_name: fullName };
    }
    const nextIdResult = await query(`SELECT COALESCE(MAX(user_id), 0) + 1 AS next_id FROM users WHERE user_id > 0`);
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
        const result = await query(`SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/next-email', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const firstName = String(req.query.first_name || '').trim();
        const lastName = String(req.query.last_name || '').trim();
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name required' });
        }
        const suggested = await getSuggestedEmail(firstName, lastName);
        res.json(suggested);
    }
    catch (error) {
        console.error('Next email suggestion error:', error);
        res.status(500).json({ error: 'Failed to generate email suggestion' });
    }
});
// Get user by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Create user (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { first_name, last_name, email, password, role, assignment_group_id } = req.body;
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
        const insertResult = await query(`INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING user_id`, [first_name, last_name, finalEmail, hashedPassword, roleId, assignment_group_id || null]);
        const userId = insertResult.rows[0].user_id;
        const userResult = await query(`SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`, [userId]);
        res.status(201).json(userResult.rows[0]);
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
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
        const result = await query(`UPDATE users SET first_name = $1, last_name = $2, role_id = $3, assignment_group_id = $4, updated_at = NOW()
       WHERE user_id = $5
       RETURNING user_id AS id`, [first_name, last_name, roleId, assignment_group_id || null, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userResult = await query(`SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
              u.assignment_group_id, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`, [id]);
        res.json(userResult.rows[0]);
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// Delete user (admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM users WHERE user_id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
export default router;
//# sourceMappingURL=users.js.map