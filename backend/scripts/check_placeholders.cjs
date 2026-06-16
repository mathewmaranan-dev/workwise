const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query("SELECT user_id, email, password_hash, assignment_group_id FROM users WHERE email LIKE 'auto.agent.%' ORDER BY user_id");
    if (!res.rows.length) {
      console.log('No placeholder users found');
      process.exit(0);
    }
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error checking placeholders:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
