"""
First-Contact Resolution (FCR) Risk Prediction Module

Loads a trained local model when available and falls back to deterministic heuristics.
"""

import json
from pathlib import Path

import joblib
import numpy as np


class FCRPredictor:
    def __init__(self):
        project_root = Path(__file__).resolve().parents[1]
        model_dir = project_root / 'models'
        self.model_path = model_dir / 'fcr_model.joblib'
        self.feature_order_path = model_dir / 'fcr_feature_order.json'
        self.threshold_path = model_dir / 'fcr_threshold.json'
        self.model = None
        self.feature_order = []
        self.threshold = 0.5
        self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            return

        self.model = joblib.load(self.model_path)

        if self.feature_order_path.exists():
            self.feature_order = json.loads(self.feature_order_path.read_text(encoding='utf-8'))

        if self.threshold_path.exists():
            self.threshold = float(json.loads(self.threshold_path.read_text(encoding='utf-8')).get('threshold', 0.5))

    def _heuristic_risk(self, ticket_features):
        risk_score = 0.2
        risk_score += min(ticket_features.get('priority_id', 3), 5) * 0.06
        risk_score += max(ticket_features.get('reopen_count', 0), 0) * 0.08
        risk_score += max(ticket_features.get('reassignment_count', 0), 0) * 0.06
        risk_score += min(ticket_features.get('duration', 60) / 300, 1) * 0.16
        risk_score += min(ticket_features.get('ticket_complexity', 5) / 12, 1) * 0.12
        risk_score += (1 - min(ticket_features.get('agent_fcr_history', 0.7), 1)) * 0.18
        risk_score += min(ticket_features.get('category_non_fcr_rate', 0.2), 1) * 0.2
        risk_score = float(np.clip(risk_score, 0, 1))
        return risk_score

    def _get_recommendations(self, risk_level):
        recommendations = {
            'low': ['Monitor standard queue', 'Route to standard agent'],
            'medium': ['Consider escalation path', 'Route to experienced agent'],
            'high': ['Assign priority handling', 'Escalate to specialist', 'Consider supervisor approval'],
        }
        return recommendations.get(risk_level, [])

    def predict_fcr_risk(self, ticket_features):
        try:
            if self.model is not None and self.feature_order:
                vector = []
                for feature_name in self.feature_order:
                    if feature_name in ticket_features:
                        value = ticket_features[feature_name]
                    else:
                        value = 0
                    if isinstance(value, str):
                        try:
                            value = float(value)
                        except ValueError:
                            value = 0
                    vector.append(float(value))

                probability = float(self.model.predict_proba(np.array([vector]))[:, 1][0])
                risk_score = float(np.clip(probability, 0, 1))
                threshold = self.threshold
            else:
                risk_score = self._heuristic_risk(ticket_features)
                threshold = 0.5

            risk_level = 'low' if risk_score < 0.33 else 'medium' if risk_score < 0.67 else 'high'
            confidence = round(float(np.clip(0.5 + abs(risk_score - threshold) * 0.5, 0.5, 0.99)), 2)

            risk_score = round(risk_score, 2)
            return {
                'risk_score': risk_score,
                'risk_level': risk_level,
                'confidence': confidence,
                'recommendations': self._get_recommendations(risk_level),
                'drivers': self._build_drivers(ticket_features, risk_score),
            }

        except Exception as exc:
            return {'error': str(exc)}

    def _build_drivers(self, ticket_features, risk_score):
        drivers = []
        if ticket_features.get('priority_id', 0) >= 3:
            drivers.append('High priority complexity')
        if ticket_features.get('reopen_count', 0) > 0:
            drivers.append('Reopened ticket')
        if ticket_features.get('reassignment_count', 0) > 0:
            drivers.append('Multiple handoffs')
        if ticket_features.get('duration', 0) > 180:
            drivers.append('Extended handling time')
        if risk_score >= 0.67:
            drivers.append('Elevated non-FCR likelihood')
        return drivers or ['Stable routing profile']
