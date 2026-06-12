from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os, psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta
load_dotenv(Path('.env'))
parsed = urlsplit(os.getenv('DATABASE_URL'))
query=dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost','127.0.0.1'} and 'sslmode' not in query:
    query['sslmode']='require'
db_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
conn=psycopg2.connect(db_url)
cur=conn.cursor()
try:
    # Start transaction
    conn.autocommit = False
    tid = 'SYN-DEBUG-0001'
    created = datetime.now()
    sla_duedate = created + timedelta(hours=1)
    resolved = created + timedelta(hours=0.5)
    made_sla = True
    cur.execute("INSERT INTO tickets (ticket_id, created_date, resolved_date, last_reopened_at, duration, reopen_count, reassignment_count, short_description, work_notes, made_sla, fcr, requester_id, assigned_to_id, closed_by_id, assignment_group_id, priority_id, impact_id, urgency_id, status_id, sub_status_id, category_id, subcategory_id, channel_id, source_id, config_item_id, sla_id, sla_duedate, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (tid, created, resolved, None, 0.5, 0, 0, 'debug', 'debug', made_sla, False, None, None, None, None, 1, 1, 1, 1, None, None, None, None, None, None, 1, sla_duedate, created, created))
    cur.execute("SELECT ticket_id, made_sla, created_date, resolved_date, sla_duedate FROM tickets WHERE ticket_id = %s", (tid,))
    print(cur.fetchone())
    conn.rollback()
finally:
    cur.close()
    conn.close()
