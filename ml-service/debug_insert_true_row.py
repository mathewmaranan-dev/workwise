from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os, random
from datetime import datetime, timezone, timedelta
import psycopg2
from dotenv import load_dotenv
from seed_schema_cohesive_data import get_db_connection, fetch_lookups, build_ticket_row, prepare_ticket_records

load_dotenv(Path('.env'))
now = datetime.now(timezone.utc)
rng = random.Random(42)
conn = get_db_connection()
with conn:
    lookup = fetch_lookups(conn)
    ticket_rows = []
    for sample_number in range(1, 2001):
        assignment_group_id = rng.choice(lookup['assignment_groups'])
        created_date = now - timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
        row = build_ticket_row(sample_number, lookup, rng, now, assignment_group_override=assignment_group_id, created_date_override=created_date)
        if row['resolved_date'] is not None:
            if row['made_sla']:
                ticket_values, _ = prepare_ticket_records(row)
                ticket_rows.append(ticket_values)
    print('found', len(ticket_rows), 'true rows')
    if not ticket_rows:
        raise SystemExit('no true rows')
    tv = ticket_rows[0]
    print('sample tv made_sla', tv[9])
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM survey WHERE ticket_id = %s', (tv[0],))
        cur.execute('DELETE FROM tickets WHERE ticket_id = %s', (tv[0],))
        cur.execute(
            '''INSERT INTO tickets (
                ticket_id, created_date, resolved_date, last_reopened_at, duration,
                reopen_count, reassignment_count, short_description, work_notes, made_sla,
                fcr, requester_id, assigned_to_id, closed_by_id, assignment_group_id,
                priority_id, impact_id, urgency_id, status_id, sub_status_id,
                category_id, subcategory_id, channel_id, source_id, config_item_id,
                sla_id, sla_duedate, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', tv)
        conn.commit()
        cur.execute('SELECT ticket_id, made_sla FROM tickets WHERE ticket_id = %s', (tv[0],))
        print(cur.fetchone())
    finally:
        cur.close()
