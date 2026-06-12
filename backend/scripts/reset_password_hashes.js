import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const defaultPasswords = {
  'admin@workwise.it.com': 'Admin!23',
  'manager@workwise.it.com': 'Manager!23',
  'hr@workwise.it.com': 'HR!23',
  'agent@workwise.it.com': 'Agent!23',
};

function safeName(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .replace(/\s+/g, '');
}

function capitalize(value) {
  if (!value) return '';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function generatePassword(user) {
  const email = String(user.email || '').trim().toLowerCase();
  if (defaultPasswords[email]) {
    return defaultPasswords[email];
  }
  const firstName = safeName(user.first_name) || safeName(user.email?.split('@')[0]);
  const lastName = safeName(user.last_name) || '';
  const idSuffix = String(user.user_id).padStart(5, '0');
  if (!firstName && !lastName) {
    return `User${idSuffix}`;
  }
  const prefix = `${capitalize(firstName)}.${capitalize(lastName || firstName)}`;
  return `${prefix}${idSuffix}`;
}

async function resetPasswords() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT user_id, first_name, last_name, email FROM users ORDER BY user_id');
    const users = result.rows;
    if (!users.length) {
      console.log('No users found.');
      return;
    }

    console.log(`Resetting passwords for ${users.length} user(s)...`);
    for (const user of users) {
      const newPassword = generatePassword(user);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [hashedPassword, user.user_id]
      );
      console.log(`- ${user.email} => ${newPassword}`);
    }
    console.log('\nDone. All user password hashes have been updated.');
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPasswords();
