#!/usr/bin/env node

/**
 * Simple database migration runner
 * Run this script to initialize the database schema and sample data
 *
 * Usage:
 * node migrations/run-simple.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection config
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'workwise',
  password: 'workwise_dev',
  database: 'workwise_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🔄 Running migrations...\n');

    // Test connection
    await query('SELECT NOW()');
    console.log('✅ Database connected successfully!\n');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, '001_init_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('📋 Executing schema migration...');
    await query(schema);

    // Read and execute the sample data file
    const sampleDataPath = path.join(__dirname, '002_sample_data.sql');
    if (fs.existsSync(sampleDataPath)) {
      const sampleData = fs.readFileSync(sampleDataPath, 'utf-8');
      console.log('📊 Executing sample data migration...');
      await query(sampleData);
    }

    console.log('✅ Migrations completed successfully!\n');
    console.log('Database initialized with:');
    console.log('  - Complete schema (18 tables)');
    console.log('  - Seed data (users, lookup tables)');
    console.log('  - Sample tickets with business logic');
    console.log('  - Survey responses\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();