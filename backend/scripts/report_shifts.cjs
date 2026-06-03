const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined });
  try {
    const res = await pool.query(`
      SELECT u.assignment_group_id AS gid, ag.group_name,
             SUM(CASE WHEN u.shift = 'Morning' THEN 1 ELSE 0 END) AS morning,
             SUM(CASE WHEN u.shift = 'Afternoon' THEN 1 ELSE 0 END) AS afternoon,
             SUM(CASE WHEN u.shift = 'Night' THEN 1 ELSE 0 END) AS night,
             SUM(CASE WHEN u.shift IS NULL OR u.shift = '' THEN 1 ELSE 0 END) AS nulls,
             COUNT(*) AS total
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.assignment_group_id
      WHERE r.role_name = 'agent' AND u.assignment_group_id IS NOT NULL
      GROUP BY u.assignment_group_id, ag.group_name
      ORDER BY u.assignment_group_id
    `);

    console.log('Shift counts by assignment group:');
    for (const row of res.rows) {
      console.log(`Group ${row.gid} (${row.group_name || 'Unknown'}): Morning=${row.morning}, Afternoon=${row.afternoon}, Night=${row.night}, Null=${row.nulls}, Total=${row.total}`);
    }

    const nulls = await pool.query(`
      SELECT u.user_id, u.email, u.assignment_group_id
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE r.role_name = 'agent' AND (u.shift IS NULL OR u.shift = '')
      ORDER BY u.assignment_group_id, u.user_id
    `);

    if (nulls.rows.length === 0) {
      console.log('\nNo agents with null shifts.');
    } else {
      console.log('\nAgents with null shifts:');
      for (const u of nulls.rows) {
        console.log(`- ${u.user_id}: ${u.email} (group ${u.assignment_group_id})`);
      }
    }
  } catch (err) {
    console.error('Report failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
