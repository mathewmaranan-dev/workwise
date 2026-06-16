const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');

    // Find all tickets assigned to non-role-3 users
    const badTicketsRes = await pool.query(`
      SELECT
        t.ticket_id,
        t.assignment_group_id AS ticket_group,
        t.assigned_to_id AS current_assigned_to,
        u.role_id AS current_role_id
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to_id = u.user_id
      WHERE t.assigned_to_id IS NULL
         OR u.role_id IS DISTINCT FROM 3
      ORDER BY t.assignment_group_id, t.ticket_id
    `);

    if (!badTicketsRes.rows.length) {
      console.log('✅ No tickets assigned to non-role-3 users. All tickets are compliant.');
      await pool.query('ROLLBACK');
      process.exit(0);
    }

    const badTickets = badTicketsRes.rows;
    console.log(`Found ${badTickets.length} ticket(s) assigned to non-role-3 users:`);
    console.log(JSON.stringify(badTickets, null, 2));

    // For each bad ticket, find an available role-3 agent in the same assignment group
    const updates = [];
    for (const ticket of badTickets) {
      const groupId = ticket.ticket_group;
      
      // Get available agents in this group (role_id = 3)
      const agentsRes = await pool.query(
        `SELECT user_id FROM users WHERE role_id = 3 AND assignment_group_id = $1 ORDER BY user_id LIMIT 1`,
        [groupId]
      );

      if (agentsRes.rows.length === 0) {
        console.warn(`⚠️  No role-3 agents available in group ${groupId} for ticket ${ticket.ticket_id}`);
        continue;
      }

      const newAgentId = agentsRes.rows[0].user_id;
      updates.push({
        ticket_id: ticket.ticket_id,
        old_assigned_to: ticket.current_assigned_to,
        new_assigned_to: newAgentId,
        assignment_group_id: groupId
      });
    }

    // Apply all updates
    for (const upd of updates) {
      await pool.query(
        'UPDATE tickets SET assigned_to_id = $1, updated_at = NOW() WHERE ticket_id = $2',
        [upd.new_assigned_to, upd.ticket_id]
      );
    }

    await pool.query('COMMIT');

    console.log(`\n✅ Reassigned ${updates.length} ticket(s):`);
    console.log(JSON.stringify(updates, null, 2));
    process.exit(0);
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error reassigning bad tickets:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
