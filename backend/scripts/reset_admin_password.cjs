const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const newPassword = process.env.NEW_ADMIN_PASSWORD || 'Admin!23Changed';
  const email = process.env.ADMIN_EMAIL || 'admin@workwise.it.com';
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const res = await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING user_id, email', [hashed, email]);
    if (res.rows.length === 0) {
      console.error('No user updated. Email may not exist:', email);
      process.exit(1);
    }
    console.log('Password updated for:', res.rows[0]);
    console.log('New password is:', newPassword);
  } catch (err) {
    console.error('Failed to update password:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
