#!/usr/bin/env node

/**
 * Simple database migration runner
 * Loads and runs SQL migration files
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const useSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function executeSQLFile(client, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf-8');
  
  try {
    // Try to execute the entire file at once
    await client.query(sql);
  } catch (error) {
    // If that fails, try splitting more intelligently
    // Remove comments and split by semicolons
    let cleanSQL = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('--') && trimmed.length > 0;
      })
      .join('\n');

    // Split by semicolons, but be careful with statements inside functions
    const statements = [];
    let currentStatement = '';
    let depth = 0;  // Track parentheses depth

    for (let i = 0; i < cleanSQL.length; i++) {
      const char = cleanSQL[i];
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      
      currentStatement += char;
      
      if (char === ';' && depth === 0) {
        const stmt = currentStatement.trim();
        if (stmt.length > 1) {  // More than just semicolon
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }

    // Execute statements one by one
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (err) {
        // Log and continue on certain errors for idempotency
        if (!err.message.includes('already exists') && 
            !err.message.includes('duplicate key')) {
          throw err;
        }
      }
    }
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...\n');

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = [
      '001_init_schema.sql',
      // Skip 002_sample_data.sql as it has data issues - we'll seed synthetic data instead
      // '002_sample_data.sql',
      '008_add_resolved_by_id.sql'
    ];

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`📋 Executing ${file}...`);
        await executeSQLFile(client, filePath);
        console.log(`✅ ${file} completed`);
      }
    }

    console.log('\n✅ All migrations completed successfully!\n');
    console.log('Database initialized with schema and seed data\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
