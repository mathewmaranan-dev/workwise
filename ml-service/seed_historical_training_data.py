import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg2
from dotenv import load_dotenv


@dataclass(frozen=True)
class LookupSet:
    categories: list[tuple[int, float]]
    subcategories: dict[int, list[int]]
    assignment_groups: list[int]
    agents: list[dict]
    priorities: list[int]
    impacts: list[int]
    urgencies: list[int]
    channels: list[int]
    sources: list[int]
    configuration_items: list[int]
    slas: list[int]


def load_dotenv_file() -> Path:
    env_path = Path(__file__).resolve().parent / '.env'
    load_dotenv(env_path, override=True)
    return env_path


def normalize_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
        query['sslmode'] = 'require'
    normalized_query = urlencode(query)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, normalized_query, parsed.fragment))


def connect() -> psycopg2.extensions.connection:
    env_path = load_dotenv_file()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise RuntimeError('DATABASE_URL environment variable is required')
    parsed = urlsplit(database_url)
    host = parsed.hostname or 'unknown'
    port = parsed.port or 5432
    print(f"Using DATABASE_URL from {env_path} -> connecting to {host}:{port}")
    database_url = normalize_database_url(database_url)
    try:
        return psycopg2.connect(database_url)
    except psycopg2.OperationalError as exc:
        raise RuntimeError(
            f"Failed to connect to PostgreSQL host {host}:{port}. "
            'This usually means outbound TLS/network access to the Render database is blocked, '
            'or the database is not externally reachable from this machine.'
        ) from exc


def fetch_lookup_tables(conn: psycopg2.extensions.connection) -> LookupSet:
    with conn.cursor() as cur:
        cur.execute("SELECT category_id FROM category ORDER BY category_id")
        category_ids = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT subcategory_id, category_id FROM subcategory ORDER BY subcategory_id")
        subcategory_rows = cur.fetchall()
        subcategories = {}
        for subcategory_id, category_id in subcategory_rows:
            subcategories.setdefault(category_id, []).append(subcategory_id)

        cur.execute("SELECT assignment_group_id FROM assignment_groups ORDER BY assignment_group_id")
        assignment_groups = [row[0] for row in cur.fetchall()]

        cur.execute(
            """
            SELECT u.user_id, u.assignment_group_id
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE r.role_name = 'agent'
            ORDER BY u.user_id
            """
        )
        agents = [
            {
                'user_id': row[0],
                'assignment_group_id': row[1],
            }
            for row in cur.fetchall()
        ]

        cur.execute("SELECT priority_id FROM priority ORDER BY priority_id")
        priorities = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT impact_id FROM impact ORDER BY impact_id")
        impacts = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT urgency_id FROM urgency ORDER BY urgency_id")
        urgencies = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT channel_id FROM channel ORDER BY channel_id")
        channels = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT source_id FROM source ORDER BY source_id")
        sources = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT config_item_id FROM configuration_items ORDER BY config_item_id")
        configuration_items = [row[0] for row in cur.fetchall()]

        cur.execute("SELECT sla_id FROM sla ORDER BY sla_id")
        slas = [row[0] for row in cur.fetchall()]

    category_risk_map = {
        1: 0.10,
        2: 0.35,
        3: 0.40,
        4: 0.15,
        5: 0.15,
    }
    categories = [(category_id, category_risk_map.get(category_id, 0.20)) for category_id in category_ids]

    return LookupSet(
        categories=categories,
        subcategories=subcategories,
        assignment_groups=assignment_groups,
        agents=agents,
        priorities=priorities,
        impacts=impacts,
        urgencies=urgencies,
        channels=channels,
        sources=sources,
        configuration_items=configuration_items,
        slas=slas,
    )


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def weighted_choice(rng: random.Random, options: list[tuple[int, float]]) -> int:
    total = sum(weight for _, weight in options)
    threshold = rng.uniform(0, total)
    running_total = 0.0
    for value, weight in options:
        running_total += weight
        if threshold <= running_total:
            return value
    return options[-1][0]


