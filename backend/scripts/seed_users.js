#!/usr/bin/env node

/**
 * Seed users table with sample data
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const saltRounds = 10;

async function seedUsers() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding users...\n');

    // First, ensure roles exist
    const adminRole = await client.query('SELECT role_id FROM roles WHERE role_name = $1', ['admin']);
    const agentRole = await client.query('SELECT role_id FROM roles WHERE role_name = $1', ['agent']);
    const userRole = await client.query('SELECT role_id FROM roles WHERE role_name = $1', ['user']);
    
    const adminRoleId = adminRole.rows[0]?.role_id || 1;
    const agentRoleId = agentRole.rows[0]?.role_id || 3;
    const userRoleId = userRole.rows[0]?.role_id || 4;

    // Get assignment groups
    const groupsRes = await client.query('SELECT assignment_group_id FROM assignment_groups ORDER BY assignment_group_id');
    const groupIds = groupsRes.rows.map(r => r.assignment_group_id);

    // Default password: Password123!
    const defaultPasswordHash = await bcrypt.hash('Password123!', saltRounds);

    // Admin users
    const adminUsers = [
      { firstName: 'Admin', lastName: 'User', email: 'admin@workwise.local', roleId: adminRoleId, groupId: null }
    ];

    // Agent users (support staff assigned to groups)
    const agentUsers = [
      { firstName: 'Laura', lastName: 'Diaz', email: 'laura.diaz@workwise.local', roleId: agentRoleId, groupId: groupIds[0] || 1 },
      { firstName: 'Ulises', lastName: 'Gomez', email: 'ulises.gomez@workwise.local', roleId: agentRoleId, groupId: groupIds[1] || 2 },
      { firstName: 'Alice', lastName: 'Mendoza', email: 'alice.mendoza@workwise.local', roleId: agentRoleId, groupId: groupIds[2] || 3 },
      { firstName: 'Teresa', lastName: 'Herrera', email: 'teresa.herrera@workwise.local', roleId: agentRoleId, groupId: groupIds[1] || 2 },
      { firstName: 'Kevin', lastName: 'Ramos', email: 'kevin.ramos@workwise.local', roleId: agentRoleId, groupId: groupIds[0] || 1 },
      { firstName: 'Quentin', lastName: 'De Leon', email: 'quentin.deleon@workwise.local', roleId: agentRoleId, groupId: groupIds[3] || 4 },
      { firstName: 'Mark', lastName: 'Castillo', email: 'mark.castillo@workwise.local', roleId: agentRoleId, groupId: groupIds[0] || 1 },
      { firstName: 'Pennie', lastName: 'Eldredge', email: 'pennie.eldredge@workwise.local', roleId: agentRoleId, groupId: groupIds[0] || 1 },
      { firstName: 'Lidia', lastName: 'Wrennall', email: 'lidia.wrennall@workwise.local', roleId: agentRoleId, groupId: groupIds[3] || 4 },
      { firstName: 'Werner', lastName: 'Kettlesting', email: 'werner.kettlesting@workwise.local', roleId: agentRoleId, groupId: groupIds[2] || 3 },
      { firstName: 'Erena', lastName: 'Benezet', email: 'erena.benezet@workwise.local', roleId: agentRoleId, groupId: groupIds[2] || 3 },
      { firstName: 'Jakob', lastName: 'Fleisch', email: 'jakob.fleisch@workwise.local', roleId: agentRoleId, groupId: groupIds[1] || 2 },
      { firstName: 'Debee', lastName: 'Fatharly', email: 'debee.fatharly@workwise.local', roleId: agentRoleId, groupId: groupIds[1] || 2 },
      { firstName: 'Loren', lastName: 'Isakovitch', email: 'loren.isakovitch@workwise.local', roleId: agentRoleId, groupId: groupIds[3] || 4 },
      { firstName: 'Normand', lastName: 'Entwisle', email: 'normand.entwisle@workwise.local', roleId: agentRoleId, groupId: groupIds[2] || 3 },
      { firstName: 'Dino', lastName: "O'Culligan", email: 'dino.oculligan@workwise.local', roleId: agentRoleId, groupId: groupIds[3] || 4 },
      { firstName: 'Toni', lastName: 'Colcomb', email: 'toni.colcomb@workwise.local', roleId: agentRoleId, groupId: groupIds[1] || 2 },
      { firstName: 'Mathew', lastName: 'Maranan', email: 'mathew.maranan@workwise.local', roleId: agentRoleId, groupId: groupIds[4] || 5 }
    ];

    // End users (ticket requesters)
    const endUsers = [
      { firstName: 'John', lastName: 'Smith', email: 'john.smith@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Robert', lastName: 'Wilson', email: 'robert.wilson@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Jessica', lastName: 'Moore', email: 'jessica.moore@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'David', lastName: 'Taylor', email: 'david.taylor@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Linda', lastName: 'Anderson', email: 'linda.anderson@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'James', lastName: 'Thomas', email: 'james.thomas@company.local', roleId: userRoleId, groupId: null },
      { firstName: 'Patricia', lastName: 'Jackson', email: 'patricia.jackson@company.local', roleId: userRoleId, groupId: null }
    ];

    const allUsers = [...adminUsers, ...agentUsers, ...endUsers];

    let inserted = 0;
    for (const user of allUsers) {
      try {
        const result = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO NOTHING
           RETURNING user_id`,
          [user.firstName, user.lastName, user.email, defaultPasswordHash, user.roleId, user.groupId || null]
        );
        if (result.rows.length > 0) {
          inserted++;
        }
      } catch (error) {
        console.error(`Error inserting user ${user.email}:`, error.message);
      }
    }

    console.log(`✅ Inserted ${inserted} users\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers();
