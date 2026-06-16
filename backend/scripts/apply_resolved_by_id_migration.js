import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const useSsl = !databaseUrl.includes('localhost');
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  try {
    const check = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolved_by_id' LIMIT 1`
    );

    if (check.rowCount > 0) {
      console.log('✅ Column resolved_by_id already exists on tickets. No action needed.');
      return;
    }

    console.log('Applying migration: ADD COLUMN resolved_by_id to tickets');
    await pool.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_by_id INT REFERENCES users(user_id);`
    );

    const verify = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolved_by_id' LIMIT 1`
    );

    if (verify.rowCount > 0) {
      console.log('✅ Migration applied successfully. Column resolved_by_id exists.');
    } else {
      console.error('❌ Migration ran, but resolved_by_id was not found afterwards.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
