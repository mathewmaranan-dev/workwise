const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined });
  const shifts = ['Morning', 'Afternoon', 'Night'];
  try {
    // Get all assignment groups that have at least one agent
    const groupsRes = await pool.query(`
      SELECT DISTINCT u.assignment_group_id AS gid
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE r.role_name = 'agent' AND u.assignment_group_id IS NOT NULL
      ORDER BY u.assignment_group_id
    `);

    // Default exclusion patterns: admin@workwise (prefix), emails starting with agent, hr, manager
    const excludeRegex = /^(?:admin@workwise|agent|hr|manager)/i;

    for (const row of groupsRes.rows) {
      const gid = row.gid;
      console.log(`Processing group ${gid}`);

      // Count existing assigned agents per shift in this group (exclude default users)
      const countsRes = await pool.query(
        `SELECT u.shift, COUNT(*) AS cnt
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE r.role_name = 'agent' AND u.assignment_group_id = $1 AND u.shift IS NOT NULL
         GROUP BY u.shift`,
        [gid]
      );

      const counts = Object.fromEntries(shifts.map((s) => [s, 0]));
      for (const c of countsRes.rows) {
        if (c.shift && counts.hasOwnProperty(c.shift)) counts[c.shift] = Number(c.cnt || 0);
      }

      // Get target users with NULL shift, excluding default emails
      const usersRes = await pool.query(
        `SELECT u.user_id, u.email
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE r.role_name = 'agent' AND u.assignment_group_id = $1 AND (u.shift IS NULL OR u.shift = '')
         ORDER BY u.user_id`,
        [gid]
      );

      const users = usersRes.rows.filter((r) => !excludeRegex.test(String(r.email || '')));
      if (users.length === 0) {
        console.log(`No eligible users with null shift for group ${gid}, skipping.`);
        continue;
      }

      // Assign each user to the shift with the currently smallest count (balanced)
      for (const u of users) {
        // find shift with min count
        let minShift = shifts[0];
        for (const s of shifts) {
          if (counts[s] < counts[minShift]) minShift = s;
        }
        await pool.query('UPDATE users SET shift = $1 WHERE user_id = $2', [minShift, u.user_id]);
        counts[minShift] += 1;
      }

      console.log(`Assigned ${users.length} users across shifts for group ${gid}. Final counts: ${JSON.stringify(counts)}`);
    }

    // Handle agents without an assignment group (null group) as a global bucket
    console.log('Processing unassigned agents (no assignment group)');

    const countsResUngrouped = await pool.query(
      `SELECT u.shift, COUNT(*) AS cnt
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'agent' AND u.assignment_group_id IS NULL AND u.shift IS NOT NULL
       GROUP BY u.shift`
    );
    const unCounts = Object.fromEntries(shifts.map((s) => [s, 0]));
    for (const c of countsResUngrouped.rows) {
      if (c.shift && unCounts.hasOwnProperty(c.shift)) unCounts[c.shift] = Number(c.cnt || 0);
    }

    const ungroupedUsersRes = await pool.query(
      `SELECT u.user_id, u.email
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'agent' AND u.assignment_group_id IS NULL AND (u.shift IS NULL OR u.shift = '')
       ORDER BY u.user_id`
    );
    const ungroupedUsers = ungroupedUsersRes.rows.filter((r) => !excludeRegex.test(String(r.email || '')));
    if (ungroupedUsers.length === 0) {
      console.log('No eligible unassigned agents with null shift.');
    } else {
      for (const u of ungroupedUsers) {
        let minShift = shifts[0];
        for (const s of shifts) {
          if (unCounts[s] < unCounts[minShift]) minShift = s;
        }
        await pool.query('UPDATE users SET shift = $1 WHERE user_id = $2', [minShift, u.user_id]);
        unCounts[minShift] += 1;
      }
      console.log(`Assigned ${ungroupedUsers.length} unassigned agents across shifts. Final counts: ${JSON.stringify(unCounts)}`);
    }

    console.log('Shift assignment complete.');
  } catch (err) {
    console.error('Error assigning shifts:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

