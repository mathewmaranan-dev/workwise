import json
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, timedelta
from pathlib import Path
from time import monotonic

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from services.data_preprocessing import DataPreprocessor
from services.database_integration import DatabaseConnector
from services.diagnostics import PerformanceDiagnostics
from services.fcr_prediction import FCRPredictor
from services.forecasting import TicketForecast
from services.model_training import ModelTrainer
from services.workload_optimization import WorkloadOptimizer

load_dotenv(dotenv_path=Path(__file__).resolve().parent / '.env', override=True)
if not os.getenv('DATABASE_URL') and os.getenv('\ufeffDATABASE_URL'):
    os.environ['DATABASE_URL'] = os.getenv('\ufeffDATABASE_URL', '')

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

forecast_service = TicketForecast()
workload_optimizer = WorkloadOptimizer()
diagnostics_service = PerformanceDiagnostics()
fcr_predictor = FCRPredictor()
data_preprocessor = DataPreprocessor()
db_connector = DatabaseConnector()
model_trainer = ModelTrainer()

FORECAST_CACHE_TTL_SECONDS = max(0, int(os.getenv('FORECAST_CACHE_TTL_SECONDS', '300')))
_forecast_cache = {}
_forecast_locks = {}
_forecast_locks_guard = threading.Lock()

CATEGORY_ID_MAP = {
    'software': 2,
    'hardware': 3,
    'network': 4,
    'database': 5,
    'printer': 6,
    'access': 7,
    'service': 8,
}


def _get_forecast_lock(cache_key):
    with _forecast_locks_guard:
        if cache_key not in _forecast_locks:
            _forecast_locks[cache_key] = threading.Lock()
        return _forecast_locks[cache_key]


def _build_ticket_dataset(group_id: int, count: int = 30):
    """Build KPI-ready ticket rows from DB data only."""
    days_back = max(int(count), 30)

    try:
        tickets = db_connector.get_tickets(days_back=days_back, group_id=group_id, strict=True)
    except Exception as exc:
        raise RuntimeError(f"Could not load DB tickets for diagnostics: {exc}") from exc

    dataset = []
    for ticket in tickets or []:
        status_value = ticket.get('status')
        if status_value is None:
            # Closed/resolved status IDs in this system map to 5/6.
            status_id = int(ticket.get('status_id') or 0)
            status_value = 'resolved' if status_id in (5, 6) else 'open'

        dataset.append({
            'status': str(status_value).lower(),
            'sla_met': bool(ticket.get('sla_met', ticket.get('made_sla', False))),
            'fcr': bool(ticket.get('fcr', False)),
            'reopen_count': int(ticket.get('reopen_count', 0) or 0),
            'duration': float(ticket.get('duration', 120) or 120),
            'created_at': ticket.get('created_at'),
        })

    return dataset


# ============ HEALTH & STATUS ============

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'ML Service'}), 200


@app.route('/api/ml/forecast/tickets', methods=['POST'])
def forecast_tickets():
    try:
        data = request.get_json(force=True, silent=True) or {}
        raw_group_id = data.get('assignment_group_id', data.get('group_id'))
        group_id = None
        if raw_group_id not in (None, '', 'null', 'None'):
            group_id = int(raw_group_id)

        days_ahead = max(1, int(data.get('days_ahead', 90)))  # Default to 90 days (3 months) instead of 7
        cache_key = (group_id, days_ahead)
        now = monotonic()

        cached = _forecast_cache.get(cache_key)
        if cached and cached.get('expires_at', 0) > now:
            return jsonify(cached['payload']), 200

        lock = _get_forecast_lock(cache_key)
        with lock:
            # Another concurrent request may have populated the cache while we waited.
            cached = _forecast_cache.get(cache_key)
            if cached and cached.get('expires_at', 0) > monotonic():
                return jsonify(cached['payload']), 200

            forecast_result = forecast_service.forecast(group_id, days_ahead=days_ahead)

            if 'error' in forecast_result:
                status_code = 404 if forecast_result.get('code') == 'NO_DB_HISTORY' else 500
                return jsonify({'error': forecast_result['error'], 'code': forecast_result.get('code')}), status_code

            forecast_values = forecast_result['forecast']
            forecast_mean = round(float(sum(forecast_values) / len(forecast_values)), 2) if forecast_values else None

            payload = {
                'group_id': group_id,
                'days_ahead': days_ahead,
                'forecast': forecast_values,
                'forecast_mean': forecast_mean,
                'upper_bound': forecast_result.get('upper_bound', []),
                'lower_bound': forecast_result.get('lower_bound', []),
                'confidence': round(min(0.98, max(0.55, float(forecast_result.get('rsquared', 0)))), 2),
                'model': forecast_result.get('model'),
                'data_source': forecast_result.get('data_source'),
            }

            if FORECAST_CACHE_TTL_SECONDS > 0:
                _forecast_cache[cache_key] = {
                    'expires_at': monotonic() + FORECAST_CACHE_TTL_SECONDS,
                    'payload': payload,
                }

            return jsonify(payload), 200

    except Exception as exc:
        logger.error(f"Forecasting error: {exc}")
        return jsonify({'error': str(exc)}), 500


