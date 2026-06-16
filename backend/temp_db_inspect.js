import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    const queries = [
      `SELECT 'priority' AS table_name, priority_id AS id, priority_level AS label FROM priority ORDER BY priority_id`,
      `SELECT 'impact' AS table_name, impact_id AS id, impact_level AS label FROM impact ORDER BY impact_id`,
      `SELECT 'urgency' AS table_name, urgency_id AS id, urgency_level AS label FROM urgency ORDER BY urgency_id`,
      `SELECT priority_id AS id, COUNT(*) AS count FROM tickets GROUP BY priority_id ORDER BY priority_id`,
      `SELECT impact_id AS id, COUNT(*) AS count FROM tickets GROUP BY impact_id ORDER BY impact_id`,
      `SELECT urgency_id AS id, COUNT(*) AS count FROM tickets GROUP BY urgency_id ORDER BY urgency_id`,
      `SELECT COUNT(*) AS tickets_with_43 FROM tickets WHERE priority_id=43 OR impact_id=43 OR urgency_id=43`,
      `SELECT COUNT(*) AS tickets_with_43_priority FROM tickets WHERE priority_id=43`,
      `SELECT COUNT(*) AS tickets_with_43_impact FROM tickets WHERE impact_id=43`,
      `SELECT COUNT(*) AS tickets_with_43_urgency FROM tickets WHERE urgency_id=43`,
      `SELECT COUNT(*) AS tickets_with_critical_priority FROM tickets WHERE priority_id IN (SELECT priority_id FROM priority WHERE priority_level='Critical')`,
      `SELECT COUNT(*) AS tickets_with_critical_impact FROM tickets WHERE impact_id IN (SELECT impact_id FROM impact WHERE impact_level='Critical')`,
      `SELECT COUNT(*) AS tickets_with_critical_urgency FROM tickets WHERE urgency_id IN (SELECT urgency_id FROM urgency WHERE urgency_level='Critical')`,
    ];

    for (const q of queries) {
      const res = await pool.query(q);
      console.log('--- QUERY:', q);
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
