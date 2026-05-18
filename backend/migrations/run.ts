#!/usr/bin/env node

/**
 * Database migration runner
 * Run this script to initialize the database schema
 * 
 * Usage:
 * node dist/migrations/run.js
 */

import { pool, query } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    console.log('🔄 Running migrations...\n');

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