@app.route('/api/ml/workload/balance', methods=['POST'])
def balance_workload():
    try:
        data = request.get_json(force=True, silent=True) or {}
        group_id = data.get('assignment_group_id')
        target_date = data.get('target_date')

        if group_id is None or not target_date:
            return jsonify({'error': 'Missing required fields'}), 400

        incoming_tickets = int(data.get('incoming_tickets', 8))
        requested_team_members = data.get('team_members', [])

        if not isinstance(requested_team_members, list) or len(requested_team_members) == 0:
            return jsonify({'error': 'team_members required'}), 400

        team_members = requested_team_members

        allocation = workload_optimizer.recommend_distribution(team_members, incoming_tickets)

        return jsonify({
            'group_id': int(group_id),
            'date': target_date,
            'recommendations': allocation['recommendations'],
            'is_balanced': allocation['is_balanced'],
            'optimization_status': allocation.get('optimization_status', 'unknown'),
            'target_load': round(float(allocation['target_load']), 2),
            'current_variance': round(float(allocation.get('current_variance', 0)), 3),
            'fairness_score': round(float(allocation.get('fairness_score', 0)), 3),
            'current_analysis': allocation.get('current_analysis', {}),
            'optimized_analysis': allocation.get('optimized_analysis', {}),
            'predicted_improvements': allocation.get('predicted_improvements', {}),
            'total_reassignments': allocation.get('total_reassignments', 0),
            'implementation_difficulty': allocation.get('implementation_difficulty', 'unknown'),
            'business_impact': allocation.get('business_impact', {}),
        }), 200

    except Exception as exc:
        logger.error(f"Workload balancing error: {exc}")
        return jsonify({'error': str(exc)}), 500


@app.route('/api/ml/diagnostics/performance', methods=['GET'])
def performance_diagnostics():
    try:
        group_id = request.args.get('group_id', type=int)
        period_days = request.args.get('period_days', default=30, type=int)

        if not group_id:
            return jsonify({'error': 'Missing group_id'}), 400

        tickets_data = _build_ticket_dataset(group_id, count=max(period_days, 30))
        if not tickets_data:
            return jsonify({'error': 'No DB ticket history available for diagnostics', 'code': 'NO_DB_HISTORY'}), 404
        diagnostics = diagnostics_service.calculate_kpis(tickets_data)

        team_performance = [
            {
                'name': f'Group {group_id} Core Team',
                'resolution_rate': diagnostics['resolution_rate'],
                'sla_compliance': diagnostics['sla_compliance'],
                'fcr_rate': diagnostics['fcr_rate'],
                'reopen_rate': diagnostics['reopen_rate'],
            }
        ]
        bottlenecks = diagnostics_service.identify_bottlenecks(team_performance)

        daily_counts = {}
        for item in tickets_data:
            created_at = item.get('created_at')
            if created_at is None:
                continue
            day_key = str(created_at)[:10]
            daily_counts[day_key] = daily_counts.get(day_key, 0) + 1

        daily_values = [
            {'date': day, 'value': value}
            for day, value in sorted(daily_counts.items())
        ]
        anomalies = diagnostics_service.detect_performance_anomalies(daily_values)

        return jsonify({
            'group_id': group_id,
            'period_days': period_days,
            'diagnostics': {
                'avg_resolution_time': round(float(sum(item['duration'] for item in tickets_data) / len(tickets_data)), 2),
                'sla_compliance': round(float(diagnostics['sla_compliance']), 2),
                'fcr_rate': round(float(diagnostics['fcr_rate']), 2),
                'resolution_rate': round(float(diagnostics['resolution_rate']), 2),
                'issues': bottlenecks,
                'anomalies': anomalies,
            }
        }), 200

    except Exception as exc:
        logger.error(f"Diagnostics error: {exc}")
        return jsonify({'error': str(exc)}), 500


