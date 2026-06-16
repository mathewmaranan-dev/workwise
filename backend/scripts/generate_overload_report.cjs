#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const outDir = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const AGENTS_CSV = path.join(outDir, 'overloaded_agents.csv');
const SAMPLES_CSV = path.join(outDir, 'sample_tickets.csv');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log('Connected (read-only) — running analysis queries');

    // Agent summary: total assigned, assigned!=closed count, reopen/reassignment sums
    const agentQuery = `
      SELECT u.user_id, u.first_name, u.last_name, u.email,
        COUNT(t.*) AS total_assigned,
        SUM(CASE WHEN t.assigned_to_id IS DISTINCT FROM t.closed_by_id THEN 1 ELSE 0 END) AS assigned_diff_closed_count,
        SUM(COALESCE(t.reopen_count,0)) AS reopen_count_sum,
        SUM(COALESCE(t.reassignment_count,0)) AS reassignment_count_sum
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to_id = u.user_id
      WHERE u.role_id = 3
      GROUP BY u.user_id, u.first_name, u.last_name, u.email
      ORDER BY assigned_diff_closed_count DESC, reopen_count_sum DESC
      LIMIT 100
    `;

    const agentsRes = await client.query(agentQuery);
    const agents = agentsRes.rows;

    // Write agents CSV
    const agentHeaders = ['user_id','first_name','last_name','email','total_assigned','assigned_diff_closed_count','reopen_count_sum','reassignment_count_sum'];
    const agentLines = [agentHeaders.join(',')];
    for (const a of agents) {
      agentLines.push([
        a.user_id,
        csvEscape(a.first_name),
        csvEscape(a.last_name),
        csvEscape(a.email),
        a.total_assigned || 0,
        a.assigned_diff_closed_count || 0,
        a.reopen_count_sum || 0,
        a.reassignment_count_sum || 0,
      ].join(','));
    }
    fs.writeFileSync(AGENTS_CSV, agentLines.join('\n'));
    console.log('Wrote agents CSV ->', AGENTS_CSV);

    // For top agents, fetch sample tickets with anomalies
    const topAgentIds = agents.map(a => a.user_id).slice(0, 20);
    const sampleLines = [
      ['agent_user_id','agent_name','ticket_id','created_date','resolved_date','status_id','assignment_group_id','assigned_to_id','closed_by_id','reopen_count','reassignment_count','short_description'].join(',')
    ];

    if (topAgentIds.length > 0) {
      // fetch up to 20 sample tickets per agent focusing on anomalies
      const sampleQuery = `
        SELECT t.ticket_id, t.created_date, t.resolved_date, t.status_id, t.assignment_group_id, t.assigned_to_id, t.closed_by_id, t.reopen_count, t.reassignment_count, t.short_description, u.user_id AS agent_user_id, u.first_name, u.last_name
        FROM tickets t
        JOIN users u ON u.user_id = t.assigned_to_id
        WHERE u.role_id = 3 AND u.user_id = ANY($1::int[])
          AND (
            t.assigned_to_id IS DISTINCT FROM t.closed_by_id
            OR COALESCE(t.reopen_count,0) > 0
            OR COALESCE(t.reassignment_count,0) > 0
          )
        ORDER BY u.user_id, t.created_date DESC
        LIMIT 1000
      `;

      const sampRes = await client.query(sampleQuery, [topAgentIds]);
      for (const r of sampRes.rows) {
        const agentName = `${r.first_name || ''} ${r.last_name || ''}`.trim();
        sampleLines.push([
          r.agent_user_id,
          csvEscape(agentName),
          r.ticket_id,
          r.created_date ? r.created_date.toISOString() : '',
          r.resolved_date ? r.resolved_date.toISOString() : '',
          r.status_id || '',
          r.assignment_group_id || '',
          r.assigned_to_id || '',
          r.closed_by_id || '',
          r.reopen_count || 0,
          r.reassignment_count || 0,
          csvEscape((r.short_description || '').replace(/\n/g,' '))
        ].join(','));
      }

      fs.writeFileSync(SAMPLES_CSV, sampleLines.join('\n'));
      console.log('Wrote sample tickets CSV ->', SAMPLES_CSV);
    } else {
      console.log('No top agents found to sample.');
    }

    console.log('Done — files are read-only exports. Review and tell me which corrective action to take next.');
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

function csvEscape(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

if (require.main === module) main();
