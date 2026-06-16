#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const outDir = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const OUT_CSV = path.join(outDir, 'ticket_anomalies.csv');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log('Connected (read-only) — detecting logical ticket anomalies');

    // Define cutoff dates
    const now = new Date();
    const juneStart = new Date('2026-06-01T00:00:00Z');
    const juneEnd = new Date('2026-06-30T23:59:59Z');

    const query = `
      SELECT t.ticket_id, t.created_date, t.resolved_date, t.last_reopened_at, t.reopen_count, t.reassignment_count,
        t.assigned_to_id, t.closed_by_id, t.assignment_group_id, t.sla_duedate, t.status_id, t.made_sla, t.updated_at,
        (t.resolved_date > NOW()) AS resolved_in_future,
        (t.resolved_date IS NOT NULL AND t.status_id NOT IN (SELECT status_id FROM status_lookup WHERE name ILIKE 'closed' OR name ILIKE 'resolved')) AS resolved_but_status_mismatch,
        (t.last_reopened_at IS NOT NULL AND t.resolved_date IS NOT NULL AND t.last_reopened_at > t.resolved_date) AS reopened_after_resolve,
        (t.resolved_date IS NOT NULL AND t.closed_by_id IS NULL) AS resolved_but_no_closed_by,
        (t.created_date > t.resolved_date) AS created_after_resolved,
        (t.sla_duedate IS NOT NULL AND t.sla_duedate < NOW() AND (t.status_id NOT IN (SELECT status_id FROM status_lookup WHERE name ILIKE 'closed' OR name ILIKE 'resolved')) AND (date_trunc('month', t.created_date) = '2026-06-01'::date)) AS june_sla_breached_unresolved
      FROM tickets t
      LIMIT 20000
    `;

    // Note: status_lookup table may not exist; we'll create a fallback mapping if query fails.
    let rows;
    try {
      const res = await client.query(query);
      rows = res.rows;
    } catch (e) {
      // Fallback: avoid status_lookup and use common closed status ids if lookup not present
      console.warn('Status lookup not available, using common closed status ids fallback');
      const fallbackQuery = `
        SELECT t.ticket_id, t.created_date, t.resolved_date, t.last_reopened_at, t.reopen_count, t.reassignment_count,
          t.assigned_to_id, t.closed_by_id, t.assignment_group_id, t.sla_duedate, t.status_id, t.made_sla, t.updated_at,
          (t.resolved_date > NOW()) AS resolved_in_future,
          (t.resolved_date IS NOT NULL AND t.status_id NOT IN (4,5,6)) AS resolved_but_status_mismatch,
          (t.last_reopened_at IS NOT NULL AND t.resolved_date IS NOT NULL AND t.last_reopened_at > t.resolved_date) AS reopened_after_resolve,
          (t.resolved_date IS NOT NULL AND t.closed_by_id IS NULL) AS resolved_but_no_closed_by,
          (t.created_date > t.resolved_date) AS created_after_resolved,
          (t.sla_duedate IS NOT NULL AND t.sla_duedate < NOW() AND (t.status_id NOT IN (4,5,6)) AND (date_trunc('month', t.created_date) = '2026-06-01'::date)) AS june_sla_breached_unresolved
        FROM tickets t
        LIMIT 20000
      `;
      const res2 = await client.query(fallbackQuery);
      rows = res2.rows;
    }

    const headers = ['ticket_id','created_date','resolved_date','last_reopened_at','reopen_count','reassignment_count','assigned_to_id','closed_by_id','assignment_group_id','sla_duedate','status_id','made_sla','updated_at','resolved_in_future','resolved_but_status_mismatch','reopened_after_resolve','resolved_but_no_closed_by','created_after_resolved','june_sla_breached_unresolved'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const cells = headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        return String(val).replace(/\n/g,' ').replace(/,/g,'');
      });
      lines.push(cells.join(','));
    }

    fs.writeFileSync(OUT_CSV, lines.join('\n'));
    console.log('Wrote anomalies CSV ->', OUT_CSV);
    console.log('Done — please review anomalies before any fixes.');
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main();
