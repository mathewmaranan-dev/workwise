import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

/**
 * Users to seed - with proper first/last name separation
 */
const defaultUsers = [
  { firstName: 'Default', lastName: 'Admin', email: 'admin@workwise.it.com', roleId: 1, assignmentGroupId: null },
  { firstName: 'Default', lastName: 'Manager', email: 'manager@workwise.it.com', roleId: 2, assignmentGroupId: 1 },
  { firstName: 'Default', lastName: 'HR', email: 'hr@workwise.it.com', roleId: 4, assignmentGroupId: null },
  { firstName: 'Default', lastName: 'Agent', email: 'agent@workwise.it.com', roleId: 3, assignmentGroupId: 3 },
];

const employeeUsers = [
  { firstName: 'Laura', lastName: 'Diaz', assignmentGroupId: 1 },
  { firstName: 'Ulises', lastName: 'Gomez', assignmentGroupId: 2 },
  { firstName: 'Alice', lastName: 'Mendoza', assignmentGroupId: 3 },
  { firstName: 'Teresa', lastName: 'Herrera', assignmentGroupId: 2 },
  { firstName: 'Kevin', lastName: 'Ramos', assignmentGroupId: 1 },
  { firstName: 'Quentin', lastName: 'De Leon', assignmentGroupId: 4 },
  { firstName: 'Mark', lastName: 'Castillo', assignmentGroupId: 1 },
  { firstName: 'Pennie', lastName: 'Eldredge', assignmentGroupId: null },
  { firstName: 'Lidia', lastName: 'Wrennall', assignmentGroupId: null },
  { firstName: 'Werner', lastName: 'Kettlesting', assignmentGroupId: null },
  { firstName: 'Erena', lastName: 'Benezet', assignmentGroupId: null },
  { firstName: 'Jakob', lastName: 'Fleisch', assignmentGroupId: null },
  { firstName: 'Debee', lastName: 'Fatharly', assignmentGroupId: null },
  { firstName: 'Loren', lastName: 'Isakovitch', assignmentGroupId: null },
  { firstName: 'Normand', lastName: 'Entwisle', assignmentGroupId: null },
  { firstName: 'Dino', lastName: "O'Culligan", assignmentGroupId: null },
  { firstName: 'Toni', lastName: 'Colcomb', assignmentGroupId: null },
  { firstName: 'Mathew', lastName: 'Maranan', assignmentGroupId: 1 },
];

function generatePassword(firstName, lastName, email, userId, isDefault) {
  const defaultUsers = {
    'admin@workwise.it.com': 'Admin!23',
    'manager@workwise.it.com': 'Manager!23',
    'hr@workwise.it.com': 'HR!23',
    'agent@workwise.it.com': 'Agent!23',
  };

  if (defaultUsers[email]) {
    return defaultUsers[email];
  }

  // For employees: FirstName.LastName{user_id}
  const idFormatted = String(userId).padStart(5, '0');
  return `${firstName}.${lastName}${idFormatted}`;
}

function normalizeEmailName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.\-']/g, '');
}

function generateEmail(firstName, lastName, userId, isDefault) {
  if (isDefault) {
    return `${firstName.toLowerCase()}@workwise.it.com`;
  }

  const idFormatted = String(userId).padStart(5, '0');
  const localPart = `${normalizeEmailName(firstName)}.${normalizeEmailName(lastName)}${idFormatted}`;
  return `${localPart}@workwise.it.com`;
}

async function resetUsersTable() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting users table reset...\n');

    // Drop existing users table
    console.log('🗑️  Dropping existing users table...');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('✅ Users table dropped\n');

    // Recreate users table
    console.log('📋 Creating users table with fresh schema...');
    await client.query(`
      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role_id INT NOT NULL DEFAULT 3 REFERENCES roles(role_id),
        assignment_group_id INT REFERENCES assignment_groups(assignment_group_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created\n');

    // Seed default users
    console.log('👤 Seeding default users...');
    let userId = 1;
    for (const user of defaultUsers) {
      const password = generatePassword(user.firstName, user.lastName, user.email, userId, true);
      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query(
        `INSERT INTO users (user_id, first_name, last_name, email, password_hash, role_id, assignment_group_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, user.firstName, user.lastName, user.email, hashedPassword, user.roleId, user.assignmentGroupId]
      );

      console.log(`  ${userId}. ${user.firstName} ${user.lastName}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Password: ${password}\n`);
      userId++;
    }

    // Seed employee users
    console.log('👥 Seeding employee users...');
    for (const user of employeeUsers) {
      const email = generateEmail(user.firstName, user.lastName, userId, false);
      const password = generatePassword(user.firstName, user.lastName, email, userId, false);
      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query(
        `INSERT INTO users (user_id, first_name, last_name, email, password_hash, role_id, assignment_group_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, user.firstName, user.lastName, email, hashedPassword, 3, user.assignmentGroupId]
      );

      console.log(`  ${userId}. ${user.firstName} ${user.lastName}`);
      console.log(`     Email: ${email}`);
      console.log(`     Password: ${password}\n`);
      userId++;
    }

    // Verify results
    const result = await client.query(
      'SELECT COUNT(*) AS total, MAX(user_id) AS max_id FROM users'
    );
    
    console.log('\n✅ Users table reset complete!');
    console.log(`📊 Total users: ${result.rows[0].total}`);
    console.log(`📍 Max user_id: ${result.rows[0].max_id}`);
    console.log('\n📝 Naming Convention:');
    console.log('   - Default users: [FirstName]@workwise.it.com');
    console.log('   - Employees: firstname.lastname{user_id} (e.g., laura.diaz00005@workwise.it.com)');
    console.log('   - Employee passwords: FirstName.LastName{user_id} (e.g., Laura.Diaz00005)');
    console.log('   - Default passwords: [Role]!23 (e.g., Admin!23, Manager!23)');

  } catch (error) {
    console.error('❌ Error resetting users table:', error);
    throw error;
  } finally {
    await client.end();
  }
}

resetUsersTable().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
