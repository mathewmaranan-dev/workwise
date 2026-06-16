#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    res.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check categories
    const catRes = await pool.query('SELECT COUNT(*) FROM categories').catch(e => ({rows: [{count: 0}]}));
    console.log(`\nCategories count: ${catRes.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
