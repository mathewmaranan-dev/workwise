import logging
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from services.diagnostics import PerformanceDiagnostics
from services.fcr_prediction import FCRPredictor
from services.forecasting import TicketForecast
from services.workload_optimization import WorkloadOptimizer

load_dotenv()

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

forecast_service = TicketForecast()
workload_optimizer = WorkloadOptimizer()
diagnostics_service = PerformanceDiagnostics()
fcr_predictor = FCRPredictor()

CATEGORY_ID_MAP = {
    'software': 2,
    'hardware': 3,
    'network': 4,
    'database': 5,
    'printer': 6,
    'access': 7,
    'service': 8,
}


def _build_ticket_dataset(group_id, count=30):
    tickets = []
    for index in range(count):
        resolution_time = 90 + (group_id * 6) + (index * 4) % 120
        status = 'resolved' if index % 4 else 'open'
        tickets.append({
            'ticket_id': f'TICK-{group_id}-{index:03d}',
            'status': status,
            'sla_met': index % 5 != 0,
            'fcr': index % 3 != 0,
            'created_at': (datetime.utcnow() - timedelta(days=index)).isoformat(),
            'duration': resolution_time,
            'priority': (index % 5) + 1,
            'reopen_count': 1 if index % 9 == 0 else 0,
            'reassignment_count': 1 if index % 12 == 0 else 0,
        })
    return tickets


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'ML Service'}), 200


@app.route('/api/ml/forecast/tickets', methods=['POST'])
def forecast_tickets():
    try:
        data = request.get_json(force=True, silent=True) or {}
        group_id = data.get('assignment_group_id')
        days_ahead = int(data.get('days_ahead', 7))

        if group_id is None:
            return jsonify({'error': 'Missing assignment_group_id'}), 400

        forecast_result = forecast_service.forecast(int(group_id), days_ahead=days_ahead)
        if 'error' in forecast_result:
            return jsonify({'error': forecast_result['error']}), 500

        forecast_values = forecast_result['forecast']
        forecast_summary = {
            'mean': round(float(sum(forecast_values) / len(forecast_values)), 2),
            'upper_bound': round(float(max(forecast_result['upper_bound'])), 2),
            'lower_bound': round(float(min(forecast_result['lower_bound'])), 2),
        }

        return jsonify({
            'group_id': int(group_id),
            'days_ahead': days_ahead,
            'forecast': forecast_summary,
            'confidence': round(min(0.98, max(0.55, float(forecast_result['rsquared']))), 2),
            'model': forecast_result['model'],
        }), 200

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

        team_members = [
            {'user_id': int(group_id * 100 + offset), 'current_tickets': int((group_id + offset) * 2 + 5)}
            for offset in range(5)
        ]
        incoming_tickets = int(data.get('incoming_tickets', 8))
        allocation = workload_optimizer.recommend_distribution(team_members, incoming_tickets)

        return jsonify({
            'group_id': int(group_id),
            'date': target_date,
            'recommendations': allocation['recommendations'],
            'is_balanced': allocation['is_balanced'],
            'target_load': round(float(allocation['target_load']), 2),
            'current_variance': round(float(allocation['current_variance']), 3),
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
        diagnostics = diagnostics_service.calculate_kpis(tickets_data)

        team_performance = [
            {
                'name': f'Group {group_id} Core Team',
                'resolution_rate': max(65, diagnostics['resolution_rate'] - 5),
                'sla_compliance': max(80, diagnostics['sla_compliance'] - 2),
            }
        ]
        bottlenecks = diagnostics_service.identify_bottlenecks(team_performance)

        daily_values = []
        for index in range(14):
            daily_values.append({
                'date': (datetime.utcnow() - timedelta(days=index)).strftime('%Y-%m-%d'),
                'value': 25 + (index % 5) * 5 + (5 if index == 0 else 0),
            })
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
        base = 40 + (group_id or 1) * 3
        historical_data = []
        for index in range(14):
            spike = 20 if index == 4 else 0
            historical_data.append({
                'date': (datetime.utcnow() - timedelta(days=index)).strftime('%Y-%m-%d'),
                'value': base + index * 2 + spike,
            })

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

        if category is None or priority is None or group_id is None:
            return jsonify({'error': 'Missing required fields'}), 400

        category_key = str(category).strip().lower()
        category_id = CATEGORY_ID_MAP.get(category_key, 1)

        ticket_features = {
            'assignment_group_id': int(group_id),
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


if __name__ == '__main__':
    port = int(os.getenv('ML_PORT', 5001))
    debug = os.getenv('NODE_ENV', 'development') == 'development'

    logger.info(f"🚀 ML Service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
