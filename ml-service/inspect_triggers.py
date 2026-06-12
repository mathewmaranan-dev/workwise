from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os
import psycopg2
from dotenv import load_dotenv
load_dotenv(Path('.env'))
parsed = urlsplit(os.getenv('DATABASE_URL'))
query = dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
    query['sslmode'] = 'require'
db_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'tickets'::regclass")
for name, defn in cur.fetchall():
    print('---', name)
    print(defn)
cur.close()
conn.close()
