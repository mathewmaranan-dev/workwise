const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const TARGET_PER_GROUP = 25;
  try {
    await pool.query('BEGIN');

    const groupsRes = await pool.query('SELECT assignment_group_id FROM assignment_groups ORDER BY assignment_group_id');
    const groups = groupsRes.rows.map(r => r.assignment_group_id);
    if (!groups.length) throw new Error('No assignment groups found');

    const agentRoleRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'agent'");
    const agentRoleId = agentRoleRes.rows[0] && agentRoleRes.rows[0].role_id;
    if (!agentRoleId) throw new Error('No agent role found');

    const agentsRes = await pool.query('SELECT user_id, assignment_group_id FROM users WHERE role_id = $1 ORDER BY user_id', [agentRoleId]);
    const agents = agentsRes.rows;

    // Build current counts
    const counts = {};
    for (const g of groups) counts[g] = 0;
    for (const a of agents) {
      if (a.assignment_group_id && counts.hasOwnProperty(a.assignment_group_id)) counts[a.assignment_group_id]++;
    }

    // Determine assignment plan: fill each group up to TARGET_PER_GROUP, then distribute remainder round-robin
    const totalAgents = agents.length;
    const maxFill = TARGET_PER_GROUP * groups.length;
    const plan = {}; // group_id -> target_count
    for (const g of groups) plan[g] = Math.min(TARGET_PER_GROUP, totalAgents); // temp

    // More pragmatic: ensure each group aims for TARGET_PER_GROUP, but if not enough agents, distribute evenly
    const base = Math.floor(totalAgents / groups.length);
    let remainder = totalAgents % groups.length;
    for (const g of groups) {
      plan[g] = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
    }

    // Now create target assignment list (group ids repeated plan[g] times)
    const targetList = [];
    for (const g of groups) {
      for (let i = 0; i < plan[g]; i++) targetList.push(g);
    }

    // Map agents to target groups in order, but preserve users already in correct groups where possible
    const updates = [];
    let ti = 0;
    for (const a of agents) {
      const desiredGroup = targetList[ti++] || groups[groups.length - 1];
      if (a.assignment_group_id !== desiredGroup) {
        updates.push({ user_id: a.user_id, new_group: desiredGroup, old_group: a.assignment_group_id });
      }
    }

    // Apply updates
    for (const u of updates) {
      await pool.query('UPDATE users SET assignment_group_id = $1, updated_at = NOW() WHERE user_id = $2', [u.new_group, u.user_id]);
    }

    await pool.query('COMMIT');

    console.log(JSON.stringify({ total_agents: totalAgents, groups: groups.length, plan, updates_count: updates.length }, null, 2));
    if (updates.length) console.log('Updated users:', updates.slice(0, 50));
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error rebalancing agents:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
