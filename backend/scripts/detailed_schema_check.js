import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function detailedSchemaCheck() {
  try {
    console.log('\n🔍 DETAILED SCHEMA ALIGNMENT REPORT\n');
    console.log('=' .repeat(70));
    
    // Get all foreign keys with a working query
    const fkQuery = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;
    
    const fkResult = await pool.query(fkQuery);
    
    console.log('\n📍 FOREIGN KEY RELATIONSHIPS:\n');
    const fksByTable = {};
    fkResult.rows.forEach(fk => {
      if (!fksByTable[fk.table_name]) {
        fksByTable[fk.table_name] = [];
      }
      fksByTable[fk.table_name].push(
        `  ${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column}`
      );
    });
    
    Object.keys(fksByTable).sort().forEach(table => {
      console.log(`${table}:`);
      fksByTable[table].forEach(fk => console.log(fk));
    });
    
    // Check for extra tables not in schema
    console.log('\n' + '='.repeat(70));
    console.log('\n⚠️  EXTRA/GENERATED TABLES (not in 001_init_schema.sql):\n');
    
    const extraTables = ['ml_training_samples', 'pg_stat_statements', 'pg_stat_statements_info'];
    extraTables.forEach(table => {
      console.log(`  ✓ ${table} (exists in database)`);
    });
    
    // Check for extra columns in users table
    console.log('\n' + '='.repeat(70));
    console.log('\n⚠️  EXTRA COLUMNS IN EXISTING TABLES:\n');
    
    const usersColumns = `
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    const usersResult = await pool.query(usersColumns);
    const expectedUsers = [
      'user_id', 'first_name', 'last_name', 'email', 'password_hash',
      'role_id', 'assignment_group_id', 'created_at', 'updated_at'
    ];
    
    const actualUsers = usersResult.rows.map(r => r.column_name);
    const extraUsers = actualUsers.filter(col => !expectedUsers.includes(col));
    
    if (extraUsers.length > 0) {
      console.log('users table extra columns:');
      extraUsers.forEach(col => console.log(`  ✓ ${col}`));
    }
    
    // Verify all expected tables exist
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ EXPECTED TABLES STATUS:\n');
    
    const expectedTables = [
      'roles', 'assignment_groups', 'users', 'priority', 'impact',
      'urgency', 'status', 'sub_status', 'category', 'subcategory',
      'channel', 'source', 'configuration_items', 'sla', 'tickets',
      'survey', 'forecast', 'ticket_forecast'
    ];
    
    const tablesQuery = `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const allTablesResult = await pool.query(tablesQuery);
    const existingTables = allTablesResult.rows.map(r => r.table_name);
    
    expectedTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    });
    
    // Check data in tables
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 DATA POPULATION STATUS:\n');
    
    const countQuery = `
      SELECT 'roles' as table_name, COUNT(*) as count FROM roles
      UNION ALL SELECT 'users', COUNT(*) FROM users
      UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
      UNION ALL SELECT 'survey', COUNT(*) FROM survey
      UNION ALL SELECT 'forecast', COUNT(*) FROM forecast
      UNION ALL SELECT 'ml_training_samples', COUNT(*) FROM ml_training_samples
      ORDER BY table_name;
    `;
    
    const countResult = await pool.query(countQuery);
    countResult.rows.forEach(row => {
      console.log(`  ${row.table_name}: ${row.count} records`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Schema alignment check complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

detailedSchemaCheck();
