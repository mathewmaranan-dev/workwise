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
 * Generate password based on user naming convention
 * Default users: Admin!23, Manager!23, HR!23, Agent!23
 * Other users: FirstName.LastName{user_id} (e.g., Laura.Diaz00001)
 */
function normalizeEmailName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.\-]/g, '');
}

function generateEmail(firstName, lastName, userId, email) {
  const defaultEmails = new Set([
    'admin@workwise.it.com',
    'manager@workwise.it.com',
    'hr@workwise.it.com',
    'agent@workwise.it.com',
  ]);

  if (defaultEmails.has(email)) {
    return email;
  }

  const idFormatted = String(userId).padStart(5, '0');
  const localPart = `${normalizeEmailName(firstName)}.${normalizeEmailName(lastName)}${idFormatted}`;
  return `${localPart}@workwise.it.com`;
}

function generatePassword(firstName, lastName, email, userId) {
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
  return `${firstName}.${lastName}${idFormatted}`;
}

async function fixAllPasswords() {
  const client = await pool.connect();
  try {
    console.log('🔄 Fetching all users from database...');
    
    const result = await client.query(
      'SELECT user_id, first_name, last_name, email FROM users ORDER BY user_id'
    );

    const users = result.rows;
    console.log(`📋 Found ${users.length} users to update\n`);

    let updatedCount = 0;

    for (const user of users) {
      const password = generatePassword(
        user.first_name,
        user.last_name,
        user.email,
        user.user_id
      );
      const email = generateEmail(
        user.first_name,
        user.last_name,
        user.user_id,
        user.email
      );

      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query(
        'UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE user_id = $3',
        [email, hashedPassword, user.user_id]
      );

      console.log(`✅ Updated user_id=${user.user_id}:`);
      console.log(`   email: ${user.email} -> ${email}`);
      console.log(`   password: ${password}`);
      console.log(`   hash: ${hashedPassword}\n`);

      updatedCount++;
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} user passwords!`);
    console.log('\n📝 Password Convention:');
    console.log('   - Default users: [Role]!23 (Admin!23, Manager!23, HR!23, Agent!23)');
    console.log('   - Other users: FirstName.LastName{user_id} (e.g., Laura.Diaz00001)');

  } catch (error) {
    console.error('❌ Error updating passwords:', error);
    throw error;
  } finally {
    await client.end();
  }
}

fixAllPasswords().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
