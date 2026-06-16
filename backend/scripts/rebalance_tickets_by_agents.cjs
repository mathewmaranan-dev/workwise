const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');

    // Get all groups and agent counts
    const groupsRes = await pool.query(`
      SELECT assignment_group_id, COUNT(*) AS agent_count
      FROM users
      WHERE role_id = 3
      GROUP BY assignment_group_id
      ORDER BY assignment_group_id
    `);
    const groups = groupsRes.rows.map(r => ({ id: r.assignment_group_id, agents: Number(r.agent_count) }));
    if (!groups.length) throw new Error('No groups with agents found');

    // Get total ticket count
    const totalRes = await pool.query('SELECT COUNT(*) AS cnt FROM tickets');
    const totalTickets = Number(totalRes.rows[0].cnt);

    // Calculate target tickets per agent
    const totalAgents = groups.reduce((sum, g) => sum + g.agents, 0);
    const ticketsPerAgent = Math.floor(totalTickets / totalAgents);

    // Calculate target for each group
    const groupTargets = {};
    let remaining = totalTickets;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const target = g.agents * ticketsPerAgent;
      groupTargets[g.id] = (i === groups.length - 1) ? remaining : target;
      remaining -= target;
    }

    console.log('Distribution Plan:');
    console.log(JSON.stringify({ 
      total_tickets: totalTickets, 
      total_agents: totalAgents,
      tickets_per_agent: ticketsPerAgent,
      group_targets: groups.map(g => ({
        group_id: g.id,
        agents: g.agents,
        target_tickets: groupTargets[g.id],
        tickets_per_agent: Math.floor(groupTargets[g.id] / g.agents)
      }))
    }, null, 2));

    // Create a temporary mapping table to hold new assignments
    await pool.query(`
      CREATE TEMP TABLE ticket_mapping AS
      WITH ranked_tickets AS (
        SELECT ticket_id, assignment_group_id,
               ROW_NUMBER() OVER (ORDER BY RANDOM()) AS rn
        FROM tickets
      )
      SELECT 
        ticket_id, 
        assignment_group_id AS old_group,
        CASE
          WHEN rn <= $1 THEN 1
          WHEN rn <= $2 THEN 2
          WHEN rn <= $3 THEN 3
          WHEN rn <= $4 THEN 4
          ELSE 5
        END AS new_group
      FROM ranked_tickets
    `, [groupTargets[1], groupTargets[1] + groupTargets[2], groupTargets[1] + groupTargets[2] + groupTargets[3], groupTargets[1] + groupTargets[2] + groupTargets[3] + groupTargets[4]]);

    // Perform bulk update
    const updateRes = await pool.query(`
      UPDATE tickets t
      SET assignment_group_id = tm.new_group, updated_at = NOW()
      FROM ticket_mapping tm
      WHERE t.ticket_id = tm.ticket_id
        AND t.assignment_group_id IS DISTINCT FROM tm.new_group
    `);
    const updateCount = updateRes.rowCount;

    await pool.query('COMMIT');

    console.log(`\n✅ Reassigned ${updateCount} ticket(s) for balanced distribution`);
    process.exit(0);
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error rebalancing tickets:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
