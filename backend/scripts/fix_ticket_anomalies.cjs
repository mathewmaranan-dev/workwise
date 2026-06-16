#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const DRY = !argv.includes('--apply'); // default: dry-run; use --apply to commit
const outDir = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const PLAN_CSV = path.join(outDir, DRY ? 'fix_plan_dryrun.csv' : 'fix_plan_applied.csv');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log(DRY ? 'DRY RUN — no changes will be committed' : 'APPLY MODE — changes will be committed');
    await client.query('BEGIN');

    const planLines = [['ticket_id','issue','old_value','new_value','action']];

    // 1) resolved_in_future -> set resolved_date = NOW()
    const q1 = `
      WITH sel AS (
        SELECT ticket_id, resolved_date
        FROM tickets
        WHERE resolved_date > NOW()
        FOR UPDATE
      )
      UPDATE tickets t
      SET resolved_date = NOW(), updated_at = NOW()
      FROM sel
      WHERE t.ticket_id = sel.ticket_id
      RETURNING t.ticket_id, sel.resolved_date AS old_resolved, t.resolved_date AS new_resolved
    `;
    const r1 = await client.query(q1);
    for (const row of r1.rows) {
      planLines.push([row.ticket_id, 'resolved_in_future', row.old_resolved ? row.old_resolved.toISOString() : '', row.new_resolved ? row.new_resolved.toISOString() : '', DRY ? 'would_set_resolved_to_now' : 'set_resolved_to_now']);
    }

    // 2) resolved_but_no_closed_by -> set closed_by_id = assigned_to_id when present
    const q2 = `
      WITH sel AS (
        SELECT ticket_id, assigned_to_id
        FROM tickets
        WHERE resolved_date IS NOT NULL AND closed_by_id IS NULL AND assigned_to_id IS NOT NULL
        FOR UPDATE
      )
      UPDATE tickets t
      SET closed_by_id = sel.assigned_to_id, updated_at = NOW()
      FROM sel
      WHERE t.ticket_id = sel.ticket_id
      RETURNING t.ticket_id, sel.assigned_to_id as old_assigned_to, t.closed_by_id as new_closed_by
    `;
    const r2 = await client.query(q2);
    for (const row of r2.rows) {
      planLines.push([row.ticket_id, 'resolved_but_no_closed_by', row.old_assigned_to || '', row.new_closed_by || '', DRY ? 'would_set_closed_by_to_assigned' : 'set_closed_by_to_assigned']);
    }

    // 3) created_after_resolved -> set resolved_date = created_date + interval '1 minute'
    const q3 = `
      WITH sel AS (
        SELECT ticket_id, created_date, resolved_date
        FROM tickets
        WHERE resolved_date IS NOT NULL AND created_date > resolved_date
        FOR UPDATE
      )
      UPDATE tickets t
      SET resolved_date = (sel.created_date + interval '1 minute'), updated_at = NOW()
      FROM sel
      WHERE t.ticket_id = sel.ticket_id
      RETURNING t.ticket_id, sel.resolved_date AS old_resolved, t.resolved_date AS new_resolved
    `;
    const r3 = await client.query(q3);
    for (const row of r3.rows) {
      planLines.push([row.ticket_id, 'created_after_resolved', row.old_resolved ? row.old_resolved.toISOString() : '', row.new_resolved ? row.new_resolved.toISOString() : '', DRY ? 'would_bump_resolved_after_created' : 'bumped_resolved_after_created']);
    }

    // 4) reopened_after_resolve -> set resolved_date = last_reopened_at + 1 minute
    const q4 = `
      WITH sel AS (
        SELECT ticket_id, last_reopened_at, resolved_date
        FROM tickets
        WHERE last_reopened_at IS NOT NULL AND resolved_date IS NOT NULL AND last_reopened_at > resolved_date
        FOR UPDATE
      )
      UPDATE tickets t
      SET resolved_date = (sel.last_reopened_at + interval '1 minute'), updated_at = NOW()
      FROM sel
      WHERE t.ticket_id = sel.ticket_id
      RETURNING t.ticket_id, sel.resolved_date AS old_resolved, t.resolved_date AS new_resolved, sel.last_reopened_at
    `;
    const r4 = await client.query(q4);
    for (const row of r4.rows) {
      planLines.push([row.ticket_id, 'reopened_after_resolve', row.old_resolved ? row.old_resolved.toISOString() : '', row.new_resolved ? row.new_resolved.toISOString() : '', DRY ? 'would_set_resolved_after_last_reopen' : 'set_resolved_after_last_reopen']);
    }

    // Write plan CSV
    const csv = planLines.map(r => r.map(c => csvEscape(c)).join(',')).join('\n');
    fs.writeFileSync(PLAN_CSV, csv);
    console.log(`Wrote plan CSV -> ${PLAN_CSV}`);

    if (DRY) {
      await client.query('ROLLBACK');
      console.log('DRY RUN complete — no changes committed. Review the plan CSV and run with --apply to commit.');
    } else {
      await client.query('COMMIT');
      console.log('Applied changes transactionally. Review the applied plan CSV.');
    }
  } catch (err) {
    console.error('ERROR', err);
    try { await client.query('ROLLBACK'); } catch (e) {}
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

if (require.main === module) main();