@app.route('/api/ml/anomalies/detect', methods=['GET'])
def detect_anomalies():
    try:
        group_id = request.args.get('group_id', type=int)
        if not group_id:
            return jsonify({'error': 'Missing group_id'}), 400

        tickets = db_connector.get_tickets(days_back=180, group_id=group_id, strict=True)
        if not tickets:
            return jsonify({'error': 'No DB ticket history available for anomaly detection', 'code': 'NO_DB_HISTORY'}), 404

        daily_counts = {}
        for ticket in tickets:
            created_at = ticket.get('created_at')
            if created_at is None:
                continue
            day_key = str(created_at)[:10]
            daily_counts[day_key] = daily_counts.get(day_key, 0) + 1

        historical_data = [
            {'date': day, 'value': value}
            for day, value in sorted(daily_counts.items())
        ]

        anomalies = diagnostics_service.detect_performance_anomalies(historical_data)
        return jsonify({
            'group_id': group_id,
            'anomalies_detected': anomalies,
            'total_anomalies': len(anomalies),
        }), 200

    except Exception as exc:
        logger.error(f"Anomaly detection error: {exc}")
        return jsonify({'error': str(exc)}), 500


@app.route('/api/ml/fcr/predict', methods=['POST'])
def predict_fcr_risk():
    try:
        data = request.get_json(force=True, silent=True) or {}
        category = data.get('ticket_category')
        priority = data.get('priority')
        group_id = data.get('assigned_group')
        assigned_to_id = data.get('assigned_to_id', data.get('assigned_to', 1))

        if category is None or priority is None or group_id is None:
            return jsonify({'error': 'Missing required fields'}), 400

        category_key = str(category).strip().lower()
        category_id = CATEGORY_ID_MAP.get(category_key, 1)

        ticket_features = {
            'assignment_group_id': int(group_id),
            'assigned_to_id': int(assigned_to_id),
            'category_id': category_id,
            'priority_id': int(priority),
            'impact_id': int(data.get('impact_id', 3)),
            'urgency_id': int(data.get('urgency_id', 2)),
            'reopen_count': int(data.get('reopen_count', 0)),
            'reassignment_count': int(data.get('reassignment_count', 0)),
            'duration': float(data.get('duration', 120)),
            'ticket_complexity': float(data.get('ticket_complexity', 6)),
            'agent_fcr_history': float(data.get('agent_fcr_history', 0.72)),
            'category_non_fcr_rate': float(data.get('category_non_fcr_rate', 0.2)),
        }

        prediction = fcr_predictor.predict_fcr_risk(ticket_features)

        return jsonify({
            'ticket_params': {
                'category': category,
                'priority': priority,
                'group_id': group_id,
                'category_id': category_id,
            },
            'fcr_risk': prediction,
        }), 200

    except Exception as exc:
        logger.error(f"FCR prediction error: {exc}")
        return jsonify({'error': str(exc)}), 500


# ============ NEW ENDPOINTS ============

