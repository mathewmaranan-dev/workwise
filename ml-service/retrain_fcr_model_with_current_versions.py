#!/usr/bin/env python3
"""
Retrain FCR Model with Current Package Versions

This script retrains the FCR model using the CURRENT versions of sklearn (1.7.2) and XGBoost (2.1.4)
to fix the InconsistentVersionWarning issue causing confidence to drop from 91% to 62%.

The original models were pickled with sklearn 1.3.2 and are now being loaded with 1.7.2,
which causes incorrect predictions and lower confidence scores.

Usage:
    python retrain_fcr_model_with_current_versions.py
    
This will:
1. Download training data from the database (or use synthetic if unavailable)
2. Train a new FCR model with sklearn 1.7.2 and XGBoost 2.1.4
3. Save the model to ml-service/models/fcr_model.joblib
4. Save metadata (feature order, threshold, feature importance)
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, PolynomialFeatures, StandardScaler
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, roc_curve
from xgboost import XGBClassifier

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH, override=True)

PROJECT_ROOT = Path(__file__).resolve().parent
MODEL_DIR = PROJECT_ROOT / 'models'


def normalize_database_url(database_url: str) -> str:
    """Normalize DATABASE_URL with SSL preference instead of requirement."""
    parsed = urlsplit(database_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    host = parsed.hostname or ''
    if host and host not in {'localhost', '127.0.0.1'} and 'sslmode' not in query:
        # Use 'prefer' instead of 'require' to handle SSL issues gracefully
        query['sslmode'] = 'prefer'
    normalized_query = urlencode(query)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, normalized_query, parsed.fragment))


def get_db_connection():
    """Get database connection."""
    try:
        import psycopg2
    except ImportError:
        logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
        return None
    
    load_dotenv(ENV_PATH, override=True)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.warning('DATABASE_URL not set. Will use synthetic training data.')
        return None
    
    parsed = urlsplit(database_url)
    host = parsed.hostname or 'unknown'
    port = parsed.port or 5432
    logger.info(f"Attempting to connect to {host}:{port}...")
    
    database_url = normalize_database_url(database_url)
    try:
        conn = psycopg2.connect(database_url)
        logger.info("✅ Database connected")
        return conn
    except Exception as e:
        logger.warning(f"⚠️  Database connection failed: {e}. Will use synthetic training data.")
        return None


def fetch_production_training_data(conn) -> pd.DataFrame | None:
    """Fetch real training data from database."""
    if not conn:
        return None
    
    try:
        query = """
        SELECT 
            t.ticket_id,
            t.assignment_group_id,
            t.assigned_to_id,
            t.category_id,
            t.priority_id,
            t.impact_id,
            t.urgency_id,
            t.reopen_count,
            t.reassignment_count,
            EXTRACT(EPOCH FROM (COALESCE(t.resolved_date, NOW()) - t.created_date))/3600 AS duration_hours,
            COALESCE(u.experience_level, 1) AS agent_experience_level,
            CASE WHEN t.fcr = true THEN 0 ELSE 1 END AS non_fcr_label
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to_id = u.id
        WHERE t.created_date >= NOW() - INTERVAL '365 days'
            AND t.assigned_to_id IS NOT NULL
            AND t.priority_id IS NOT NULL
        LIMIT 5000
        """
        
        df = pd.read_sql(query, conn)
        logger.info(f"✅ Fetched {len(df)} production training samples from database")
        return df
    except Exception as e:
        logger.warning(f"Could not fetch production data: {e}. Will use synthetic data.")
        return None


def generate_synthetic_training_data(samples: int = 2500, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic training data for FCR prediction."""
    np.random.seed(seed)
    rng = np.random.default_rng(seed)

    ticket_ids = [f'SYN-{i:06d}' for i in range(samples)]
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
        category_ids * 1.1 + priority_ids * 1.3 + impact_ids * 0.9 + urgency_ids * 0.8,
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

    return pd.DataFrame({
        'ticket_id': ticket_ids,
        'assignment_group_id': assignment_group_ids,
        'assigned_to_id': assigned_to_ids,
        'category_id': category_ids,
        'priority_id': priority_ids,
        'impact_id': impact_ids,
        'urgency_id': urgency_ids,
        'reopen_count': reopen_counts,
        'reassignment_count': reassignment_counts,
        'duration_hours': durations,
        'agent_experience_level': rng.integers(1, 5, size=samples),
        'non_fcr_label': non_fcr_label,
    })


