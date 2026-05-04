# Database Migrations

This directory contains database migration scripts for the Work-Wise ITSM system.

## Files

- `001_init_schema.sql` - Creates all 18 tables with relationships, indexes, and seed data
- `002_sample_data.sql` - Inserts 10 sample tickets with proper business logic
- `combined_migration.sql` - Combines both migrations for easy execution
- `run-simple.js` - Node.js script to run migrations (requires PostgreSQL running)
- `run.ts` - TypeScript migration runner (requires full backend setup)

## Business Logic Applied in Sample Data

The sample data follows these business rules:

### SLA Logic
- **Low Priority**: 4 days SLA
- **Medium Priority**: 2 days SLA
- **High Priority**: 24 hours SLA

### SLA Due Date
- Calculated from `created_date` based on priority level

### Resolved Date
- Only populated for tickets with status "Resolved" or "Closed"
- Must be later than `created_date`

### Made SLA
- `TRUE` if resolved within SLA due date
- Only has data for resolved/closed tickets

### Sub Status
- Only populated when status is "Pending"
- Example: "Pending Customer Response"

### FCR (First Contact Resolution)
- `FALSE` if `reopen_count > 0`
- `FALSE` if `assignment_group` is not "Service Desk"
- `TRUE` only when no reopens/reassignments AND assigned to Service Desk

### Last Reopened At
- Only has date when `reopen_count > 0`

## Running Migrations

### Option 1: Using Docker (Recommended)
```bash
# Start the database
docker compose up -d postgres

# Run migrations
cd backend
npm run migrate
```

### Option 2: Manual SQL Execution
```bash
# Connect to your PostgreSQL database and run:
psql -U workwise -d workwise_db -f migrations/combined_migration.sql
```

### Option 3: Using the Simple Runner
```bash
# Ensure PostgreSQL is running locally on port 5432
cd backend
node migrations/run-simple.js
```

## Sample Data Summary

The migration creates:
- 18 users across different roles
- Complete lookup tables (priorities, statuses, categories, etc.)
- 10 sample tickets with realistic ITSM scenarios
- Survey responses for resolved tickets

All data follows the business logic rules specified in your requirements.