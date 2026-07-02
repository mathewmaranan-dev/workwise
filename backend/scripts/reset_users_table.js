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
  { firstName: 'Pennie', lastName: 'Eldredge', assignmentGroupId: 1 },
  { firstName: 'Lidia', lastName: 'Wrennall', assignmentGroupId: 4 },
  { firstName: 'Werner', lastName: 'Kettlesting', assignmentGroupId: 3 },
  { firstName: 'Erena', lastName: 'Benezet', assignmentGroupId: 3 },
  { firstName: 'Jakob', lastName: 'Fleisch', assignmentGroupId: 2 },
  { firstName: 'Debee', lastName: 'Fatharly', assignmentGroupId: 2 },
  { firstName: 'Loren', lastName: 'Isakovitch', assignmentGroupId: 4 },
  { firstName: 'Normand', lastName: 'Entwisle', assignmentGroupId: 3 },
  { firstName: 'Dino', lastName: "O'Culligan", assignmentGroupId: 4 },
  { firstName: 'Toni', lastName: 'Colcomb', assignmentGroupId: 2 },
  { firstName: 'Mathew', lastName: 'Maranan', assignmentGroupId: 5 },
  { firstName: 'Jorge Jesse', lastName: 'Cabinian', assignmentGroupId: 5 },
  { firstName: 'Jacob Riley', lastName: 'Fernandez', assignmentGroupId: 5 },
  { firstName: 'Matthew Nicolai', lastName: 'Competente', assignmentGroupId: 5 },
  { firstName: 'Network', lastName: 'Manager', assignmentGroupId: 2, roleId: 2 },
  { firstName: 'Security', lastName: 'Manager', assignmentGroupId: 3, roleId: 2 },
  { firstName: 'Hardware', lastName: 'Manager', assignmentGroupId: 4, roleId: 2 },
  { firstName: 'Service Desk', lastName: 'Manager', assignmentGroupId: 5, roleId: 2 },
];

function sanitizeEmailName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s']/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function capitalizeName(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeForPasswordPart(value) {
  return String(value || '')
    .trim()
    .split(/[\s'-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
}

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

  const idFormatted = String(userId).padStart(5, '0');
  return `${normalizeForPasswordPart(firstName)}.${normalizeForPasswordPart(lastName)}${idFormatted}`;
}

function generateEmail(firstName, lastName, userId, isDefault) {
  if (isDefault) {
    return `${firstName.toLowerCase()}@workwise.it.com`;
  }

  const idFormatted = String(userId).padStart(5, '0');
  const localPart = `${sanitizeEmailName(firstName)}.${sanitizeEmailName(lastName)}${idFormatted}`;
  return `${localPart}@workwise.it.com`;
}

async function resetUsersTable() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting users table reset...\n');

    const tableExistsResult = await client.query(`
      SELECT to_regclass('public.users') AS table_name
    `);
    const usersTableExists = tableExistsResult.rows[0].table_name !== null;

    if (!usersTableExists) {
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
    } else {
      console.log('🧹 Truncating existing users table and resetting user_id sequence...');
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      console.log('✅ Users table truncated and sequence reset\n');
    }

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
      const roleId = Number(user.roleId || 3);

      await client.query(
        `INSERT INTO users (user_id, first_name, last_name, email, password_hash, role_id, assignment_group_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, user.firstName, user.lastName, email, hashedPassword, roleId, user.assignmentGroupId]
      );

      console.log(`  ${userId}. ${user.firstName} ${user.lastName}`);
      console.log(`     Email: ${email}`);
      console.log(`     Password: ${password}\n`);
      userId++;
    }

    // Verify results
    await client.query(`SELECT setval(pg_get_serial_sequence('users','user_id'), (SELECT COALESCE(MAX(user_id), 0) FROM users))`);
    const result = await client.query(
      'SELECT COUNT(*) AS total, MAX(user_id) AS max_id FROM users'
    );
    
    console.log('\n✅ Users table reset complete!');
    console.log(`📊 Total users: ${result.rows[0].total}`);
    console.log(`📍 Max user_id: ${result.rows[0].max_id}`);
    console.log('\n📝 Naming Convention:');
    console.log('   - Default users: [FirstName]@workwise.it.com');
    console.log('   - Employees: firstname.lastname{user_id} (e.g., laura.diaz00005@workwise.it.com)');
    console.log('   - Employee passwords: NormalizedFirst.NormalizedLast{user_id} (e.g., JorgeJesse.Cabinian00023)');
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
