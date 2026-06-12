import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function checkSchema() {
  try {
    console.log('\n📋 DATABASE SCHEMA VERIFICATION\n');
    
    // 1. Check existing tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log('✅ EXISTING TABLES:');
    console.log(tablesResult.rows.map(r => '  - ' + r.table_name).join('\n'));
    
    // 2. Check columns for each table
    console.log('\n✅ TABLE STRUCTURES:\n');
    
    for (const table of tablesResult.rows) {
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await pool.query(columnsQuery, [table.table_name]);
      console.log(`${table.table_name}:`);
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name} ${col.data_type} ${nullable}${defaultVal}`);
      });
      console.log('');
    }
    
    // 3. Check indexes
    console.log('✅ INDEXES:\n');
    const indexQuery = `
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    
    const indexResult = await pool.query(indexQuery);
    indexResult.rows.forEach(idx => {
      console.log(`  ${idx.indexname} on ${idx.tablename}`);
    });
    
    // 4. Check constraints
    console.log('\n✅ FOREIGN KEYS:\n');
    const fkQuery = `
      SELECT 
        constraint_name,
        table_name,
        column_name,
        referenced_table_name,
        referenced_column_name
      FROM information_schema.key_column_usage
      WHERE table_schema = 'public' AND referenced_table_name IS NOT NULL
      ORDER BY table_name;
    `;
    
    const fkResult = await pool.query(fkQuery);
    fkResult.rows.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.referenced_table_name}.${fk.referenced_column_name}`);
    });
    
    console.log('\n✅ Schema check complete!\n');
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
