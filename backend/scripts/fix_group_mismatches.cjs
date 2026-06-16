const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');

    // Count mismatches before
    const beforeRes = await pool.query(`
      SELECT COUNT(*) AS cnt FROM tickets t
      JOIN users u ON t.assigned_to_id = u.user_id
      WHERE t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
    `);
    const mismatchBefore = Number(beforeRes.rows[0].cnt);

    if (mismatchBefore === 0) {
      console.log('✅ No group mismatches found. All tickets are correctly assigned.');
      await pool.query('ROLLBACK');
      process.exit(0);
    }

    console.log(`Found ${mismatchBefore} ticket(s) with group mismatch`);

    // Create a mapping of first agent per group for reassignment
    const agentMapRes = await pool.query(`
      SELECT assignment_group_id, user_id
      FROM users
      WHERE role_id = 3
      ORDER BY assignment_group_id, user_id
    `);

    const agentMap = {};
    for (const row of agentMapRes.rows) {
      if (!agentMap[row.assignment_group_id]) {
        agentMap[row.assignment_group_id] = row.user_id;
      }
    }

    // Build a CASE statement for bulk update
    let caseStatement = 'CASE';
    for (const [groupId, agentId] of Object.entries(agentMap)) {
      caseStatement += ` WHEN t.assignment_group_id = ${groupId} THEN ${agentId}`;
    }
    caseStatement += ' END';

    // Bulk update all mismatches
    const updateRes = await pool.query(`
      UPDATE tickets t
      SET assigned_to_id = ${caseStatement}, updated_at = NOW()
      WHERE t.assigned_to_id IN (
        SELECT u.user_id FROM users u WHERE u.role_id = 3
      )
      AND t.assignment_group_id IN (
        SELECT u.assignment_group_id FROM users u 
        WHERE u.role_id = 3
        AND t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
      )
    `);

    // Better: use a subquery to find mismatches and reassign
    const betterUpdateRes = await pool.query(`
      UPDATE tickets t
      SET assigned_to_id = (
        SELECT user_id FROM users u 
        WHERE u.role_id = 3 
        AND u.assignment_group_id = t.assignment_group_id
        LIMIT 1
      ),
      updated_at = NOW()
      WHERE t.ticket_id IN (
        SELECT t2.ticket_id FROM tickets t2
        JOIN users u2 ON t2.assigned_to_id = u2.user_id
        WHERE t2.assignment_group_id IS DISTINCT FROM u2.assignment_group_id
      )
    `);
    const updateCount = betterUpdateRes.rowCount;

    // Count mismatches after
    const afterRes = await pool.query(`
      SELECT COUNT(*) AS cnt FROM tickets t
      JOIN users u ON t.assigned_to_id = u.user_id
      WHERE t.assignment_group_id IS DISTINCT FROM u.assignment_group_id
    `);
    const mismatchAfter = Number(afterRes.rows[0].cnt);

    await pool.query('COMMIT');

    console.log(`\n✅ Fixed mismatches: ${updateCount} tickets reassigned`);
    console.log(JSON.stringify({ mismatches_before: mismatchBefore, mismatches_after: mismatchAfter, status: mismatchAfter === 0 ? 'COMPLIANT' : 'PARTIAL' }, null, 2));
    process.exit(0);
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error fixing group mismatches:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
