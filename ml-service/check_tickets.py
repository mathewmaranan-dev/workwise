import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH)

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM tickets WHERE LEFT(ticket_id, 10) = 'SYN-TICKET'")
count = cur.fetchone()[0]
print(f'Synthetic tickets in DB: {count}')

cur.execute("SELECT COUNT(*) FROM tickets WHERE LEFT(ticket_id, 10) = 'SYN-TICKET' AND made_sla = true")
made_sla_count = cur.fetchone()[0]
print(f'Made SLA (true): {made_sla_count}')

cur.close()
conn.close()
