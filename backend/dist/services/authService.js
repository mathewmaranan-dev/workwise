import { query } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
export async function authenticateUser(email, password) {
    const result = await query(`SELECT u.user_id AS id, u.email, u.password_hash, r.role_name AS role, u.terms_accepted,
                u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.email = $1`, [email]);
    if (result.rows.length === 0) {
        return null;
    }
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        return null;
    }
    const token = jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
    }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    return {
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
    };
}
export async function getCurrentUser(userId) {
    const result = await query(`SELECT u.user_id AS id, u.email, u.first_name, u.last_name, r.role_name AS role, u.terms_accepted,
              u.assignment_group_id, ag.group_name AS assignment_group, u.shift AS shift
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
       WHERE u.user_id = $1`, [userId]);
    return result.rows[0];
}
export async function acceptTerms(userId) {
    await query('UPDATE users SET terms_accepted = TRUE, updated_at = NOW() WHERE user_id = $1', [userId]);
    return getCurrentUser(userId);
}
export async function changePassword(userId, currentPassword, newPassword) {
    const result = await query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    const { password_hash } = result.rows[0];
    const passwordMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!passwordMatch) {
        throw new Error('Invalid current password');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2', [hashedPassword, userId]);
    return true;
}
//# sourceMappingURL=authService.js.map