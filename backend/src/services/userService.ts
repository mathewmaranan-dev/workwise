import { query } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

const normalizeForPasswordPart = (value: string) => {
  return String(value || '')
    .trim()
    .split(/[\s'-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
};

const generateEmailCandidate = (firstName: string, lastName: string, suffix: number) => {
  const localPart = `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}`;
  return `${localPart}${String(suffix).padStart(5, '0')}@workwise.it.com`;
};

async function getSuggestedEmail(firstName: string, lastName: string) {
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

  const password = `${normalizeForPasswordPart(firstName)}.${normalizeForPasswordPart(lastName)}${String(nextId).padStart(5, '0')}`;
  return { email: candidate, password, full_name: fullName };
}

export async function getAllUsers() {
  const result = await query(
    `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
            u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       ORDER BY u.created_at DESC`
  );
  return result.rows;
}

export async function suggestEmail(firstName: string, lastName: string) {
  const cleanFirst = sanitizeForEmail(firstName);
  const cleanLast = sanitizeForEmail(lastName);
  const fullName = `${capitalizeName(firstName)} ${capitalizeName(lastName)}`.trim();

  if (!cleanFirst || !cleanLast) {
    return { email: '', full_name: fullName };
  }

  const suggested = await getSuggestedEmail(firstName, lastName);
  const { password, ...safe } = suggested as any;
  return safe;
}

export async function getUsersByGroup(groupId: number, requester: { role: string; id: number }) {
  if (requester.role !== 'admin') {
    if (requester.role === 'manager') {
      const mgr = await query('SELECT assignment_group_id FROM users WHERE user_id = $1', [requester.id]);
      const mgrGroup = mgr.rows[0]?.assignment_group_id;
      if (!mgrGroup || Number(mgrGroup) !== groupId) {
        throw new Error('Managers can only access their own assignment group');
      }
    } else {
      throw new Error('Insufficient permissions');
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
    [groupId]
  );
  return result.rows;
}

export async function getUserById(id: string) {
  const result = await query(
    `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name AS role,
            u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function createUser(payload: {
  first_name: string;
  last_name: string;
  email?: string;
  password?: string;
  role: string;
  assignment_group_id?: unknown;
}) {
  const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [payload.role]);
  if (roleResult.rows.length === 0) {
    throw new Error('Invalid role');
  }

  const suggested = await getSuggestedEmail(payload.first_name, payload.last_name);
  const finalEmail = String(payload.email || '').trim().toLowerCase() || suggested.email;
  const finalPassword = String(payload.password || '').trim() || suggested.password;

  if (!finalEmail) {
    throw new Error('Email is required');
  }
  if (!finalPassword) {
    throw new Error('Password is required');
  }

  const existingEmail = await query('SELECT 1 FROM users WHERE email = $1', [finalEmail]);
  if (existingEmail.rows.length > 0) {
    throw new Error('Email already exists');
  }

  const roleId = roleResult.rows[0].role_id;
  const hashedPassword = await bcrypt.hash(finalPassword, 10);

  const insertResult = await query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING user_id`,
    [payload.first_name, payload.last_name, finalEmail, hashedPassword, roleId, payload.assignment_group_id || null]
  );

  const userId = insertResult.rows[0].user_id;
  return getUserById(String(userId));
}

export async function updateUser(id: string, payload: {
  first_name: string;
  last_name: string;
  role: string;
  assignment_group_id?: unknown;
}) {
  const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [payload.role]);
  if (roleResult.rows.length === 0) {
    throw new Error('Invalid role');
  }

  const roleId = roleResult.rows[0].role_id;
  const result = await query(
    `UPDATE users SET first_name = $1, last_name = $2, role_id = $3, assignment_group_id = $4, updated_at = NOW()
     WHERE user_id = $5
     RETURNING user_id AS id`,
    [payload.first_name, payload.last_name, roleId, payload.assignment_group_id || null, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return getUserById(id);
}

export async function deleteUser(id: string, requesterEmail?: string) {
  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workwise.it.com';
  const SUPER_ADMIN_FULL_NAME = 'default admin';

  const targetResult = await query(
    `SELECT u.user_id AS id, u.email, u.first_name, u.last_name, r.role_name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
    [id]
  );

  if (targetResult.rows.length === 0) {
    return null;
  }

  const target = targetResult.rows[0];
  const targetEmail = String(target.email || '').trim().toLowerCase();
  const targetFullName = `${String(target.first_name || '').trim()} ${String(target.last_name || '').trim()}`.trim().toLowerCase();

  if (targetEmail === String(SUPER_ADMIN_EMAIL).toLowerCase() || targetFullName === SUPER_ADMIN_FULL_NAME) {
    throw new Error('Cannot delete the super admin account');
  }

  if (String(target.role).toLowerCase() === 'admin') {
    const requestEmailLower = String(requesterEmail || '').toLowerCase();
    if (requestEmailLower !== String(SUPER_ADMIN_EMAIL).toLowerCase()) {
      throw new Error('Only the super admin can delete other admin users');
    }
  }

  await query('DELETE FROM users WHERE user_id = $1', [id]);
  return true;
}

export async function resetUserPassword(id: string) {
  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@workwise.it.com';
  const SUPER_ADMIN_FULL_NAME = 'default admin';

  const targetResult = await query(
    `SELECT user_id, first_name, last_name, email
       FROM users
       WHERE user_id = $1`,
    [id]
  );

  if (targetResult.rows.length === 0) {
    return null;
  }

  const target = targetResult.rows[0];
  const targetEmail = String(target.email || '').trim().toLowerCase();
  const targetFullName = `${String(target.first_name || '').trim()} ${String(target.last_name || '').trim()}`.trim().toLowerCase();

  if (targetEmail === String(SUPER_ADMIN_EMAIL).toLowerCase() || targetFullName === SUPER_ADMIN_FULL_NAME) {
    throw new Error('Cannot reset the super admin password');
  }

  const password = `${normalizeForPasswordPart(target.first_name)}.${normalizeForPasswordPart(target.last_name)}${String(target.user_id).padStart(5, '0')}`;
  const hashedPassword = await bcrypt.hash(password, 10);

  await query(
    `UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
      WHERE user_id = $2`,
    [hashedPassword, id]
  );

  return { defaultPassword: password };
}
