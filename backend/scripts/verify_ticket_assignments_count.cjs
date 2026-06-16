const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id IS NULL
        OR u.assignment_group_id IS DISTINCT FROM t.assignment_group_id
        OR r.role_name <> 'agent'
        OR t.assignment_group_id IS NULL
    `;
    const res = await pool.query(countQuery);
    console.log(res.rows[0].cnt);
    process.exit(0);
  } catch (err) {
    console.error('Error running count query:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
