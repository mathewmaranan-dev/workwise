from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

OUTPUT_DIR = Path(__file__).resolve().parent / 'data'


@dataclass(frozen=True)
class ForecastGroup:
    group_id: int
    group_name: str
    base_level: float
    weekly_spike: float
    trend_slope: float
    noise_scale: float


def ensure_output_directory() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def generate_fcr_synthetic_data(samples: int = 6000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    category_ids = rng.integers(1, 8, size=samples)
    priority_ids = rng.integers(1, 5, size=samples)
    impact_ids = rng.integers(1, 5, size=samples)
    urgency_ids = rng.integers(1, 5, size=samples)
    reopen_counts = rng.integers(0, 4, size=samples)
    reassignment_counts = rng.integers(0, 4, size=samples)
    assignment_group_ids = rng.integers(1, 9, size=samples)
    assigned_to_ids = rng.integers(1001, 1045, size=samples)

    category_risk = np.clip(0.08 * category_ids + rng.normal(0, 0.04, size=samples), 0.02, 0.95)
    ticket_complexity = np.clip(
        category_risk * 10
        + (priority_ids - 1) * 1.5
        + (impact_ids - 1) * 1.2
        + (urgency_ids - 1) * 1.0
        + reopen_counts * 1.3
        + reassignment_counts * 1.2
        + rng.normal(0, 0.5, size=samples),
        1,
        12,
    )

    duration = np.clip(
        45 + ticket_complexity * 18 + reopen_counts * 28 + reassignment_counts * 20 + rng.normal(0, 22, size=samples),
        30,
        960,
    )

    agent_fcr_history = np.clip(rng.normal(loc=0.72, scale=0.12, size=samples), 0.10, 0.98)
    category_non_fcr_rate = np.clip(category_risk + rng.normal(0, 0.06, size=samples), 0.01, 0.92)

    risk_signal = (
        0.23 * (1 - agent_fcr_history)
        + 0.18 * (reopen_counts > 0).astype(float)
        + 0.12 * (reassignment_counts > 0).astype(float)
        + 0.15 * np.clip((duration - 120) / 360, 0, 1)
        + 0.12 * np.clip(ticket_complexity / 12, 0, 1)
        + 0.10 * np.clip(priority_ids / 5, 0, 1)
        + 0.10 * category_non_fcr_rate
    )
    probabilities = np.clip(risk_signal + rng.normal(0, 0.04, size=samples), 0, 1)
    non_fcr_label = (rng.random(samples) < probabilities).astype(int)

    return pd.DataFrame({
        'ticket_id': [f'SYN-{i:06d}' for i in range(samples)],
        'assignment_group_id': assignment_group_ids,
        'assigned_to_id': assigned_to_ids,
        'category_id': category_ids,
        'priority_id': priority_ids,
        'impact_id': impact_ids,
        'urgency_id': urgency_ids,
        'reopen_count': reopen_counts,
        'reassignment_count': reassignment_counts,
        'duration': np.round(duration, 2),
        'ticket_complexity': np.round(ticket_complexity, 2),
        'agent_fcr_history': np.round(agent_fcr_history, 4),
        'category_non_fcr_rate': np.round(category_non_fcr_rate, 4),
        'non_fcr_label': non_fcr_label,
        'source_type': 'synthetic',
    })


def create_fcr_train_test_split(
    df: pd.DataFrame,
    test_size: float = 0.2,
    validation_size: float = 0.1,
    stratify_column: str = 'non_fcr_label',
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train_val, test = train_test_split(
        df,
        test_size=test_size,
        stratify=df[stratify_column],
        random_state=random_state,
    )

    target = train_val[stratify_column]
    train, val = train_test_split(
        train_val,
        test_size=validation_size / (1 - test_size),
        stratify=target,
        random_state=random_state,
    )
    return train.reset_index(drop=True), test.reset_index(drop=True), val.reset_index(drop=True)


def generate_forecast_data(
    groups: int = 5,
    history_days: int = 120,
    holdout_days: int = 14,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    all_history = []
    all_holdout = []

    for group_id in range(1, groups + 1):
        base_level = 18 + group_id * 2.5
        trend = 0.17 + (group_id % 3) * 0.02
        weekly_amplitude = 6.0 + (group_id % 4) * 1.4
        season_phase = rng.uniform(0, 2 * np.pi)

        dates = pd.date_range(end=pd.Timestamp.now().normalize(), periods=history_days + holdout_days, freq='D')
        index = np.arange(history_days + holdout_days)

        values = (
            base_level
            + index * trend
            + weekly_amplitude * np.sin((index + season_phase) / 7.0)
            + 4.5 * np.where((index % 7) == 0, 1, 0)
            + rng.normal(0, 2.4, size=history_days + holdout_days)
        )
        values = np.clip(np.round(values), 8, 140).astype(int)

        history_dates = dates[:history_days]
        holdout_dates = dates[history_days:]

        all_history.append(pd.DataFrame({
            'group_id': group_id,
            'date': history_dates,
            'ticket_volume': values[:history_days],
        }))
        all_holdout.append(pd.DataFrame({
            'group_id': group_id,
            'date': holdout_dates,
            'ticket_volume': values[history_days:],
        }))

    history_df = pd.concat(all_history, ignore_index=True)
    holdout_df = pd.concat(all_holdout, ignore_index=True)
    return history_df, holdout_df


def generate_workload_scenarios(
    scenarios: int = 40,
    min_members: int = 4,
    max_members: int = 10,
    seed: int = 42,
) -> list[dict[str, Any]]:
    rng = np.random.default_rng(seed)
    result = []

    for scenario_id in range(1, scenarios + 1):
        team_size = int(rng.integers(min_members, max_members + 1))
        incoming_tickets = int(rng.integers(4, 22))
        base_load = int(rng.integers(4, 14))

        members = []
        for member_id in range(team_size):
            current_tickets = int(np.clip(base_load + rng.integers(-4, 6), 0, 24))
            sla_compliance = float(np.clip(72 + rng.normal(0, 8), 55, 98))
            fcr_rate = float(np.clip(58 + rng.normal(0, 10), 35, 96))
            experience_level = float(np.clip(rng.choice([1, 1.1, 1.2, 1.3, 1.4]), 1.0, 1.4))
            capacity = int(np.clip(18 + rng.integers(-4, 8), 12, 26))

            members.append({
                'user_id': f'user_{scenario_id}_{member_id + 1}',
                'employee_name': f'Agent {scenario_id}-{member_id + 1}',
                'current_tickets': current_tickets,
                'sla_compliance': round(sla_compliance, 1),
                'fcr_rate': round(fcr_rate, 1),
                'experience_level': round(experience_level, 2),
                'capacity': capacity,
            })

        result.append({
            'scenario_id': scenario_id,
            'assignment_group_id': int(rng.integers(1, 8)),
            'incoming_tickets': incoming_tickets,
            'team_members': members,
            'created_at': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
        })

    return result


def save_csv(df: pd.DataFrame, filename: str) -> None:
    path = OUTPUT_DIR / filename
    df.to_csv(path, index=False)
    print(f'Created {path}')


def save_json(data: Any, filename: str) -> None:
    path = OUTPUT_DIR / filename
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2, default=str)
    print(f'Created {path}')


def build_evaluation_batch(df: pd.DataFrame, rows: int = 12) -> list[dict[str, Any]]:
    sample = df.sample(min(rows, len(df)), random_state=42)
    return sample.drop(columns=['non_fcr_label', 'ticket_id', 'source_type']).to_dict(orient='records')


def main() -> None:
    ensure_output_directory()

    # FCR training/test/validation datasets
    fcr_data = generate_fcr_synthetic_data(samples=6000, seed=42)
    train_df, test_df, val_df = create_fcr_train_test_split(
        fcr_data,
        test_size=0.2,
        validation_size=0.1,
    )

    save_csv(train_df, 'fcr_train.csv')
    save_csv(test_df, 'fcr_test.csv')
    save_csv(val_df, 'fcr_validation.csv')
    save_json(build_evaluation_batch(test_df, rows=20), 'fcr_inference_batch.json')

    # Forecasting datasets
    forecast_history, forecast_holdout = generate_forecast_data(
        groups=6,
        history_days=120,
        holdout_days=14,
        seed=42,
    )
    save_csv(forecast_history, 'forecast_history.csv')
    save_csv(forecast_holdout, 'forecast_holdout.csv')
    save_json(
        forecast_holdout.groupby('group_id').apply(lambda df: df[['date', 'ticket_volume']].to_dict(orient='records')).to_dict(),
        'forecast_test_batch.json',
    )

    # Workload scenarios for model and logic testing
    workload_scenarios = generate_workload_scenarios(scenarios=40, seed=42)
    save_json(workload_scenarios, 'workload_scenarios.json')
    save_json(workload_scenarios[:10], 'workload_test_batch.json')

    print('✅ Dataset generation complete.')


if __name__ == '__main__':
    main()
