#!/usr/bin/env node
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function emailExists(client, email, skipUserId) {
  const res = await client.query('SELECT user_id FROM users WHERE email = $1 AND user_id <> $2', [email, skipUserId || -1]);
  return res.rows.length > 0;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to DB, loading users...');
    const res = await client.query(`SELECT user_id, first_name, last_name, email
      FROM users
      ORDER BY user_id ASC`);

    const rows = res.rows;

    let counter = 1;
    for (const row of rows) {
      const { user_id, first_name, last_name, email } = row;

      if (!first_name || !last_name) {
        console.log(`Skipping user_id=${user_id} (missing name)`);
        continue;
      }
      const lcEmail = (email || '').toLowerCase();

      // Default accounts mapping
      let isDefaultAccount = false;
      let targetEmail = null;
      let plainPassword = null;

      if (lcEmail.includes('admin@') || (first_name.toLowerCase() === 'default' && last_name.toLowerCase() === 'admin')) {
        isDefaultAccount = true;
        targetEmail = 'admin@workwise.it.com';
        plainPassword = 'Admin!23';
      } else if (lcEmail.includes('manager@') || (first_name.toLowerCase() === 'default' && last_name.toLowerCase() === 'manager')) {
        isDefaultAccount = true;
        targetEmail = 'manager@workwise.it.com';
        plainPassword = 'Manager!23';
      } else if (lcEmail.includes('hr@') || (first_name.toLowerCase() === 'default' && last_name.toLowerCase() === 'hr')) {
        isDefaultAccount = true;
        targetEmail = 'hr@workwise.it.com';
        plainPassword = 'HR!23';
      } else if (lcEmail.includes('agent@') || (first_name.toLowerCase() === 'default' && last_name.toLowerCase() === 'agent')) {
        isDefaultAccount = true;
        targetEmail = 'agent@workwise.it.com';
        plainPassword = 'Agent!23';
      }

      let newEmail = '';
      if (isDefaultAccount) {
        // Ensure we won't overwrite another user's email
        if (await emailExists(client, targetEmail, user_id)) {
          console.warn(`Default target email ${targetEmail} already exists for another user; skipping user_id=${user_id}`);
          continue;
        }
        newEmail = targetEmail;
      } else {
        // If user has legacy .app email, reuse local part and switch domain
        if (lcEmail.endsWith('@workwise.app')) {
          const local = lcEmail.split('@')[0];
          let candidate = `${local}@workwise.it.com`;
          let attempts = 0;
          while (await emailExists(client, candidate, user_id) && attempts < 1000) {
            counter += 1;
            const suffix = String(counter).padStart(5, '0');
            candidate = `${local}${suffix}@workwise.it.com`;
            attempts += 1;
          }
          newEmail = candidate;
          plainPassword = `${capitalize(first_name)}.${capitalize(last_name)}${String(counter).padStart(5, '0')}`;
        } else {
          // Build base suffix and attempt to ensure uniqueness for generated emails
          let suffix = String(counter).padStart(5, '0');
          let candidate = `${first_name.toLowerCase()}.${last_name.toLowerCase()}${suffix}@workwise.it.com`;
          let attempts = 0;
          while (await emailExists(client, candidate, user_id) && attempts < 1000) {
            counter += 1;
            suffix = String(counter).padStart(5, '0');
            candidate = `${first_name.toLowerCase()}.${last_name.toLowerCase()}${suffix}@workwise.it.com`;
            attempts += 1;
          }
          newEmail = candidate;
          plainPassword = `${capitalize(first_name)}.${capitalize(last_name)}${suffix}`;
        }
      }
      const hashed = await bcrypt.hash(plainPassword, 10);

      try {
        await client.query(
          `UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE user_id = $3`,
          [newEmail, hashed, user_id]
        );
        console.log(`Updated user_id=${user_id} -> ${newEmail} (password set)`);
      } catch (updateErr) {
        console.error(`Failed to update user_id=${user_id}:`, updateErr.message || updateErr);
      }

      counter += 1;
    }

    console.log('Update complete.');
  } catch (err) {
    console.error('Script failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
