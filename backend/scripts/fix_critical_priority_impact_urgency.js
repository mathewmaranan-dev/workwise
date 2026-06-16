#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function fixCriticalValues() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const highPriorityId = (await client.query("SELECT priority_id FROM priority WHERE priority_level='High' LIMIT 1")).rows[0]?.priority_id;
    const highImpactId = (await client.query("SELECT impact_id FROM impact WHERE impact_level='High' LIMIT 1")).rows[0]?.impact_id;
    const highUrgencyId = (await client.query("SELECT urgency_id FROM urgency WHERE urgency_level='High' LIMIT 1")).rows[0]?.urgency_id;

    if (!highPriorityId || !highImpactId || !highUrgencyId) {
      throw new Error('Required High lookup values are missing. Seed lookup tables first.');
    }

    console.log('Fixing tickets with Critical priority/impact/urgency (id=43)...');

    const updateResults = [];
    updateResults.push(await client.query('UPDATE tickets SET priority_id=$1 WHERE priority_id=43', [highPriorityId]));
    updateResults.push(await client.query('UPDATE tickets SET impact_id=$1 WHERE impact_id=43', [highImpactId]));
    updateResults.push(await client.query('UPDATE tickets SET urgency_id=$1 WHERE urgency_id=43', [highUrgencyId]));

    await client.query('DELETE FROM priority WHERE priority_id=43');
    await client.query('DELETE FROM impact WHERE impact_id=43');
    await client.query('DELETE FROM urgency WHERE urgency_id=43');

    await client.query('COMMIT');

    console.log('\n✅ Fixed tickets:');
    console.log(`  priority updated: ${updateResults[0].rowCount}`);
    console.log(`  impact updated: ${updateResults[1].rowCount}`);
    console.log(`  urgency updated: ${updateResults[2].rowCount}`);
    console.log('✅ Removed Critical lookup rows from priority, impact, and urgency');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to fix Critical values:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCriticalValues();
