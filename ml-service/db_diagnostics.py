from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os, psycopg2
from dotenv import load_dotenv
load_dotenv(Path('.env'))
parsed = urlsplit(os.getenv('DATABASE_URL'))
query=dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost','127.0.0.1'} and 'sslmode' not in query:
    query['sslmode']='require'
db_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
conn=psycopg2.connect(db_url)
cur=conn.cursor()
print('--- tickets columns ---')
cur.execute("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='tickets'")
for r in cur.fetchall():
    print(r)

print('\n--- triggers on tickets ---')
cur.execute("SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'tickets'::regclass")
for r in cur.fetchall():
    print(r)

print('\n--- made_sla counts by sla_id and status_id ---')
cur.execute("SELECT sla_id, status_id, COUNT(*), SUM(CASE WHEN made_sla THEN 1 ELSE 0 END) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' GROUP BY sla_id, status_id ORDER BY sla_id, status_id")
for r in cur.fetchall():
    print(r)

print('\n--- sample resolved rows where made_sla = true (should be >0) ---')
cur.execute("SELECT ticket_id, sla_id, created_date, sla_duedate, resolved_date, duration, made_sla FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND made_sla = true LIMIT 20")
for r in cur.fetchall():
    print(r)

print('\n--- sample resolved rows (made_sla false) ---')
cur.execute("SELECT ticket_id, sla_id, created_date, sla_duedate, resolved_date, duration, made_sla FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND resolved_date IS NOT NULL ORDER BY ticket_id LIMIT 20")
for r in cur.fetchall():
    print(r)

cur.close(); conn.close()
