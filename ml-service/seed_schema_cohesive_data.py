from __future__ import annotations

import argparse
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg2
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH, override=True)

DEFAULT_SAMPLE_COUNT = 5000


def normalize_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
        query['sslmode'] = 'require'
    normalized_query = urlencode(query)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, normalized_query, parsed.fragment))


def get_db_connection() -> psycopg2.extensions.connection:
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise RuntimeError('DATABASE_URL environment variable is required')
    database_url = normalize_database_url(database_url)
    return psycopg2.connect(database_url)


def fetch_lookups(conn: psycopg2.extensions.connection) -> Dict[str, Any]:
    lookup: Dict[str, Any] = {}
    with conn.cursor() as cur:
        cur.execute('SELECT role_id, role_name FROM roles')
        roles = {row[1].lower(): row[0] for row in cur.fetchall()}

        cur.execute('SELECT user_id, assignment_group_id, role_id FROM users')
        users = [{'user_id': row[0], 'assignment_group_id': row[1], 'role_id': row[2]} for row in cur.fetchall()]

        cur.execute('SELECT assignment_group_id FROM assignment_groups')
        lookup['assignment_groups'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT category_id FROM category')
        categories = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT subcategory_id, category_id FROM subcategory')
        subcategories: Dict[int, List[int]] = {}
        all_subcategory_ids: List[int] = []
        for subcategory_id, category_id in cur.fetchall():
            subcategories.setdefault(category_id, []).append(subcategory_id)
            all_subcategory_ids.append(subcategory_id)

        cur.execute('SELECT priority_id FROM priority ORDER BY priority_id')
        lookup['priorities'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT impact_id FROM impact ORDER BY impact_id')
        lookup['impacts'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT urgency_id FROM urgency ORDER BY urgency_id')
        lookup['urgencies'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT channel_id FROM channel ORDER BY channel_id')
        lookup['channels'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT source_id FROM source ORDER BY source_id')
        lookup['sources'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT config_item_id FROM configuration_items ORDER BY config_item_id')
        lookup['config_items'] = [row[0] for row in cur.fetchall()]

        cur.execute('SELECT sla_id, sla_hours FROM sla ORDER BY sla_id')
        lookup['slas'] = [{'sla_id': row[0], 'sla_hours': row[1]} for row in cur.fetchall()]

        cur.execute('SELECT status_id, status_name FROM status ORDER BY status_id')
        lookup['status_map'] = {row[1].lower(): row[0] for row in cur.fetchall()}

        cur.execute('SELECT sub_status_id, status_id FROM sub_status')
        lookup['sub_status_by_status_id'] = {}
        for sub_status_id, status_id in cur.fetchall():
            lookup['sub_status_by_status_id'].setdefault(status_id, []).append(sub_status_id)

    lookup['categories'] = categories
    lookup['subcategories_by_category'] = subcategories
    lookup['all_subcategory_ids'] = all_subcategory_ids
    lookup['users'] = users
    lookup['roles'] = roles

    agent_role_id = lookup['roles'].get('agent')
    if agent_role_id is not None:
        lookup['agent_users'] = [u for u in users if u['role_id'] == agent_role_id]
    else:
        lookup['agent_users'] = [u for u in users if u['assignment_group_id'] is not None]

    lookup['requester_users'] = users
    lookup['closer_users'] = users

    if not lookup['agent_users']:
        raise RuntimeError('No agent users found in the database. At least one agent user is required.')
    if not lookup['categories']:
        raise RuntimeError('No categories found in the database.')
    if not lookup['assignment_groups']:
        raise RuntimeError('No assignment groups found in the database.')

    return lookup


def create_ml_training_table(conn: psycopg2.extensions.connection) -> None:
    create_statement = '''
    CREATE TABLE IF NOT EXISTS ml_training_samples (
      training_sample_id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP NOT NULL,
      assignment_group_id INT NOT NULL,
      assigned_to_id INT NOT NULL,
      category_id INT NOT NULL,
      subcategory_id INT,
      priority_id INT NOT NULL,
      impact_id INT NOT NULL,
      urgency_id INT NOT NULL,
      channel_id INT NOT NULL,
      source_id INT NOT NULL,
      reopen_count INT NOT NULL,
      reassignment_count INT NOT NULL,
      duration DECIMAL(10, 2) NOT NULL,
      ticket_complexity DECIMAL(10, 2) NOT NULL,
      agent_fcr_history DECIMAL(10, 4) NOT NULL,
      category_non_fcr_rate DECIMAL(10, 4) NOT NULL,
      non_fcr_label BOOLEAN NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      generated_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
    '''
    with conn.cursor() as cur:
        cur.execute(create_statement)
    conn.commit()


def fetch_status_ids(lookup: Dict[str, Any]) -> Tuple[Optional[int], Optional[int], Optional[int], Optional[int]]:
    status_map = lookup['status_map']
    default_ids = list(status_map.values())
    fallback = default_ids[0] if default_ids else None
    return (
        status_map.get('new', fallback),
        status_map.get('in progress', fallback),
        status_map.get('resolved', fallback),
        status_map.get('pending', fallback),
    )


def build_ticket_row(
    sample_number: int,
    lookup: Dict[str, Any],
    rng: random.Random,
    now: datetime,
    assignment_group_override: Optional[int] = None,
    created_date_override: Optional[datetime] = None,
) -> Dict[str, Any]:
    categories = lookup['categories']
    subcategories_by_category = lookup['subcategories_by_category']
    assignments = lookup['assignment_groups']
    agents_by_group: Dict[int, List[int]] = {}
    for user in lookup['agent_users']:
        group_id = user['assignment_group_id'] or rng.choice(assignments)
        agents_by_group.setdefault(group_id, []).append(user['user_id'])

    assignment_group_id = assignment_group_override or rng.choice(assignments)
    assigned_to_candidates = agents_by_group.get(assignment_group_id) or [u['user_id'] for u in lookup['agent_users']]
    assigned_to_id = rng.choice(assigned_to_candidates)
    requester_id = rng.choice(lookup['requester_users'])['user_id']
    closed_by_id = rng.choice(lookup['closer_users'])['user_id']

    category_id = rng.choice(categories)
    if category_id in subcategories_by_category and subcategories_by_category[category_id]:
        subcategory_id = rng.choice(subcategories_by_category[category_id])
    else:
        subcategory_id = rng.choice(lookup['all_subcategory_ids'])

    priority_id = rng.choices(lookup['priorities'], weights=[0.30, 0.35, 0.25, 0.10][: len(lookup['priorities'])])[0]
    impact_id = rng.choices(lookup['impacts'], weights=[0.30, 0.35, 0.35][: len(lookup['impacts'])])[0]
    urgency_id = rng.choices(lookup['urgencies'], weights=[0.30, 0.35, 0.35][: len(lookup['urgencies'])])[0]
    channel_id = rng.choice(lookup['channels'])
    source_id = rng.choice(lookup['sources'])
    config_item_id = rng.choice(lookup['config_items'])
    sla_record = rng.choice(lookup['slas'])
    sla_id = sla_record['sla_id']
    sla_hours = sla_record['sla_hours']

    # Determine created_date first so we can make status age-dependent
    if created_date_override is not None:
        created_date = created_date_override
    else:
        created_date = now - timedelta(days=rng.randint(1, 180), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))

    # Calculate days since ticket creation for age-dependent status assignment
    days_ago = (now - created_date).days

    # Old tickets (>14 days) should almost always be resolved, but a small
    # portion can remain pending while waiting on external dependencies.
    # Older tickets should rarely remain new because that indicates poor queue hygiene.
    status_new_id, status_in_progress_id, status_resolved_id, status_pending_id = fetch_status_ids(lookup)
    if days_ago > 14:
        status_choice = rng.choices(
            ['resolved', 'in_progress', 'new', 'pending'],
            weights=[0.75, 0.10, 0.05, 0.10],
            k=1,
        )[0]
    else:
        status_choice = rng.choices(
            ['resolved', 'in_progress', 'new', 'pending'],
            weights=[0.20, 0.30, 0.35, 0.15],
            k=1,
        )[0]
    status_id = {
        'resolved': status_resolved_id,
        'in_progress': status_in_progress_id,
        'new': status_new_id,
        'pending': status_pending_id,
    }[status_choice]

    sub_status_id = None
    if status_choice == 'pending' and status_id in lookup['sub_status_by_status_id']:
        sub_status_id = rng.choice(lookup['sub_status_by_status_id'][status_id])

    reopen_count = int(rng.choice([0, 0, 0, 1, 1, 2, 3]))
    reassignment_count = int(rng.choice([0, 0, 1, 1, 1, 2]))
    category_risk = min(0.95, max(0.02, 0.08 * category_id + rng.gauss(0, 0.05)))
    ticket_complexity = min(
        12.0,
        max(
            1.0,
            category_risk * 9.5
            + (priority_id - 1) * 1.45
            + (impact_id - 1) * 1.2
            + (urgency_id - 1) * 1.05
            + reopen_count * 1.4
            + reassignment_count * 1.25
            + rng.gauss(0, 0.35),
        ),
    )

    sla_duedate = created_date + timedelta(hours=sla_hours)

    # Ensure the SLA sampling applies to resolved tickets only so that
    # ~80% of resolved tickets naturally resolve within their SLA window.
    if status_choice == 'resolved':
        will_make_sla = rng.random() < 0.80
    else:
        will_make_sla = False

    if will_make_sla:
        duration = max(0.25, min(sla_hours * rng.uniform(0.10, 0.90), sla_hours * 0.98))
    else:
        # For resolved tickets that miss SLA, pick a duration beyond the SLA.
        # For non-resolved tickets, keep a reasonable in-progress estimate so
        # training features (like duration) remain sensible.
        if status_choice != 'resolved':
            duration = max(0.25, sla_hours * rng.uniform(0.20, 1.50))
        else:
            duration = sla_hours * rng.uniform(1.05, 2.20)

    resolved_date = created_date + timedelta(hours=duration) if status_choice == 'resolved' else None
    if status_choice == 'pending':
        resolved_date = None
    made_sla = bool(resolved_date and resolved_date <= sla_duedate)

    base_fcr_rate = rng.uniform(0.82, 0.92)
    fcr_penalty = 0.0
    fcr_penalty += 0.08 if reopen_count > 0 else 0.0
    fcr_penalty += 0.06 if reassignment_count > 0 else 0.0
    fcr_penalty += max(0.0, (ticket_complexity - 6.0) / 6.0) * 0.07
    fcr_penalty += max(0.0, (duration / max(1.0, sla_hours)) - 1.0) * 0.05
    fcr_probability = min(0.98, max(0.12, base_fcr_rate - fcr_penalty + rng.gauss(0, 0.03)))
    fcr = rng.random() < fcr_probability
    non_fcr_label = not fcr

    last_reopened_at = None
    if reopen_count > 0:
        last_reopened_at = created_date + timedelta(hours=rng.uniform(1, duration / max(1, reopen_count) + 1))

    short_description = f'Synthetic ticket for ML + schema coherence #{sample_number:06d}'
    work_notes = 'Auto-generated synthetic ticket for ML training and schema integration.'
    now_ts = now

    return {
        'ticket_id': f'SYN-TICKET-{sample_number:06d}',
        'created_date': created_date,
        'resolved_date': resolved_date,
        'last_reopened_at': last_reopened_at,
        'duration': round(duration, 2),
        'reopen_count': reopen_count,
        'reassignment_count': reassignment_count,
        'short_description': short_description,
        'work_notes': work_notes,
        'made_sla': made_sla,
        'fcr': fcr,
        'requester_id': requester_id,
        'assigned_to_id': assigned_to_id,
        'closed_by_id': closed_by_id if status_choice == 'resolved' else None,
        'assignment_group_id': assignment_group_id,
        'priority_id': priority_id,
        'impact_id': impact_id,
        'urgency_id': urgency_id,
        'status_id': status_id,
        'sub_status_id': sub_status_id,
        'category_id': category_id,
        'subcategory_id': subcategory_id,
        'channel_id': channel_id,
        'source_id': source_id,
        'config_item_id': config_item_id,
        'sla_id': sla_id,
        'sla_duedate': sla_duedate,
        'created_at': now_ts,
        'updated_at': now_ts,
        'ticket_complexity': round(ticket_complexity, 2),
        'agent_fcr_history': round(max(0.05, min(0.98, rng.gauss(0.72, 0.12))), 4),
        'category_non_fcr_rate': round(min(0.95, max(0.01, category_risk + rng.gauss(0, 0.05))), 4),
        'non_fcr_label': non_fcr_label,
        'source_type': 'schema_cohesive',
        'is_active': True,
        'generated_at': now_ts,
        'updated_at_training': now_ts,
    }


def prepare_ticket_records(ticket_data: Dict[str, Any]) -> Tuple[Tuple[Any, ...], Tuple[Any, ...]]:
    ticket_values = (
        ticket_data['ticket_id'],
        ticket_data['created_date'],
        ticket_data['resolved_date'],
        ticket_data['last_reopened_at'],
        ticket_data['duration'],
        ticket_data['reopen_count'],
        ticket_data['reassignment_count'],
        ticket_data['short_description'],
        ticket_data['work_notes'],
        ticket_data['made_sla'],
        ticket_data['fcr'],
        ticket_data['requester_id'],
        ticket_data['assigned_to_id'],
        ticket_data['closed_by_id'],
        ticket_data['assignment_group_id'],
        ticket_data['priority_id'],
        ticket_data['impact_id'],
        ticket_data['urgency_id'],
        ticket_data['status_id'],
        ticket_data['sub_status_id'],
        ticket_data['category_id'],
        ticket_data['subcategory_id'],
        ticket_data['channel_id'],
        ticket_data['source_id'],
        ticket_data['config_item_id'],
        ticket_data['sla_id'],
        ticket_data['sla_duedate'],
        ticket_data['created_at'],
        ticket_data['updated_at'],
    )

    training_values = (
        ticket_data['ticket_id'],
        ticket_data['created_at'],
        ticket_data['assignment_group_id'],
        ticket_data['assigned_to_id'],
        ticket_data['category_id'],
        ticket_data['subcategory_id'],
        ticket_data['priority_id'],
        ticket_data['impact_id'],
        ticket_data['urgency_id'],
        ticket_data['channel_id'],
        ticket_data['source_id'],
        ticket_data['reopen_count'],
        ticket_data['reassignment_count'],
        ticket_data['duration'],
        ticket_data['ticket_complexity'],
        ticket_data['agent_fcr_history'],
        ticket_data['category_non_fcr_rate'],
        ticket_data['non_fcr_label'],
        ticket_data['source_type'],
        ticket_data['is_active'],
        ticket_data['generated_at'],
        ticket_data['updated_at_training'],
    )
    return ticket_values, training_values


def seed_cohesive_data(sample_count: int = DEFAULT_SAMPLE_COUNT, truncate_training: bool = True) -> None:
    print(f'Connecting to database, generating {sample_count} tickets...')
    now = datetime.now(timezone.utc)
    rng = random.Random(42)

    with get_db_connection() as conn:
        print('Connected. Loading schema lookups...')
        lookup = fetch_lookups(conn)
        print(
            f"Found {len(lookup['assignment_groups'])} assignment groups, "
            f"{len(lookup['categories'])} categories, {len(lookup['all_subcategory_ids'])} subcategories, "
            f"{len(lookup['agent_users'])} agent users."
        )
        create_ml_training_table(conn)

        with conn.cursor() as cur:
            if truncate_training:
                print('Truncating existing ml_training_samples...')
                cur.execute('TRUNCATE TABLE ml_training_samples RESTART IDENTITY')
                conn.commit()

            ticket_rows: List[Tuple[Any, ...]] = []
            training_rows: List[Tuple[Any, ...]] = []
            survey_rows: List[Tuple[Any, ...]] = []

            # Determine agent counts per assignment group to weight workload
            agents_by_group_count: Dict[int, int] = {}
            total_agents = 0
            for u in lookup['agent_users']:
                gid = u['assignment_group_id'] or rng.choice(lookup['assignment_groups'])
                agents_by_group_count[gid] = agents_by_group_count.get(gid, 0) + 1
                total_agents += 1

            max_monthly_total = int(os.getenv('SEED_MAX_MONTHLY_TICKETS', '3000'))
            # allocate monthly targets proportional to agent counts
            target_monthly_by_group: Dict[int, int] = {}
            for gid, cnt in agents_by_group_count.items():
                target_monthly_by_group[gid] = max(1, int(round(max_monthly_total * (cnt / max(1, total_agents)))))

            monthly_count_by_group: Dict[int, int] = {gid: 0 for gid in lookup['assignment_groups']}

            # Precompute group selection weights from agent counts
            group_weights = [agents_by_group_count.get(g, 1) for g in lookup['assignment_groups']]

            # With age-dependent status assignment:
            # - Days 1-14 (recent): ~35% resolved
            # - Days 15-180 (old): ~95% resolved
            # Estimated proportions: 14/180 ~= 7.8% recent, 166/180 ~= 92.2% old
            # Average: 0.078 * 0.35 + 0.922 * 0.95 ~= 0.90 (90% resolved)
            expected_resolved = int(sample_count * 0.90)
            target_made_sla_resolved = int(round(expected_resolved * 0.80))
            resolved_count_so_far = 0
            made_sla_resolved_so_far = 0

            intended_made_sla = 0
            intended_resolved = 0
            for sample_number in range(1, sample_count + 1):
                # pick an assignment group weighted by agent counts so workload reflects group size
                assignment_group_id = rng.choices(lookup['assignment_groups'], weights=group_weights, k=1)[0]

                # Decide if this ticket should be placed in the recent 30-day window
                in_recent_window = False
                if monthly_count_by_group.get(assignment_group_id, 0) < target_monthly_by_group.get(assignment_group_id, 0):
                    # probability to be recent proportional to remaining quota
                    remaining = target_monthly_by_group[assignment_group_id] - monthly_count_by_group[assignment_group_id]
                    prob_recent = min(1.0, remaining / max(1, sample_count - sample_number + 1))
                    in_recent_window = rng.random() < prob_recent

                if in_recent_window:
                    created_date = now - timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
                    monthly_count_by_group[assignment_group_id] = monthly_count_by_group.get(assignment_group_id, 0) + 1
                else:
                    created_date = now - timedelta(days=rng.randint(30, 180), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))

                row = build_ticket_row(sample_number, lookup, rng, now, assignment_group_override=assignment_group_id, created_date_override=created_date)

                # Ensure approximately 80% of resolved tickets meet SLA by adjusting
                # duration/resolved_date post-build if necessary. We use an expected
                # resolved count to set a target so the final proportion is close.
                if row['resolved_date'] is not None:
                    resolved_count_so_far += 1
                    remaining_to_target = target_made_sla_resolved - made_sla_resolved_so_far
                    remaining_resolved = max(1, expected_resolved - resolved_count_so_far + 1)
                    # probability to mark this resolved ticket as made_sla so we hit target
                    prob_mark = min(1.0, remaining_to_target / remaining_resolved)
                    if prob_mark > 0 and rng.random() < prob_mark:
                        # mark as within SLA
                        sla_hours = next((s['sla_hours'] for s in lookup['slas'] if s['sla_id'] == row['sla_id']), None) or 24
                        duration = max(0.25, min(sla_hours * rng.uniform(0.10, 0.90), sla_hours * 0.98))
                        row['duration'] = round(duration, 2)
                        row['resolved_date'] = row['created_date'] + timedelta(hours=duration)
                        row['made_sla'] = True
                        made_sla_resolved_so_far += 1
                    else:
                        # mark as missing SLA
                        sla_hours = next((s['sla_hours'] for s in lookup['slas'] if s['sla_id'] == row['sla_id']), None) or 24
                        duration = sla_hours * rng.uniform(1.05, 8.0)
                        row['duration'] = round(duration, 2)
                        row['resolved_date'] = row['created_date'] + timedelta(hours=duration)
                        row['made_sla'] = False
                ticket_values, training_values = prepare_ticket_records(row)
                ticket_rows.append(ticket_values)
                training_rows.append(training_values)
                # track intended counts before DB insert
                if row.get('resolved_date') is not None:
                    intended_resolved += 1
                if row.get('made_sla'):
                    intended_made_sla += 1
                if rng.random() < 0.08 and row['resolved_date'] is not None:
                    survey_rows.append((
                        row['ticket_id'],
                        rng.choice([True, False]),
                        'Synthetic survey response for schema cohesion.',
                        now,
                    ))
                if sample_number % 500 == 0:
                    print(f'  Prepared {sample_number} tickets...')

            print(f'Generation complete: intended_resolved={intended_resolved}, intended_made_sla={intended_made_sla}')

            # If skipping DB insert, show a sample of prepared ticket rows and exit
            if os.getenv('SEED_SKIP_INSERT'):
                sample = ticket_rows[:20]
                made_sla_flags = [r[9] for r in sample]
                print('Sample made_sla flags (first 20 rows):', made_sla_flags)
                print('Total intended_made_sla in prepared rows:', sum(1 for r in ticket_rows if r[9]))
                return

            print('Removing existing synthetic tickets and dependent survey records, then inserting new ones...')
            # Skip explicit deletion - use ON CONFLICT DO NOTHING for upserts instead
            # Batch insert in chunks to avoid hanging on large transactions
            batch_size = 500
            print(f'Inserting {len(ticket_rows)} tickets in batches of {batch_size}...')
            for i in range(0, len(ticket_rows), batch_size):
                batch = ticket_rows[i:i+batch_size]
                cur.executemany(
                    '''
                    INSERT INTO tickets (
                        ticket_id, created_date, resolved_date, last_reopened_at, duration,
                        reopen_count, reassignment_count, short_description, work_notes, made_sla,
                        fcr, requester_id, assigned_to_id, closed_by_id, assignment_group_id,
                        priority_id, impact_id, urgency_id, status_id, sub_status_id,
                        category_id, subcategory_id, channel_id, source_id, config_item_id,
                        sla_id, sla_duedate, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ticket_id) DO NOTHING
                    ''',
                    batch,
                )
                conn.commit()
                print(f'  Inserted tickets {i+1}-{min(i+batch_size, len(ticket_rows))}')

            print('Inserting ML training samples...')
            for i in range(0, len(training_rows), batch_size):
                batch = training_rows[i:i+batch_size]
                cur.executemany(
                    '''
                    INSERT INTO ml_training_samples (
                        ticket_id, created_at, assignment_group_id, assigned_to_id,
                        category_id, subcategory_id, priority_id, impact_id, urgency_id,
                        channel_id, source_id, reopen_count, reassignment_count,
                        duration, ticket_complexity, agent_fcr_history, category_non_fcr_rate,
                        non_fcr_label, source_type, is_active, generated_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ticket_id) DO NOTHING
                    ''',
                    batch,
                )
                conn.commit()
                print(f'  Inserted ML samples {i+1}-{min(i+batch_size, len(training_rows))}')

            if survey_rows:
                print(f'Inserting {len(survey_rows)} survey rows...')
                for i in range(0, len(survey_rows), batch_size):
                    batch = survey_rows[i:i+batch_size]
                    cur.executemany(
                        '''
                        INSERT INTO survey (ticket_id, survey_response, survey_comments, created_at)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (ticket_id) DO NOTHING
                        ''',
                        batch,
                    )
                    conn.commit()
                    print(f'  Inserted survey rows {i+1}-{min(i+batch_size, len(survey_rows))}')

            cur.execute('SELECT COUNT(*) FROM tickets WHERE ticket_id LIKE %s', ('SYN-%',))
            tickets_loaded = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM ml_training_samples WHERE source_type = %s', ('schema_cohesive',))
            training_loaded = cur.fetchone()[0]

        print(f'✅ Seeded {ticket_rows and sample_count or 0} synthetic tickets into tickets table')
        print(f'✅ Loaded {training_loaded} schema-cohesive training rows into ml_training_samples')
        print(f'✅ Created {len(survey_rows)} synthetic survey records')


def main() -> None:
    sample_count = int(os.getenv('SEED_SAMPLE_COUNT', DEFAULT_SAMPLE_COUNT))
    seed_cohesive_data(sample_count=sample_count)


if __name__ == '__main__':
    main()
