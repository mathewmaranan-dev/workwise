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
    const res = await client.query('SELECT user_id FROM users ORDER BY user_id ASC');
    const ids = res.rows.map(r => r.user_id);
    if (ids.length === 0) {
      console.log('No users found.');
      return;
    }
    const min = ids[0];
    const max = ids[ids.length - 1];
    const missing = [];
    let current = min;
    const idSet = new Set(ids);
    for (let i = min; i <= max; i++) {
      if (!idSet.has(i)) missing.push(i);
    }
    console.log(`User id range: ${min}..${max} (count=${ids.length})`);
    if (missing.length === 0) {
      console.log('No gaps in `user_id` sequence.');
    } else {
      console.log(`Found ${missing.length} missing id(s): ${missing.slice(0,50).join(', ')}${missing.length>50?', ...':''}`);
      console.log('Missing ids are typically caused by deleted rows or by inserts that were rolled back/removed.');
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
