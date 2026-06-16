const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');

    // Get count of tickets with mismatched groups before update
    const beforeRes = await pool.query(`
      SELECT COUNT(*) AS cnt FROM tickets t
      JOIN users u ON t.assigned_to_id = u.user_id
      WHERE t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
    `);
    const mismatchBefore = Number(beforeRes.rows[0].cnt);

    // Update all tickets to match their assigned agent's assignment_group_id
    const updateRes = await pool.query(`
      UPDATE tickets t
      SET assignment_group_id = u.assignment_group_id, updated_at = NOW()
      FROM users u
      WHERE t.assigned_to_id = u.user_id
        AND t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
    `);
    const updateCount = updateRes.rowCount;

    // Handle null group tickets
    const nullGroupRes = await pool.query(`
      SELECT t.ticket_id FROM tickets t
      WHERE t.assignment_group_id IS NULL
    `);
    const nullCount = nullGroupRes.rows.length;
    if (nullCount > 0) {
      const ticketIds = nullGroupRes.rows.map(r => r.ticket_id);
      console.warn(`⚠️  Found ${nullCount} ticket(s) with NULL assignment_group_id. These cannot be auto-fixed without an assigned agent.`);
      console.warn('Ticket IDs:', ticketIds);
    }

    // Verify fix
    const afterRes = await pool.query(`
      SELECT COUNT(*) AS cnt FROM tickets t
      JOIN users u ON t.assigned_to_id = u.user_id
      WHERE t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
    `);
    const mismatchAfter = Number(afterRes.rows[0].cnt);

    await pool.query('COMMIT');

    console.log(JSON.stringify({
      mismatches_before: mismatchBefore,
      mismatches_after: mismatchAfter,
      tickets_updated: updateCount,
      tickets_with_null_group: nullCount,
      status: mismatchAfter === 0 && nullCount === 0 ? '✅ FULLY COMPLIANT' : '⚠️  PARTIAL (see details)'
    }, null, 2));
    process.exit(0);
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error fixing ticket groups:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
