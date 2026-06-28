"""
Decision Tree-based strategic action recommendations for HR dashboard.

This model learns a policy from feature-rich team snapshots and produces
stable action recommendations with confidence scores and rationale text.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier


ACTIONS = [
    'Hire',
    'Training',
    'Temporary staffing / reassign',
    'Retain & monitor',
]


BUSINESS_THRESHOLDS = {
    'hire_growth_rate_min': 15.0,
    'hire_load_ratio_min': 1.18,
    'hire_capacity_gap_min': 2.0,
    'hire_sla_max': 88.0,
    'hire_fcr_max': 72.0,
    'hire_avg_resolution_min': 1.8,
    'temp_load_ratio_min': 1.06,
    'temp_load_ratio_max': 1.18,
    'temp_growth_rate_min': 8.0,
    'temp_growth_rate_max': 15.0,
    'temp_sla_min': 88.0,
    'temp_fcr_min': 72.0,
    'training_sla_max': 90.0,
    'training_fcr_max': 75.0,
    'training_avg_resolution_min': 1.8,
    'training_severe_sla_max': 84.0,
    'training_severe_fcr_max': 52.0,
    'training_severe_avg_resolution_min': 3.6,
    'training_load_ratio_min': 1.10,
    'training_growth_rate_min': 10.0,
    'training_capacity_gap_min': 2.0,
    'training_priority_high_sla_max': 82.0,
    'training_priority_high_fcr_max': 50.0,
    'training_priority_high_avg_resolution_min': 4.5,
    'training_priority_high_load_ratio_min': 1.18,
    'training_priority_high_growth_rate_min': 15.0,
    'training_priority_high_capacity_gap_min': 2.0,
    'min_confidence_any_action': 0.55,
    'min_confidence_hire': 0.70,
}


@dataclass
class ActionOutcome:
    impact: str
    followed: str
    not_followed: str
    business_impact: str
    priority: str


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _effective_growth_rate(row: Dict[str, Any], fallback_growth_rate: float) -> float:
    return _to_float(
        row.get('groupGrowthRate', row.get('group_growth_rate', row.get('growthRate', fallback_growth_rate))),
        fallback_growth_rate,
    )


def _policy_label(row: Dict[str, Any], growth_rate: float) -> str:
    growth_rate = _effective_growth_rate(row, growth_rate)
    capacity_gap = max(0.0, _to_float(row.get('capacityGap', row.get('capacity_gap', 0))))
    load_ratio = _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0)
    sla = _to_float(row.get('slaCompliance', row.get('sla_compliance', 0)))
    fcr = _to_float(row.get('fcrRate', row.get('fcr_rate', 0)))
    avg_resolution = _to_float(row.get('avgResolutionTime', row.get('avg_resolution_time', 0)))

    has_hire_quality_pressure = (
        sla < BUSINESS_THRESHOLDS['hire_sla_max']
        or fcr < BUSINESS_THRESHOLDS['hire_fcr_max']
        or avg_resolution > BUSINESS_THRESHOLDS['hire_avg_resolution_min']
    )
    if (
        growth_rate >= BUSINESS_THRESHOLDS['hire_growth_rate_min']
        and load_ratio >= BUSINESS_THRESHOLDS['hire_load_ratio_min']
        and capacity_gap >= BUSINESS_THRESHOLDS['hire_capacity_gap_min']
        and has_hire_quality_pressure
    ):
        return 'Hire'

    in_temp_load_band = (
        BUSINESS_THRESHOLDS['temp_load_ratio_min'] <= load_ratio < BUSINESS_THRESHOLDS['temp_load_ratio_max']
    )
    in_temp_growth_band = (
        BUSINESS_THRESHOLDS['temp_growth_rate_min'] <= growth_rate < BUSINESS_THRESHOLDS['temp_growth_rate_max']
    )
    if (in_temp_load_band or in_temp_growth_band) and sla >= BUSINESS_THRESHOLDS['temp_sla_min'] and fcr >= BUSINESS_THRESHOLDS['temp_fcr_min']:
        return 'Temporary staffing / reassign'

    has_training_quality_pressure = (
        sla < BUSINESS_THRESHOLDS['training_sla_max']
        or fcr < BUSINESS_THRESHOLDS['training_fcr_max']
        or avg_resolution > BUSINESS_THRESHOLDS['training_avg_resolution_min']
    )
    has_severe_training_pressure = (
        sla < BUSINESS_THRESHOLDS['training_severe_sla_max']
        or fcr < BUSINESS_THRESHOLDS['training_severe_fcr_max']
        or avg_resolution > BUSINESS_THRESHOLDS['training_severe_avg_resolution_min']
    )
    has_workload_pressure = (
        load_ratio >= BUSINESS_THRESHOLDS['training_load_ratio_min']
        or growth_rate >= BUSINESS_THRESHOLDS['training_growth_rate_min']
        or capacity_gap >= BUSINESS_THRESHOLDS['training_capacity_gap_min']
    )

    if has_severe_training_pressure or (has_training_quality_pressure and has_workload_pressure):
        return 'Training'

    return 'Retain & monitor'


def _rule_based_action(row: Dict[str, Any], growth_rate: float) -> str:
    """Deterministic business gate used to guard model output in production."""
    return _policy_label(row, growth_rate)


def _model_action_allowed(model_action: str, rule_action: str, confidence: float) -> bool:
    # If confidence is low, force conservative action.
    if confidence < BUSINESS_THRESHOLDS['min_confidence_any_action']:
        return False

    # Hire requires stronger confidence and exact rule gate match.
    if model_action == 'Hire':
        return confidence >= BUSINESS_THRESHOLDS['min_confidence_hire'] and rule_action == 'Hire'

    # Allow non-hire predictions only when they do not conflict with stricter business gates.
    if rule_action == 'Hire' and model_action != 'Hire':
        return False

    return True


def _compute_action_kpi_deltas(action: str, row: Dict[str, Any], growth_rate: float) -> Tuple[float, float, float]:
    """
    Compute expected KPI deltas for a recommendation.

    Returns tuple:
    - sla_delta_points (positive means better)
    - fcr_delta_points (positive means better)
    - resolution_delta_hours (negative means faster)
    """
    growth_rate = _effective_growth_rate(row, growth_rate)
    capacity_gap = max(0.0, _to_float(row.get('capacityGap', row.get('capacity_gap', 0.0))))
    load_ratio = _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0)
    sla = _to_float(row.get('slaCompliance', row.get('sla_compliance', 90.0)), 90.0)
    fcr = _to_float(row.get('fcrRate', row.get('fcr_rate', 75.0)), 75.0)

    # Stress index summarizes demand and quality pressure on the team.
    stress = (
        0.35 * max(0.0, load_ratio - 1.0) / 0.25
        + 0.25 * min(capacity_gap, 4.0) / 4.0
        + 0.20 * max(0.0, 90.0 - sla) / 15.0
        + 0.15 * max(0.0, 75.0 - fcr) / 20.0
        + 0.05 * max(0.0, growth_rate) / 20.0
    )
    stress = min(1.4, max(0.05, stress))

    base_effects = {
        'Hire': (2.2, 1.4, -0.35),
        'Training': (1.0, 2.6, -0.30),
        'Temporary staffing / reassign': (1.6, 1.0, -0.25),
        'Retain & monitor': (0.4, 0.3, -0.08),
    }
    base_sla, base_fcr, base_resolution = base_effects.get(action, (0.3, 0.2, -0.05))

    # Keep effects bounded and readable for dashboard communication.
    sla_delta = min(4.0, max(0.05, base_sla * stress))
    fcr_delta = min(4.0, max(0.05, base_fcr * stress))
    resolution_delta = max(-0.9, min(-0.02, base_resolution * stress))
    return sla_delta, fcr_delta, resolution_delta


def _build_outcome(action: str, team_name: str, capacity_gap: int, row: Dict[str, Any], growth_rate: float) -> ActionOutcome:
    sla_delta, fcr_delta, resolution_delta = _compute_action_kpi_deltas(action, row, growth_rate)
    impact_text = f"+{sla_delta:.2f} pts SLA, +{fcr_delta:.2f} pts FCR, {resolution_delta:.2f}h resolution"

    deterioration_factor = {
        'Hire': 1.0,
        'Training': 0.8,
        'Temporary staffing / reassign': 0.75,
        'Retain & monitor': 0.4,
    }.get(action, 0.6)
    sla_not_followed = -(sla_delta * deterioration_factor)
    fcr_not_followed = -(fcr_delta * deterioration_factor)
    resolution_not_followed = abs(resolution_delta) * deterioration_factor

    if action == 'Hire':
        add_count = max(1, int(capacity_gap))
        return ActionOutcome(
            impact=impact_text,
            followed=(
                f'If followed: add {add_count} agent(s) to {team_name}; expected KPI trend: '
                f'SLA +{sla_delta:.2f} pts, FCR +{fcr_delta:.2f} pts, resolution {resolution_delta:.2f}h.'
            ),
            not_followed=(
                'If not followed: expected KPI trend under sustained pressure: '
                f'SLA {sla_not_followed:.2f} pts, FCR {fcr_not_followed:.2f} pts, '
                f'resolution +{resolution_not_followed:.2f}h.'
            ),
            business_impact='Reduces overload risk and protects service levels during sustained growth.',
            priority='High',
        )

    if action == 'Training':
        row_growth_rate = _effective_growth_rate(row, growth_rate)
        load_ratio = _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0)
        avg_resolution = _to_float(row.get('avgResolutionTime', row.get('avg_resolution_time', 0.0)))
        sla = _to_float(row.get('slaCompliance', row.get('sla_compliance', 0.0)))
        fcr = _to_float(row.get('fcrRate', row.get('fcr_rate', 0.0)))
        severe_quality_pressure = (
            sla < BUSINESS_THRESHOLDS['training_priority_high_sla_max']
            or fcr < BUSINESS_THRESHOLDS['training_priority_high_fcr_max']
            or avg_resolution > BUSINESS_THRESHOLDS['training_priority_high_avg_resolution_min']
        )
        severe_workload_pressure = (
            capacity_gap >= BUSINESS_THRESHOLDS['training_priority_high_capacity_gap_min']
            or load_ratio >= BUSINESS_THRESHOLDS['training_priority_high_load_ratio_min']
            or row_growth_rate >= BUSINESS_THRESHOLDS['training_priority_high_growth_rate_min']
        )
        severe_training_pressure = severe_quality_pressure and severe_workload_pressure

        return ActionOutcome(
            impact=impact_text,
            followed=(
                f'If followed: run coaching for {team_name}; expected KPI trend: '
                f'SLA +{sla_delta:.2f} pts, FCR +{fcr_delta:.2f} pts, resolution {resolution_delta:.2f}h.'
            ),
            not_followed=(
                'If not followed: expected KPI trend with recurring quality issues: '
                f'SLA {sla_not_followed:.2f} pts, FCR {fcr_not_followed:.2f} pts, '
                f'resolution +{resolution_not_followed:.2f}h.'
            ),
            business_impact='Improves first-contact resolution and lowers avoidable rework cost.',
            priority='High' if severe_training_pressure else 'Medium',
        )

    if action == 'Temporary staffing / reassign':
        return ActionOutcome(
            impact=impact_text,
            followed=(
                'If followed: temporary reassignments absorb near-term demand; expected KPI trend: '
                f'SLA +{sla_delta:.2f} pts, FCR +{fcr_delta:.2f} pts, resolution {resolution_delta:.2f}h.'
            ),
            not_followed=(
                'If not followed: expected KPI trend during demand spikes: '
                f'SLA {sla_not_followed:.2f} pts, FCR {fcr_not_followed:.2f} pts, '
                f'resolution +{resolution_not_followed:.2f}h.'
            ),
            business_impact='Covers demand peaks without committing to permanent headcount.',
            priority='Medium',
        )

    return ActionOutcome(
        impact=impact_text,
        followed=(
            'If followed: maintain staffing and monitor signals; expected KPI trend: '
            f'SLA +{sla_delta:.2f} pts, FCR +{fcr_delta:.2f} pts, resolution {resolution_delta:.2f}h.'
        ),
        not_followed=(
            'If not followed: expected KPI drift under unmanaged variability: '
            f'SLA {sla_not_followed:.2f} pts, FCR {fcr_not_followed:.2f} pts, '
            f'resolution +{resolution_not_followed:.2f}h.'
        ),
        business_impact='Maintains stability while preserving hiring flexibility.',
        priority='Low',
    )


class StrategicActionsModel:
    def __init__(self) -> None:
        self.random_state = 42

    def _feature_vector(self, row: Dict[str, Any], growth_rate: float) -> List[float]:
        row_growth_rate = _effective_growth_rate(row, growth_rate)
        return [
            max(0.0, _to_float(row.get('capacityGap', row.get('capacity_gap', 0)))),
            _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0),
            _to_float(row.get('slaCompliance', row.get('sla_compliance', 0))),
            _to_float(row.get('fcrRate', row.get('fcr_rate', 0))),
            _to_float(row.get('avgResolutionTime', row.get('avg_resolution_time', 0))),
            _to_float(row.get('fairnessScore', row.get('fairness_score', 50))),
            _to_float(row.get('currentLoad', row.get('current_load', 0))),
            _to_float(row.get('recommendedLoad', row.get('recommended_load', 0))),
            _to_float(row_growth_rate),
        ]

    def _augment_samples(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        rng = np.random.default_rng(self.random_state)
        augmented = [X]
        labels = [y]

        # Add jittered copies to reduce brittle splits for small real-time batches.
        for _ in range(20):
            noise = rng.normal(loc=0.0, scale=[0.25, 0.02, 1.2, 1.2, 0.08, 1.5, 0.8, 0.8, 0.9], size=X.shape)
            jittered = np.maximum(X + noise, 0)
            augmented.append(jittered)
            labels.append(y)

        return np.vstack(augmented), np.concatenate(labels)

    def recommend(self, groups: List[Dict[str, Any]], growth_rate: float = 0.0) -> Dict[str, Any]:
        if not groups:
            return {
                'recommendations': [],
                'model': {
                    'name': 'decision_tree_policy',
                    'status': 'no_data',
                },
            }

        base_X = np.array([self._feature_vector(row, growth_rate) for row in groups], dtype=float)
        base_y = np.array([_policy_label(row, growth_rate) for row in groups], dtype=object)

        unique_classes = sorted(set(base_y.tolist()))
        if len(unique_classes) < 2:
            results = []
            for row, action in zip(groups, base_y.tolist()):
                team_name = str(row.get('teamName', row.get('team_name', 'Team')))
                capacity_gap = int(max(0, round(_to_float(row.get('capacityGap', 0)))))
                outcome = _build_outcome(action, team_name, capacity_gap, row, growth_rate)
                results.append({
                    'teamName': team_name,
                    'category': 'Hiring' if action == 'Hire' else 'Training' if action == 'Training' else 'Temporary staffing' if action == 'Temporary staffing / reassign' else 'Retention',
                    'action': action,
                    'priority': outcome.priority,
                    'confidence': 1.0,
                    'impact': outcome.impact,
                    'predictedIfFollowed': outcome.followed,
                    'predictedIfNotFollowed': outcome.not_followed,
                    'businessImpact': outcome.business_impact,
                    'computedFrom': {
                        'capacityGap': _to_float(row.get('capacityGap', row.get('capacity_gap', 0))),
                        'loadRatio': _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0),
                        'slaCompliance': _to_float(row.get('slaCompliance', row.get('sla_compliance', 0))),
                        'fcrRate': _to_float(row.get('fcrRate', row.get('fcr_rate', 0))),
                        'avgResolutionTime': _to_float(row.get('avgResolutionTime', row.get('avg_resolution_time', 0))),
                        'groupGrowthRate': _effective_growth_rate(row, growth_rate),
                    },
                    'rationale': 'Only one action class is present in current cohort, so deterministic policy is applied.',
                })
            return {
                'recommendations': results,
                'model': {
                    'name': 'decision_tree_policy',
                    'status': 'single_class',
                    'classes': unique_classes,
                    'training_samples': int(len(base_X)),
                },
            }

        X, y = self._augment_samples(base_X, base_y)

        stratify = y if len(set(y.tolist())) > 1 else None
        test_size = 0.2 if len(y) >= 20 else 0.0
        if test_size > 0:
            X_train, X_test, y_train, y_test = train_test_split(
                X,
                y,
                test_size=test_size,
                random_state=self.random_state,
                stratify=stratify,
            )
        else:
            X_train, y_train = X, y
            X_test, y_test = np.array([]), np.array([])

        model = DecisionTreeClassifier(
            max_depth=4,
            min_samples_leaf=14,
            min_samples_split=30,
            class_weight='balanced',
            random_state=self.random_state,
        )
        model.fit(X_train, y_train)

        val_accuracy = None
        val_f1 = None
        if X_test.size > 0:
            y_pred = model.predict(X_test)
            val_accuracy = float(accuracy_score(y_test, y_pred))
            val_f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))

        proba = model.predict_proba(base_X)
        class_labels = model.classes_.tolist()
        predicted = model.predict(base_X)

        feature_names = [
            'capacity_gap',
            'load_ratio',
            'sla_compliance',
            'fcr_rate',
            'avg_resolution_time',
            'fairness_score',
            'current_load',
            'recommended_load',
            'growth_rate',
        ]
        feature_importance = {
            name: round(float(score), 4)
            for name, score in zip(feature_names, model.feature_importances_)
        }

        results = []
        for idx, (row, action) in enumerate(zip(groups, predicted.tolist())):
            team_name = str(row.get('teamName', row.get('team_name', 'Team')))
            probs = proba[idx]
            confidence = float(np.max(probs))
            confidence = max(0.0, min(1.0, confidence))
            rule_action = _rule_based_action(row, growth_rate)

            if not _model_action_allowed(action, rule_action, confidence):
                action = rule_action if confidence >= BUSINESS_THRESHOLDS['min_confidence_any_action'] else 'Retain & monitor'

            capacity_gap = int(max(0, round(_to_float(row.get('capacityGap', row.get('capacity_gap', 0))))))
            outcome = _build_outcome(action, team_name, capacity_gap, row, growth_rate)

            action_distribution = {
                cls: round(float(p), 4)
                for cls, p in zip(class_labels, probs.tolist())
            }

            top_drivers = sorted(feature_importance.items(), key=lambda kv: kv[1], reverse=True)[:3]
            driver_text = ', '.join([f"{k}={v:.2f}" for k, v in top_drivers])

            results.append({
                'teamName': team_name,
                'category': 'Hiring' if action == 'Hire' else 'Training' if action == 'Training' else 'Temporary staffing' if action == 'Temporary staffing / reassign' else 'Retention',
                'action': action,
                'priority': outcome.priority,
                'confidence': round(confidence, 3),
                'impact': outcome.impact,
                'predictedIfFollowed': outcome.followed,
                'predictedIfNotFollowed': outcome.not_followed,
                'businessImpact': outcome.business_impact,
                'rationale': (
                    f'Decision tree signals: {driver_text}. '
                    f'Business gate selected: {rule_action}.'
                ),
                'computedFrom': {
                    'capacityGap': _to_float(row.get('capacityGap', row.get('capacity_gap', 0))),
                    'loadRatio': _to_float(row.get('loadRatio', row.get('load_ratio', 1.0)), 1.0),
                    'slaCompliance': _to_float(row.get('slaCompliance', row.get('sla_compliance', 0))),
                    'fcrRate': _to_float(row.get('fcrRate', row.get('fcr_rate', 0))),
                    'avgResolutionTime': _to_float(row.get('avgResolutionTime', row.get('avg_resolution_time', 0))),
                    'groupGrowthRate': _effective_growth_rate(row, growth_rate),
                },
                'classProbabilities': action_distribution,
                'ruleAction': rule_action,
            })

        return {
            'recommendations': results,
            'model': {
                'name': 'decision_tree_policy',
                'status': 'trained',
                'classes': class_labels,
                'training_samples': int(len(X_train)),
                'validation_accuracy': round(val_accuracy, 4) if val_accuracy is not None else None,
                'validation_f1_weighted': round(val_f1, 4) if val_f1 is not None else None,
                'feature_importance': feature_importance,
            },
        }
