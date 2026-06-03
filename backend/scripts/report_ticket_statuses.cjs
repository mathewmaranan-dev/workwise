const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined });
  try {
    const res = await pool.query(`
      SELECT s.status_name, COUNT(t.ticket_id) AS cnt
      FROM status s
      LEFT JOIN tickets t ON t.status_id = s.status_id
      GROUP BY s.status_name
      ORDER BY s.status_name
    `);
    console.log('Ticket counts by status:');
    for (const row of res.rows) {
      console.log(`${row.status_name}: ${row.cnt}`);
    }

    const sample = await pool.query(`
      SELECT ticket_id, status_id FROM tickets ORDER BY ticket_id LIMIT 20
    `);
    console.log('\nSample ticket status ids:');
    for (const r of sample.rows) console.log(`${r.ticket_id}: ${r.status_id}`);
  } catch (err) {
    console.error('Failed to report ticket statuses:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
