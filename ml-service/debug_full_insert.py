from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv(Path('.env'))
parsed = urlsplit(os.getenv('DATABASE_URL'))
query = dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
    query['sslmode'] = 'require'
db_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
conn = psycopg2.connect(db_url)
cur = conn.cursor()
try:
    cur.execute('SELECT user_id FROM users LIMIT 1')
    requester_id = cur.fetchone()[0]
    cur.execute('SELECT assigned_to_id FROM tickets LIMIT 1')
    assigned_to = cur.fetchone()[0] if cur.rowcount else requester_id
    cur.execute('SELECT status_id FROM status LIMIT 1')
    status_id = cur.fetchone()[0]
    cur.execute('SELECT category_id FROM category LIMIT 1')
    category_id = cur.fetchone()[0]
    cur.execute('SELECT subcategory_id FROM subcategory LIMIT 1')
    subcategory_id = cur.fetchone()[0]
    cur.execute('SELECT channel_id FROM channel LIMIT 1')
    channel_id = cur.fetchone()[0]
    cur.execute('SELECT source_id FROM source LIMIT 1')
    source_id = cur.fetchone()[0]
    cur.execute('SELECT config_item_id FROM configuration_items LIMIT 1')
    config_item_id = cur.fetchone()[0]
    cur.execute('SELECT sla_id FROM sla LIMIT 1')
    sla_id = cur.fetchone()[0]
    now = datetime.now()
    ticket_id = 'SYN-DEBUG-INSERT'
    created_date = now - timedelta(hours=2)
    sla_duedate = created_date + timedelta(hours=24)
    resolved_date = created_date + timedelta(hours=2)
    values = (
        ticket_id, created_date, resolved_date, None, 2.0,
        0, 0, 'debug', 'debug', True, False,
        requester_id, assigned_to, assigned_to, None, 1, 1, 1, status_id,
        None, category_id, subcategory_id, channel_id, source_id, config_item_id,
        sla_id, sla_duedate, now, now
    )
    cur.execute('DELETE FROM survey WHERE ticket_id = %s', (ticket_id,))
    cur.execute('DELETE FROM tickets WHERE ticket_id = %s', (ticket_id,))
    cur.execute('INSERT INTO tickets (ticket_id, created_date, resolved_date, last_reopened_at, duration, reopen_count, reassignment_count, short_description, work_notes, made_sla, fcr, requester_id, assigned_to_id, closed_by_id, assignment_group_id, priority_id, impact_id, urgency_id, status_id, sub_status_id, category_id, subcategory_id, channel_id, source_id, config_item_id, sla_id, sla_duedate, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)', values)
    conn.commit()
    cur.execute('SELECT ticket_id, made_sla, created_date, resolved_date, sla_duedate FROM tickets WHERE ticket_id = %s', (ticket_id,))
    print(cur.fetchone())
finally:
    cur.close()
    conn.close()
