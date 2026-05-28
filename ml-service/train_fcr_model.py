from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import joblib
import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler


ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH, override=True)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_ROOT / 'ml-service' / 'models'


def normalize_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
        query['sslmode'] = 'require'
    normalized_query = urlencode(query)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, normalized_query, parsed.fragment))


def get_db_connection() -> psycopg2.extensions.connection:
    load_dotenv(ENV_PATH, override=True)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise RuntimeError('DATABASE_URL environment variable is required')
    parsed = urlsplit(database_url)
    host = parsed.hostname or 'unknown'
    port = parsed.port or 5432
    print(f"Using DATABASE_URL from {ENV_PATH} -> connecting to {host}:{port}")
    database_url = normalize_database_url(database_url)
    try:
        return psycopg2.connect(database_url)
    except psycopg2.OperationalError as exc:
        raise RuntimeError(
            f"Failed to connect to PostgreSQL host {host}:{port}. "
            'This usually means outbound TLS/network access to the Render database is blocked, '
            'or the database is not externally reachable from this machine.'
        ) from exc


def generate_synthetic_training_data(samples: int = 2500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    ticket_ids = [f'SYN-{index:06d}' for index in range(samples)]
    assignment_group_ids = rng.integers(1, 9, size=samples)
    assigned_to_ids = rng.integers(1001, 1041, size=samples)
    category_ids = rng.integers(1, 8, size=samples)
    priority_ids = rng.integers(1, 5, size=samples)
    impact_ids = rng.integers(1, 5, size=samples)
    urgency_ids = rng.integers(1, 5, size=samples)
    reopen_counts = rng.integers(0, 3, size=samples)
    reassignment_counts = rng.integers(0, 3, size=samples)
    durations = np.clip(
        rng.normal(loc=160, scale=90, size=samples)
        + priority_ids * 18
        + reopen_counts * 35
        + reassignment_counts * 25,
        30,
        960,
    )
    ticket_complexity = np.clip(
        category_ids * 1.1 + priority_ids * 1.3 + impact_ids * 0.9 + urgency_ids * 0.8 + reopen_counts * 0.9 + reassignment_counts * 0.7,
        1,
        12,
    )
    agent_fcr_history = np.clip(rng.normal(loc=0.74, scale=0.1, size=samples), 0.25, 0.98)
    category_non_fcr_rate = np.clip(rng.normal(loc=0.24 + (category_ids * 0.02), scale=0.08, size=samples), 0.02, 0.95)

    risk_signal = (
        priority_ids * 0.08
        + (reopen_counts > 0).astype(float) * 0.18
        + (reassignment_counts > 0).astype(float) * 0.12
        + ((durations - 120) / 360).clip(0, 1) * 0.14
        + (ticket_complexity / 12) * 0.16
        + (1 - agent_fcr_history) * 0.2
        + category_non_fcr_rate * 0.12
    )
    non_fcr_prob = np.clip(risk_signal + rng.normal(scale=0.05, size=samples), 0, 1)
    non_fcr_label = (rng.random(samples) < non_fcr_prob).astype(int)

    data = pd.DataFrame({
        'ticket_id': ticket_ids,
        'assignment_group_id': assignment_group_ids,
        'assigned_to_id': assigned_to_ids,
        'category_id': category_ids,
        'priority_id': priority_ids,
        'impact_id': impact_ids,
        'urgency_id': urgency_ids,
        'reopen_count': reopen_counts,
        'reassignment_count': reassignment_counts,
        'duration': np.round(durations, 2),
        'ticket_complexity': np.round(ticket_complexity, 2),
        'agent_fcr_history': np.round(agent_fcr_history, 4),
        'category_non_fcr_rate': np.round(category_non_fcr_rate, 4),
        'non_fcr_label': non_fcr_label,
    })
    return data


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    try:
        conn = get_db_connection()
        try:
            data = pd.read_sql(
                """
                SELECT *
                FROM ml_training_samples
                WHERE is_active = TRUE
                ORDER BY training_sample_id
                """,
                conn,
            )
        finally:
            conn.close()

        if data.empty:
            raise RuntimeError('No active training samples found in ml_training_samples')

        source_label = 'ml_training_samples'
    except RuntimeError as exc:
        print(f"Falling back to synthetic training data: {exc}")
        data = generate_synthetic_training_data()
        source_label = 'synthetic_offline'

    target_column = 'non_fcr_label'
    excluded_columns = {
        'training_sample_id',
        'ticket_id',
        'created_at',
        'generated_at',
        'updated_at',
        'source_type',
        'is_active',
        target_column,
    }
    feature_columns = [column for column in data.columns if column not in excluded_columns]

    x = data[feature_columns].apply(pd.to_numeric, errors='coerce').fillna(-1)
    y = data[target_column].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    model = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('poly', PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)),
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(max_iter=10000, class_weight='balanced')),
    ])
    model.fit(x_train, y_train)

    probabilities = model.predict_proba(x_test)[:, 1]

    thresholds = np.linspace(0.1, 0.9, 81)
    best_threshold = 0.5
    best_f1 = -1.0

    for threshold in thresholds:
        threshold_predictions = (probabilities >= threshold).astype(int)
        threshold_f1 = f1_score(y_test, threshold_predictions, zero_division=0)
        if threshold_f1 > best_f1:
            best_f1 = float(threshold_f1)
            best_threshold = float(threshold)

    best_predictions = (probabilities >= best_threshold).astype(int)

    metrics = {
        'accuracy': round(float(accuracy_score(y_test, best_predictions)), 4),
        'precision': round(float(precision_score(y_test, best_predictions, zero_division=0)), 4),
        'recall': round(float(recall_score(y_test, best_predictions, zero_division=0)), 4),
        'f1': round(float(f1_score(y_test, best_predictions, zero_division=0)), 4),
        'roc_auc': round(float(roc_auc_score(y_test, probabilities)), 4),
        'best_threshold': best_threshold,
        'samples': int(len(data)),
        'train_samples': int(len(x_train)),
        'test_samples': int(len(x_test)),
        'source_table': source_label,
    }

    model_path = MODEL_DIR / 'fcr_model.joblib'
    feature_order_path = MODEL_DIR / 'fcr_feature_order.json'
    threshold_path = MODEL_DIR / 'fcr_threshold.json'
    metrics_path = MODEL_DIR / 'fcr_model_metrics.json'

    joblib.dump(model, model_path)
    feature_order_path.write_text(json.dumps(feature_columns), encoding='utf-8')
    threshold_path.write_text(json.dumps({'threshold': best_threshold}, indent=2), encoding='utf-8')
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding='utf-8')

    print(f'Saved model to {model_path}')
    print(f'Saved feature order to {feature_order_path}')
    print(f'Saved threshold to {threshold_path}')
    print(f'Saved metrics to {metrics_path}')
    print(json.dumps(metrics, indent=2))


if __name__ == '__main__':
    main()