def seed_training_samples(sample_count: int = 5000, seed: int = 42) -> None:
    load_dotenv_file()
    conn = connect()
    try:
        lookup = fetch_lookup_tables(conn)
        if not lookup.agents:
            raise RuntimeError('No agent users found in the database to seed training samples')
        if not lookup.assignment_groups:
            raise RuntimeError('No assignment groups found in the database to seed training samples')

        rng = random.Random(seed)

        # Assign stable per-agent FCR performance so patterns are realistic
        agent_base_fcr = {}
        for agent in lookup.agents:
            agent_base_fcr[agent['user_id']] = round(rng.uniform(0.62, 0.92), 3)

        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE ml_training_samples RESTART IDENTITY")
            conn.commit()

        rows = []
        for index in range(sample_count):
            category_id = weighted_choice(rng, lookup.categories)
            subcategory_candidates = lookup.subcategories.get(category_id, [])
            subcategory_id = rng.choice(subcategory_candidates) if subcategory_candidates else None

            agent = rng.choice(lookup.agents)
            assigned_to_id = agent['user_id']
            group_id = agent['assignment_group_id'] or rng.choice(lookup.assignment_groups)

            priority_id = rng.choices(lookup.priorities, weights=[0.35, 0.35, 0.30], k=1)[0]
            impact_id = rng.choices(lookup.impacts, weights=[0.30, 0.35, 0.35], k=1)[0]
            urgency_id = rng.choices(lookup.urgencies, weights=[0.30, 0.35, 0.35], k=1)[0]
            channel_id = rng.choice(lookup.channels)
            source_id = rng.choice(lookup.sources)
            config_item_id = rng.choice(lookup.configuration_items)
            sla_id = rng.choice(lookup.slas)

            category_risk = next(weight for category, weight in lookup.categories if category == category_id)
            reopen_count = 1 if rng.random() < 0.22 else 0
            reassignment_count = 1 if rng.random() < 0.15 else 0

            ticket_complexity = round(clamp(
                category_risk * 10
                + (priority_id - 1) * 1.4
                + (impact_id - 1) * 1.2
                + (urgency_id - 1) * 1.0
                + rng.uniform(-0.2, 0.2),
                1,
                12,
            ), 2)

            duration = round(clamp(
                60
                + ticket_complexity * 25
                + reopen_count * 40
                + reassignment_count * 30
                + rng.uniform(-15, 35),
                45,
                840,
            ), 2)

            agent_fcr_history = agent_base_fcr[assigned_to_id]
            category_non_fcr_rate = round(clamp(category_risk + rng.uniform(-0.06, 0.06), 0, 1), 4)

            raw_non_fcr_score = (
                0.15 * (1 if priority_id == 1 else 0)
                + 0.20 * category_risk
                + 0.18 * (1 if reopen_count > 0 else 0)
                + 0.12 * (1 if reassignment_count > 0 else 0)
                + 0.12 * clamp((duration - 120) / 360, 0, 1)
                + 0.23 * (1 - agent_fcr_history)
                + rng.uniform(-0.05, 0.05)
            )
            non_fcr_probability = clamp(raw_non_fcr_score, 0, 1)
            non_fcr_label = rng.random() < non_fcr_probability

            created_at = datetime.now(timezone.utc) - timedelta(
                days=rng.randint(1, 365),
                hours=rng.randint(0, 23),
                minutes=rng.randint(0, 59),
            )

            rows.append((
                f"HIST-{index + 1:06d}",
                created_at,
                group_id,
                assigned_to_id,
                category_id,
                subcategory_id,
                priority_id,
                impact_id,
                urgency_id,
                channel_id,
                source_id,
                reopen_count,
                reassignment_count,
                duration,
                ticket_complexity,
                agent_fcr_history,
                category_non_fcr_rate,
                non_fcr_label,
                'synthetic_history',
                True,
                created_at,
                created_at,
            ))

        with conn.cursor() as cur:
            print('DEBUG: rows generated =', len(rows))
            if rows:
                print('DEBUG: sample row length =', len(rows[0]), 'sample row =', rows[0][:5])
            cur.executemany(
                """
                INSERT INTO ml_training_samples (
                    ticket_id,
                    created_at,
                    assignment_group_id,
                    assigned_to_id,
                    category_id,
                    subcategory_id,
                    priority_id,
                    impact_id,
                    urgency_id,
                    channel_id,
                    source_id,
                    reopen_count,
                    reassignment_count,
                    duration,
                    ticket_complexity,
                    agent_fcr_history,
                    category_non_fcr_rate,
                    non_fcr_label,
                    source_type,
                    is_active,
                    generated_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (ticket_id) DO UPDATE SET
                    created_at = EXCLUDED.created_at,
                    assignment_group_id = EXCLUDED.assignment_group_id,
                    assigned_to_id = EXCLUDED.assigned_to_id,
                    category_id = EXCLUDED.category_id,
                    subcategory_id = EXCLUDED.subcategory_id,
                    priority_id = EXCLUDED.priority_id,
                    impact_id = EXCLUDED.impact_id,
                    urgency_id = EXCLUDED.urgency_id,
                    channel_id = EXCLUDED.channel_id,
                    source_id = EXCLUDED.source_id,
                    reopen_count = EXCLUDED.reopen_count,
                    reassignment_count = EXCLUDED.reassignment_count,
                    duration = EXCLUDED.duration,
                    ticket_complexity = EXCLUDED.ticket_complexity,
                    agent_fcr_history = EXCLUDED.agent_fcr_history,
                    category_non_fcr_rate = EXCLUDED.category_non_fcr_rate,
                    non_fcr_label = EXCLUDED.non_fcr_label,
                    source_type = EXCLUDED.source_type,
                    is_active = EXCLUDED.is_active,
                    generated_at = EXCLUDED.generated_at,
                    updated_at = EXCLUDED.updated_at
                """,
                rows,
            )
            conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM ml_training_samples WHERE is_active = TRUE")
            row_count = cur.fetchone()[0]

        print(f"Seeded {row_count} training rows into ml_training_samples")

    finally:
        conn.close()


def main() -> None:
    seed_training_samples()


if __name__ == '__main__':
    main()
