const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query(`SELECT u.user_id, u.email, u.first_name, u.last_name, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id ORDER BY u.user_id`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error listing users:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
