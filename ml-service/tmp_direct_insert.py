from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import os
import psycopg2
import datetime

env_path = Path(__file__).parent / '.env'
load_dotenv(env_path, override=True)
database_url = os.getenv('DATABASE_URL')
parsed = urlsplit(database_url)
query = dict(parse_qsl(parsed.query, keep_blank_values=True))
if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
    query['sslmode'] = 'require'
database_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
conn = psycopg2.connect(database_url)
cur = conn.cursor()
cur.execute('TRUNCATE TABLE ml_training_samples RESTART IDENTITY')
rows = []
for i in range(5000):
    rows.append((
        f'HIST-{i+1:06d}',
        datetime.datetime.now(datetime.timezone.utc),
        1,
        1,
        1,
        None,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        100.0,
        5.0,
        0.8,
        0.2,
        True,
        'test',
        True,
        datetime.datetime.now(datetime.timezone.utc),
        datetime.datetime.now(datetime.timezone.utc),
    ))
cur.executemany(
    'INSERT INTO ml_training_samples(ticket_id,created_at,assignment_group_id,assigned_to_id,category_id,subcategory_id,priority_id,impact_id,urgency_id,channel_id,source_id,reopen_count,reassignment_count,duration,ticket_complexity,agent_fcr_history,category_non_fcr_rate,non_fcr_label,source_type,is_active,generated_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
    rows,
)
conn.commit()
cur.execute('SELECT count(*) FROM ml_training_samples')
print('count', cur.fetchone()[0])
cur.close()
conn.close()
