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
});

const normalize = (value) => String(value || '').trim();

async function run() {
  const client = await pool.connect();
  try {
    const selectSql = `SELECT user_id, first_name, last_name, email, password_hash FROM users WHERE first_name ILIKE 'Dino' OR last_name ILIKE '%oculligan%' OR email ILIKE '%oculligan%' ORDER BY user_id ASC`;
    const res = await client.query(selectSql);
    console.log('Found rows:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));

    if (res.rows.length === 0) {
      console.error('No matching user found. Exiting.');
      return;
    }

    const row = res.rows[0];
    const targetEmail = 'dino.oculligan00016@workwise.it.com';
    const targetPassword = `Dino.O'culligan00016`;
    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    console.log('Updating user_id=', row.user_id);
    console.log('  first_name=', row.first_name);
    console.log('  last_name=', row.last_name);
    console.log('  old email=', row.email);
    console.log('  new email=', targetEmail);
    console.log('  new password=', targetPassword);

    const updateSql = `UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE user_id = $3`;
    await client.query(updateSql, [targetEmail, hashedPassword, row.user_id]);
    console.log('Update complete.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