# FCR Batch Predict
@app.route('/api/ml/fcr/batch-predict', methods=['POST'])
def batch_predict_fcr():
    """Batch predict FCR risk for multiple tickets"""
    try:
        data = request.get_json()
        tickets = data.get('tickets', [])
        
        predictions = []
        for ticket in tickets:
            category = ticket.get('category', 'software')
            category_key = str(category).strip().lower()
            category_id = CATEGORY_ID_MAP.get(category_key, 1)
            
            ticket_features = {
                'assignment_group_id': int(ticket.get('group_id', 1)),
                'category_id': category_id,
                'priority_id': int(ticket.get('priority_id', 3)),
                'reopen_count': int(ticket.get('reopen_count', 0)),
                'reassignment_count': int(ticket.get('reassignment_count', 0)),
                'duration': float(ticket.get('duration', 120)),
                'ticket_complexity': float(ticket.get('ticket_complexity', 6)),
                'agent_fcr_history': float(ticket.get('agent_fcr_history', 0.72)),
                'category_non_fcr_rate': float(ticket.get('category_non_fcr_rate', 0.2)),
            }
            
            prediction = fcr_predictor.predict_fcr_risk(ticket_features)
            predictions.append({
                'ticket_id': ticket.get('ticket_id', f"TICK-{len(predictions)+1}"),
                'prediction': prediction
            })
        
        return jsonify({'predictions': predictions}), 200
    except Exception as exc:
        logger.error(f"Batch FCR prediction error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Workload Analyze
@app.route('/api/ml/workload/analyze', methods=['POST'])
def analyze_workload():
    """Analyze current workload distribution"""
    try:
        data = request.get_json()
        team_members = data.get('team_members', [])
        
        analysis = workload_optimizer.analyze_current_load(team_members)
        
        return jsonify({
            'analysis': analysis,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Workload analysis error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Workload Staffing
@app.route('/api/ml/workload/staffing', methods=['POST'])
def predict_staffing():
    """Predict staffing needs"""
    try:
        data = request.get_json()
        forecast_volume = data.get('forecast_volume', [])
        current_team_size = int(data.get('current_team_size', 5))
        avg_capacity = float(data.get('avg_capacity', 20))
        
        if not forecast_volume:
            return jsonify({'error': 'forecast_volume required'}), 400
        
        staffing = workload_optimizer.predict_staffing_needs(
            forecast_volume, current_team_size, avg_capacity
        )
        
        return jsonify({
            'staffing_prediction': staffing,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Staffing prediction error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Diagnostics KPIs
@app.route('/api/ml/diagnostics/kpis', methods=['POST'])
def get_kpis():
    """Calculate performance KPIs"""
    try:
        data = request.get_json()
        tickets = data.get('tickets', [])
        
        if not tickets:
            return jsonify({'error': 'tickets required'}), 400
        
        kpis = diagnostics_service.calculate_kpis(tickets)
        
        return jsonify({
            'kpis': kpis,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"KPI calculation error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Diagnostics Imbalance
@app.route('/api/ml/diagnostics/imbalance', methods=['POST'])
def detect_imbalance():
    """Detect workload imbalances"""
    try:
        data = request.get_json()
        employee_workloads = data.get('employee_workloads', [])
        
        if not employee_workloads:
            return jsonify({'error': 'employee_workloads required'}), 400
        
        imbalance = diagnostics_service.detect_workload_imbalance(employee_workloads)
        
        return jsonify({
            'imbalance_analysis': imbalance,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Imbalance detection error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Diagnostics Bottlenecks
@app.route('/api/ml/diagnostics/bottlenecks', methods=['POST'])
def identify_bottlenecks():
    """Identify performance bottlenecks"""
    try:
        data = request.get_json()
        team_performance = data.get('team_performance', [])
        
        if not team_performance:
            return jsonify({'error': 'team_performance required'}), 400
        
        bottlenecks = diagnostics_service.identify_bottlenecks(team_performance)
        
        return jsonify({
            'bottlenecks': bottlenecks,
            'count': len(bottlenecks),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Bottleneck identification error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Diagnostics FCR Drivers
@app.route('/api/ml/diagnostics/fcr-drivers', methods=['POST'])
def analyze_fcr_drivers():
    """Analyze Non-FCR drivers"""
    try:
        data = request.get_json()
        tickets = data.get('tickets', [])
        
        if not tickets:
            return jsonify({'error': 'tickets required'}), 400
        
        drivers = diagnostics_service.detect_non_fcr_drivers(tickets)
        
        return jsonify({
            'fcr_drivers': drivers,
            'count': len(drivers),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"FCR driver analysis error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Diagnostics Anomalies (updated endpoint)
@app.route('/api/ml/diagnostics/anomalies', methods=['POST'])
def detect_performance_anomalies():
    """Detect performance anomalies"""
    try:
        data = request.get_json()
        historical_data = data.get('historical_data', [])
        
        if not historical_data:
            return jsonify({'error': 'historical_data required'}), 400
        
        anomalies = diagnostics_service.detect_performance_anomalies(historical_data)
        
        return jsonify({
            'anomalies': anomalies,
            'count': len(anomalies),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as exc:
        logger.error(f"Anomaly detection error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Retrain Non-FCR model with the current training pipeline
@app.route('/api/ml/training/retrain', methods=['POST'])
def retrain_model():
    """Run the current training pipeline and refresh model metrics."""
    try:
        project_root = Path(__file__).resolve().parent
        result = subprocess.run(
            [sys.executable, 'train_fcr_model.py'],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=1200,
        )

        metrics_path = project_root / 'models' / 'fcr_model_metrics.json'
        metrics = {}
        if metrics_path.exists():
            import json
            metrics = json.loads(metrics_path.read_text(encoding='utf-8'))

        return jsonify({
            'status': 'ok' if result.returncode == 0 else 'error',
            'returncode': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'metrics': metrics,
            'timestamp': datetime.utcnow().isoformat(),
        }), 200 if result.returncode == 0 else 500
    except Exception as exc:
        logger.error(f"Retraining error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Model Training Summary
@app.route('/api/ml/training/summary', methods=['GET'])
def training_summary():
    """Get trained model information"""
    try:
        fcr_model_type = 'FCR Model'
        metrics_path = Path('models') / 'fcr_model_metrics.json'
        if metrics_path.exists():
            try:
                metrics = json.loads(metrics_path.read_text(encoding='utf-8'))
                fcr_model_type = metrics.get('model_type', fcr_model_type)
            except Exception:
                pass

        summary = {
            'fcr_model': {
                'status': 'trained' if os.path.exists('models/fcr_model.joblib') else 'untrained',
                'model_type': fcr_model_type,
                'feature_importance': model_trainer.get_feature_importance('fcr') or {}
            },
            'workload_model': {
                'status': 'trained' if os.path.exists('models/workload_model.joblib') else 'untrained',
                'model_type': 'GradientBoosting Regressor',
                'feature_importance': model_trainer.get_feature_importance('workload') or {}
            },
            'last_updated': datetime.utcnow().isoformat()
        }
        
        return jsonify(summary), 200
    except Exception as exc:
        logger.error(f"Training summary error: {exc}")
        return jsonify({'error': str(exc)}), 500


# ML Service Status
@app.route('/api/ml/status', methods=['GET'])
def ml_status():
    """Get ML service status"""
    try:
        status = {
            'service': 'Work-Wise ML Service',
            'status': 'operational',
            'models_loaded': {
                'fcr_model': fcr_predictor.model is not None,
                'workload_model': hasattr(workload_optimizer, 'model') and workload_optimizer.model is not None
            },
            'services': {
                'diagnostics': True,
                'forecasting': True,
                'workload_optimization': True,
                'fcr_prediction': True
            },
            'database': {
                'status': 'configured',
                'url': 'postgresql://***'
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(status), 200
    except Exception as exc:
        logger.error(f"Status check error: {exc}")
        return jsonify({'error': str(exc)}), 500


# Legacy anomaly endpoint removed; use POST /api/ml/diagnostics/anomalies


# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found', 'status': 404}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error', 'status': 500}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT') or os.getenv('ML_PORT', 5001))
    debug = os.getenv('NODE_ENV', 'development') == 'development'

    logger.info(f"🚀 ML Service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
