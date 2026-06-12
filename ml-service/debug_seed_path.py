import os
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from seed_schema_cohesive_data import get_db_connection, fetch_lookups, build_ticket_row, prepare_ticket_records
from dotenv import load_dotenv

load_dotenv(Path('.env'))
now = datetime.now(timezone.utc)
rng = random.Random(42)
conn = get_db_connection()
with conn:
    lookup = fetch_lookups(conn)
    row = build_ticket_row(1, lookup, rng, now)
    print('built made_sla', row['made_sla'], 'resolved_date', row['resolved_date'], 'sla_duedate', row['sla_duedate'])
    ticket_values, training_values = prepare_ticket_records(row)
    print('ticket_values[9]=', ticket_values[9], 'len', len(ticket_values))
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM survey WHERE ticket_id = %s', (row['ticket_id'],))
        cur.execute('DELETE FROM tickets WHERE ticket_id = %s', (row['ticket_id'],))
        cur.execute(
            '''INSERT INTO tickets (
                ticket_id, created_date, resolved_date, last_reopened_at, duration,
                reopen_count, reassignment_count, short_description, work_notes, made_sla,
                fcr, requester_id, assigned_to_id, closed_by_id, assignment_group_id,
                priority_id, impact_id, urgency_id, status_id, sub_status_id,
                category_id, subcategory_id, channel_id, source_id, config_item_id,
                sla_id, sla_duedate, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', ticket_values)
        conn.commit()
        cur.execute('SELECT ticket_id, made_sla FROM tickets WHERE ticket_id = %s', (row['ticket_id'],))
        print(cur.fetchone())
    finally:
        cur.close()
