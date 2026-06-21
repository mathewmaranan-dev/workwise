const pg = require('pg');
require('dotenv').config();
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(
  'SELECT DATE(created_date) as date, COUNT(*) as count FROM tickets WHERE created_date >= NOW() - INTERVAL \'90 days\' GROUP BY DATE(created_date) ORDER BY date DESC LIMIT 25;',
  (err, result) => {
    if (err) console.error('Query error:', err);
    else {
      console.log('Recent 25 days (newest first):');
      result.rows.forEach(r => console.log(`  ${r.date}: ${r.count} tickets`));
    }
    pool.end();
  }
);
