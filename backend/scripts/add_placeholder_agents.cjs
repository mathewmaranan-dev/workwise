const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const TARGET_PER_GROUP = 5; // user requested total 25 agents -> 5 per group
  try {
    await pool.query('BEGIN');

    const groupsRes = await pool.query('SELECT assignment_group_id, group_name FROM assignment_groups ORDER BY assignment_group_id');
    const groups = groupsRes.rows;
    if (!groups.length) throw new Error('No assignment groups found');

    const agentRoleRes = await pool.query("SELECT role_id FROM roles WHERE role_name = 'agent'");
    const agentRoleId = agentRoleRes.rows[0] && agentRoleRes.rows[0].role_id;
    if (!agentRoleId) throw new Error('No agent role found');

    // Get current agent counts
    const counts = {};
    for (const g of groups) {
      const res = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE role_id = $1 AND assignment_group_id = $2', [agentRoleId, g.assignment_group_id]);
      counts[g.assignment_group_id] = Number(res.rows[0].cnt);
    }

    // Determine how many to add per group
    const toAdd = {};
    let totalToAdd = 0;
    for (const g of groups) {
      const need = Math.max(0, TARGET_PER_GROUP - counts[g.assignment_group_id]);
      toAdd[g.assignment_group_id] = need;
      totalToAdd += need;
    }

    if (totalToAdd === 0) {
      console.log('No placeholder agents needed; each group already has', TARGET_PER_GROUP);
      await pool.query('ROLLBACK');
      process.exit(0);
    }

    // Use a stable placeholder password hash (copied from seed data)
    const placeholderHash = '$2b$10$./LleYt0MHErGkhRaERoyeKb43CSBH05MjquLlrfkDM8WsB77hODK';

    const inserted = [];
    let counter = 1;
    for (const g of groups) {
      const gid = g.assignment_group_id;
      for (let i = 0; i < toAdd[gid]; i++) {
        const email = `auto.agent.${Date.now()}${counter}@workwise.app`;
        const first = 'Auto';
        const last = `Agent${gid}-${counter}`;
        const res = await pool.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING user_id, email, assignment_group_id`,
          [first, last, email, placeholderHash, agentRoleId, gid]
        );
        inserted.push(res.rows[0]);
        counter++;
      }
    }

    await pool.query('COMMIT');
    console.log('Inserted placeholder agents:', JSON.stringify(inserted, null, 2));
    process.exit(0);
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    console.error('Error inserting placeholder agents:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
