from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import joblib
import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, PolynomialFeatures, StandardScaler
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, roc_curve
from xgboost import XGBClassifier


ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH, override=True)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_ROOT / 'ml-service' / 'models'


def normalize_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    host = parsed.hostname or ''
    if host and host not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
        # Use 'prefer' instead of 'require' to handle SSL issues gracefully
        query['sslmode'] = 'prefer'
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


def create_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    engineered = df.copy()
    engineered['duration_per_complexity'] = engineered['duration'] / (engineered['ticket_complexity'] + 1.0)
    engineered['reopen_per_duration'] = engineered['reopen_count'] / (engineered['duration'] + 1.0)
    engineered['reassignment_per_complexity'] = engineered['reassignment_count'] / (engineered['ticket_complexity'] + 1.0)
    engineered['agent_risk_factor'] = 1.0 - engineered['agent_fcr_history']
    return engineered.fillna(0.0)


def build_preprocessor(numeric_features: list, categorical_features: list) -> ColumnTransformer:
    numeric_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('poly', PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)),
        ('scaler', StandardScaler()),
    ])
    categorical_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value=-1)),
        ('onehot', OneHotEncoder(handle_unknown='ignore')), 
    ])

    return ColumnTransformer([
        ('num', numeric_pipeline, numeric_features),
        ('cat', categorical_pipeline, categorical_features),
    ], remainder='drop')


