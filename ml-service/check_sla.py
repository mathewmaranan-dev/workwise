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
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%'")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND made_sla = true")
sla_met = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE 'SYN-TICKET-%' AND fcr = true")
fcr_count = cur.fetchone()[0]
print(f'SYN tickets: {total}, made_sla={sla_met} ({sla_met/total*100 if total else 0:.1f}%), fcr={fcr_count} ({fcr_count/total*100 if total else 0:.1f}%)')
cur.close()
conn.close()
