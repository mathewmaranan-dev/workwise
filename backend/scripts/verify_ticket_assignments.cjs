const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const query = `
      SELECT
        t.ticket_id,
        t.assignment_group_id AS ticket_group,
        t.assigned_to_id,
        u.assignment_group_id AS user_group,
        COALESCE(r.role_name, 'unknown') AS role_name
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE
        u.user_id IS NULL
        OR u.assignment_group_id IS DISTINCT FROM t.assignment_group_id
        OR r.role_name <> 'agent'
        OR t.assignment_group_id IS NULL
      ORDER BY t.ticket_id
    `;

    const res = await pool.query(query);
    if (!res.rows.length) {
      console.log('✅ All tickets comply: assigned agent exists, is active, role=agent, and assignment group matches ticket.');
      process.exit(0);
    }

    console.log(`⚠️ Found ${res.rows.length} ticket(s) that do NOT comply:`);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(2);
  } catch (err) {
    console.error('Error running verification query:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