def aggregate_feature_importance(preprocessor: ColumnTransformer, importances: np.ndarray, feature_names: list) -> dict:
    transformed_names = preprocessor.get_feature_names_out(feature_names)
    aggregated = defaultdict(float)

    for name, importance in zip(transformed_names, importances):
        for feature in feature_names:
            if feature in name:
                aggregated[feature] += float(abs(importance))
                break

    return dict(sorted(aggregated.items(), key=lambda item: item[1], reverse=True))


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

    data = data[feature_columns + [target_column]].apply(pd.to_numeric, errors='coerce').fillna(-1)
    data = create_engineered_features(data)

    feature_columns = [column for column in data.columns if column not in {target_column}]
    x = data[feature_columns]
    y = data[target_column].astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.3,
        stratify=y,
        random_state=42,
    )

    categorical_features = [
        'assignment_group_id',
        'category_id',
        'priority_id',
        'impact_id',
        'urgency_id',
    ]
    numeric_features = [feature for feature in feature_columns if feature not in categorical_features]

    scale_pos_weight = 1.0
    positive_weight = int(np.sum(y_train == 1))
    negative_weight = int(np.sum(y_train == 0))
    if positive_weight > 0:
        scale_pos_weight = float(max(1, negative_weight / positive_weight))

    preprocessor = build_preprocessor(numeric_features, categorical_features)

    xgb_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', XGBClassifier(
            objective='binary:logistic',
            eval_metric='auc',
            use_label_encoder=False,
            random_state=42,
            n_jobs=-1,
            scale_pos_weight=scale_pos_weight,
        )),
    ])

    logistic_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(
            max_iter=5000,
            class_weight='balanced',
            random_state=42,
            solver='lbfgs',
        )),
    ])

    candidate_models = [
        (
            'XGBoost Classifier',
            xgb_pipeline,
            {
                'classifier__n_estimators': [100, 150],
                'classifier__max_depth': [3, 5],
                'classifier__learning_rate': [0.05, 0.1],
                'classifier__subsample': [0.8, 1.0],
                'classifier__colsample_bytree': [0.8, 1.0],
            },
        ),
        (
            'Logistic Regression',
            logistic_pipeline,
            {
                'classifier__C': [0.1, 0.5, 1.0, 2.0],
                'classifier__penalty': ['l2'],
            },
        ),
    ]

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    best_model = None
    best_params = {}
    best_model_type = 'XGBoost Classifier'
    best_cv_score = -np.inf

    for model_name, pipeline, param_grid in candidate_models:
        search = GridSearchCV(
            estimator=pipeline,
            param_grid=param_grid,
            scoring='roc_auc',
            cv=cv,
            refit=True,
            n_jobs=-1,
            verbose=0,
        )
        search.fit(x_train, y_train)

        if search.best_score_ > best_cv_score:
            best_cv_score = float(search.best_score_)
            best_model = search.best_estimator_
            best_params = search.best_params_
            best_model_type = model_name

    probabilities = best_model.predict_proba(x_test)[:, 1]

    fpr, tpr, roc_thresholds = roc_curve(y_test, probabilities)
    youden_index = tpr - fpr
    youden_idx = np.argmax(youden_index)
    roc_optimal = roc_thresholds[youden_idx]

    thresholds = np.linspace(max(0.15, roc_optimal - 0.1), min(0.85, roc_optimal + 0.1), 41)
    best_threshold = float(roc_optimal)
    best_f1 = -1.0
    best_threshold_metrics = {}

    for threshold in thresholds:
        threshold_predictions = (probabilities >= threshold).astype(int)
        threshold_f1 = f1_score(y_test, threshold_predictions, zero_division=0)
        if threshold_f1 > best_f1:
            best_f1 = float(threshold_f1)
            best_threshold = float(threshold)
            best_threshold_metrics = {
                'precision': float(precision_score(y_test, threshold_predictions, zero_division=0)),
                'recall': float(recall_score(y_test, threshold_predictions, zero_division=0)),
                'f1': float(threshold_f1),
            }

    best_predictions = (probabilities >= best_threshold).astype(int)
    classifier = best_model.named_steps['classifier']
    feature_importances = {}
    if hasattr(classifier, 'feature_importances_'):
        feature_importances = aggregate_feature_importance(
            best_model.named_steps['preprocessor'],
            classifier.feature_importances_,
            feature_columns,
        )
    elif hasattr(classifier, 'coef_'):
        raw_importances = np.abs(classifier.coef_[0])
        feature_importances = dict(zip(feature_columns, raw_importances.tolist()))

    metrics = {
        'accuracy': round(float(accuracy_score(y_test, best_predictions)), 4),
        'precision': round(float(precision_score(y_test, best_predictions, zero_division=0)), 4),
        'recall': round(float(recall_score(y_test, best_predictions, zero_division=0)), 4),
        'f1': round(float(f1_score(y_test, best_predictions, zero_division=0)), 4),
        'roc_auc': round(float(roc_auc_score(y_test, probabilities)), 4),
        'best_threshold': best_threshold,
        'threshold_metrics': best_threshold_metrics,
        'samples': int(len(data)),
        'train_samples': int(len(x_train)),
        'test_samples': int(len(x_test)),
        'source_table': source_label,
        'model_type': best_model_type,
        'best_params': best_params,
        'cv_score': round(float(best_cv_score), 4),
        'features_count': int(best_model.named_steps['preprocessor'].transform(x_train.iloc[:1]).shape[1]),
    }

    model_path = MODEL_DIR / 'fcr_model.joblib'
    feature_order_path = MODEL_DIR / 'fcr_feature_order.json'
    feature_importance_path = MODEL_DIR / 'fcr_feature_importance.json'
    threshold_path = MODEL_DIR / 'fcr_threshold.json'
    metrics_path = MODEL_DIR / 'fcr_model_metrics.json'

    joblib.dump(best_model, model_path)
    feature_order_path.write_text(json.dumps(feature_columns), encoding='utf-8')
    feature_importance_path.write_text(json.dumps(feature_importances, indent=2), encoding='utf-8')
    threshold_path.write_text(json.dumps({'threshold': best_threshold}, indent=2), encoding='utf-8')
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding='utf-8')

    print(f'✅ Improved FCR model trained and saved to {model_path}')
    print(f'✅ Saved feature order to {feature_order_path}')
    print(f'✅ Saved feature importance to {feature_importance_path}')
    print(f'✅ Saved threshold to {threshold_path}')
    print(f'✅ Saved metrics to {metrics_path}')
    print(json.dumps(metrics, indent=2))


if __name__ == '__main__':
    main()