def train_fcr_model(df: pd.DataFrame) -> tuple[Pipeline, list[str], float, dict[str, float]]:
    """Train FCR risk prediction model."""
    logger.info(f"Training FCR model with {len(df)} samples using sklearn 1.7.2 and XGBoost 2.1.4...")
    
    feature_cols = [
        'assignment_group_id', 'category_id', 'priority_id', 'impact_id', 'urgency_id',
        'reopen_count', 'reassignment_count', 'duration_hours', 'agent_experience_level'
    ]
    
    X = df[feature_cols].copy()
    y = df['non_fcr_label'].copy()
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    numeric_features = ['duration_hours', 'reopen_count', 'reassignment_count', 'agent_experience_level']
    categorical_features = ['assignment_group_id', 'category_id', 'priority_id', 'impact_id', 'urgency_id']
    
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('poly', PolynomialFeatures(degree=2, include_bias=False))
    ])
    
    categorical_transformer = Pipeline(steps=[
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ]
    )
    
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', XGBClassifier(
            n_estimators=150,
            learning_rate=0.08,
            max_depth=5,
            random_state=42,
            verbosity=0,
            eval_metric='logloss'
        ))
    ])
    
    pipeline.fit(X_train, y_train)
    
    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    
    fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
    optimal_idx = np.argmax(tpr - fpr)
    optimal_threshold = thresholds[optimal_idx]
    
    logger.info(f"✅ Model trained successfully!")
    logger.info(f"   Accuracy:  {accuracy:.4f}")
    logger.info(f"   Precision: {precision:.4f}")
    logger.info(f"   Recall:    {recall:.4f}")
    logger.info(f"   F1-Score:  {f1:.4f}")
    logger.info(f"   ROC-AUC:   {roc_auc:.4f}")
    logger.info(f"   Optimal Threshold: {optimal_threshold:.4f}")
    
    return pipeline, feature_cols, optimal_threshold, {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'roc_auc': roc_auc,
    }


def main():
    """Main retrain workflow."""
    logger.info("=" * 70)
    logger.info("FCR Model Retraining with Current Package Versions")
    logger.info("sklearn: 1.7.2 | XGBoost: 2.1.4")
    logger.info("=" * 70)
    
    # Create models directory
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get training data
    conn = get_db_connection()
    df = fetch_production_training_data(conn) if conn else None
    
    if df is None or df.empty:
        logger.info("Using synthetic training data...")
        df = generate_synthetic_training_data(samples=2500)
    else:
        logger.info(f"Using {len(df)} production samples")
    
    if conn:
        conn.close()
    
    # Train model
    model, feature_cols, threshold, metrics = train_fcr_model(df)
    
    # Save model and metadata
    model_path = MODEL_DIR / 'fcr_model.joblib'
    feature_order_path = MODEL_DIR / 'fcr_feature_order.json'
    threshold_path = MODEL_DIR / 'fcr_threshold.json'
    metrics_path = MODEL_DIR / 'fcr_model_metrics.json'
    
    joblib.dump(model, model_path)
    logger.info(f"✅ Model saved to {model_path}")
    
    with open(feature_order_path, 'w') as f:
        json.dump(feature_cols, f, indent=2)
    logger.info(f"✅ Feature order saved to {feature_order_path}")
    
    with open(threshold_path, 'w') as f:
        json.dump({'threshold': float(threshold)}, f, indent=2)
    logger.info(f"✅ Threshold saved to {threshold_path}")
    
    with open(metrics_path, 'w') as f:
        # Convert numpy floats to Python floats for JSON serialization
        metrics_serializable = {k: float(v) for k, v in metrics.items()}
        json.dump(metrics_serializable, f, indent=2)
    logger.info(f"✅ Metrics saved to {metrics_path}")
    
    logger.info("=" * 70)
    logger.info("Retraining complete! The model is now compatible with:")
    logger.info("  - sklearn 1.7.2")
    logger.info("  - XGBoost 2.1.4")
    logger.info("  - statsmodels 0.14.4")
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Verify model works locally with: python test_fcr_locally.py")
    logger.info("  2. Commit and push changes to GitHub")
    logger.info("  3. Deploy to Render (models will be included)")
    logger.info("  4. Verify confidence returns to ~91%")
    logger.info("=" * 70)


if __name__ == '__main__':
    main()
