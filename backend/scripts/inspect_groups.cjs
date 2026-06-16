const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const groupsRes = await pool.query('SELECT assignment_group_id, group_name FROM assignment_groups ORDER BY assignment_group_id');
    const agentRoleRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'agent'");
    const agentRoleId = agentRoleRes.rows[0] && agentRoleRes.rows[0].role_id;

    const groupCounts = [];
    for (const g of groupsRes.rows) {
      const usersRes = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE role_id = $1 AND assignment_group_id = $2', [agentRoleId, g.assignment_group_id]);
      const ticketsRes = await pool.query('SELECT COUNT(*) AS cnt FROM tickets WHERE assignment_group_id = $1', [g.assignment_group_id]);
      groupCounts.push({
        assignment_group_id: g.assignment_group_id,
        group_name: g.group_name,
        agent_count: Number(usersRes.rows[0].cnt),
        ticket_count: Number(ticketsRes.rows[0].cnt),
      });
    }

    const totalAgentsRes = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE role_id = $1', [agentRoleId]);
    const totalTicketsRes = await pool.query('SELECT COUNT(*) AS cnt FROM tickets');

    const out = { groups: groupCounts, total_agents: Number(totalAgentsRes.rows[0].cnt), total_tickets: Number(totalTicketsRes.rows[0].cnt) };
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error inspecting groups:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
