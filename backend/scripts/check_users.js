#!/usr/bin/env node
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: './.env' });

const { Pool } = pg;
const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT user_id, first_name, last_name, email, updated_at FROM users ORDER BY user_id ASC');
    console.log(`Found ${res.rows.length} users:`);
    for (const r of res.rows) {
      console.log(`${r.user_id}\t${r.first_name} ${r.last_name}\t${r.email}\t${r.updated_at}`);
    }
  } catch (err) {
    console.error('Query failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
