from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os
import psycopg2
from dotenv import load_dotenv

env_path = Path('.env')
load_dotenv(env_path)

db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError('DATABASE_URL not found in .env')

parsed = urlsplit(db_url)
query = dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
    query['sslmode'] = 'require'

db_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))

conn = psycopg2.connect(db_url)
cur = conn.cursor()
# Counts
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%'")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND status_id IS NOT NULL")
with_status = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND resolved_date IS NOT NULL")
resolved = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND made_sla = true")
sla_met = cur.fetchone()[0]
print(f'Total SYN: {total}, with_status={with_status}, resolved={resolved}, made_sla_true={sla_met}')

# Show sample of resolved tickets
cur.execute("SELECT ticket_id, created_date, resolved_date, sla_duedate, duration, made_sla FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND resolved_date IS NOT NULL ORDER BY ticket_id LIMIT 20")
rows = cur.fetchall()
for r in rows:
    print(r)

# Show distinct sla_hours values from sla table
cur.execute('SELECT sla_id, sla_hours FROM sla ORDER BY sla_id')
print('SLAs:', cur.fetchall())

cur.close()
conn.close()
