#!/usr/bin/env node

/**
 * Seed lookup tables with required data
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function seedLookupTables() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding lookup tables...\n');

    // Seed priority
    await client.query(`
      INSERT INTO priority (priority_level) 
      VALUES 
        ('High'),
        ('Medium'),
        ('Low')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Priority table seeded');

    // Seed impact
    await client.query(`
      INSERT INTO impact (impact_level)
      VALUES 
        ('High'),
        ('Medium'),
        ('Low')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Impact table seeded');

    // Seed urgency
    await client.query(`
      INSERT INTO urgency (urgency_level)
      VALUES 
        ('High'),
        ('Medium'),
        ('Low')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Urgency table seeded');

    // Seed status
    await client.query(`
      INSERT INTO status (status_name) 
      VALUES 
        ('New'),
        ('In Progress'),
        ('Resolved'),
        ('Closed'),
        ('On Hold'),
        ('Cancelled'),
        ('Pending')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Status table seeded');

    // Seed sub_status
    await client.query(`
      INSERT INTO sub_status (status_id, sub_status_name)
      SELECT status_id, 'Pending Customer Response' 
      FROM status WHERE status_name = 'Pending'
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Sub Status table seeded');

    // Seed categories
    const categories = [
      'Access Control',
      'Software',
      'Hardware',
      'Password',
      'Email',
      'Authentication',
      'Logging & Monitoring',
      'Server'
    ];

    for (const cat of categories) {
      await client.query(
        'INSERT INTO category (category_name) VALUES ($1) ON CONFLICT DO NOTHING',
        [cat]
      );
    }
    console.log('✅ Category table seeded');

    // Seed subcategories
    const subcategories = [
      { category: 'Access Control', names: ['Network Access', 'Application Access', 'File Share'] },
      { category: 'Software', names: ['Installation', 'Update', 'License', 'Crash'] },
      { category: 'Hardware', names: ['Desktop', 'Laptop', 'Printer', 'Monitor'] },
      { category: 'Password', names: ['Reset', 'Unlock', 'Expiration', 'Sync'] },
      { category: 'Email', names: ['Send/Receive', 'Synchronization', 'Attachment', 'Configuration'] },
      { category: 'Authentication', names: ['MFA', 'SSO', 'Login', 'Token'] },
      { category: 'Logging & Monitoring', names: ['Access Log', 'System Log', 'Alert', 'Report'] },
      { category: 'Server', names: ['CPU', 'Memory', 'Disk', 'Network'] }
    ];

    for (const { category, names } of subcategories) {
      const catRes = await client.query('SELECT category_id FROM category WHERE category_name = $1', [category]);
      if (catRes.rows.length > 0) {
        const categoryId = catRes.rows[0].category_id;
        for (const name of names) {
          await client.query(
            'INSERT INTO subcategory (category_id, subcategory_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [categoryId, name]
          );
        }
      }
    }
    console.log('✅ Subcategory table seeded');

    // Seed channels
    const channels = ['Phone', 'Email', 'Chat', 'Portal', 'In Person'];
    for (const ch of channels) {
      await client.query(
        'INSERT INTO channel (channel_name) VALUES ($1) ON CONFLICT DO NOTHING',
        [ch]
      );
    }
    console.log('✅ Channel table seeded');

    // Seed sources
    const sources = ['Phone', 'Email', 'Portal', 'API', 'Automation'];
    for (const src of sources) {
      await client.query(
        'INSERT INTO source (source_name) VALUES ($1) ON CONFLICT DO NOTHING',
        [src]
      );
    }
    console.log('✅ Source table seeded');

    // Seed roles
    await client.query(`
      INSERT INTO roles (role_name)
      VALUES 
        ('admin'),
        ('manager'),
        ('agent'),
        ('user'),
        ('hr')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Roles table seeded');

    // Seed assignment groups
    await client.query(`
      INSERT INTO assignment_groups (group_name)
      VALUES 
        ('Network Team'),
        ('Software Team'),
        ('Hardware Team'),
        ('Database Team'),
        ('Security Team')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Assignment Groups table seeded');

    // Seed SLA
    await client.query(`
      INSERT INTO sla (sla_name, sla_hours)
      VALUES 
        ('Critical SLA', 1),
        ('High SLA', 4),
        ('Standard SLA', 8),
        ('Low SLA', 24)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ SLA table seeded');

    // Seed configuration items
    const items = ['Laptop', 'Desktop', 'Server', 'Network', 'Database', 'Printer', 'Router', 'Switch'];
    for (const item of items) {
      await client.query(
        'INSERT INTO configuration_items (item_name) VALUES ($1) ON CONFLICT DO NOTHING',
        [item]
      );
    }
    console.log('✅ Configuration Items table seeded');

    console.log('\n✨ All lookup tables seeded successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding lookup tables:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedLookupTables();
