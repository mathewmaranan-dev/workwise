import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import logging

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DB_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    """Create a database connection"""
    try:
        conn = psycopg2.connect(DB_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'OK', 'service': 'ML Service'}), 200

@app.route('/api/ml/forecast/tickets', methods=['POST'])
def forecast_tickets():
    """
    Forecast ticket volume for the next period
    Expected body: {
        "assignment_group_id": int,
        "days_ahead": int (default: 7)
    }
    """
    try:
        data = request.json
        group_id = data.get('assignment_group_id')
        days_ahead = data.get('days_ahead', 7)

        if not group_id:
            return jsonify({'error': 'Missing assignment_group_id'}), 400

        # TODO: Implement ticket forecasting using time-series models
        # This will use historical data to predict future ticket volumes
        
        return jsonify({
            'group_id': group_id,
            'days_ahead': days_ahead,
            'forecast': {
                'mean': 45.5,
                'upper_bound': 52.3,
                'lower_bound': 38.7
            },
            'confidence': 0.87,
            'model': 'ARIMA'
        }), 200

    except Exception as e:
        logger.error(f"Forecasting error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/workload/balance', methods=['POST'])
def balance_workload():
    """
    Analyze and recommend workload balancing
    Expected body: {
        "assignment_group_id": int,
        "target_date": "YYYY-MM-DD"
    }
    """
    try:
        data = request.json
        group_id = data.get('assignment_group_id')
        target_date = data.get('target_date')

        if not group_id or not target_date:
            return jsonify({'error': 'Missing required fields'}), 400

        # TODO: Implement workload balancing algorithm
        # Uses clustering and load balancing ML models
        
        return jsonify({
            'group_id': group_id,
            'date': target_date,
            'recommendations': [
                {
                    'user_id': 1,
                    'current_load': 12,
                    'recommended_load': 10,
                    'adjustment': -2,
                    'confidence': 0.92
                }
            ],
            'is_balanced': False
        }), 200

    except Exception as e:
        logger.error(f"Workload balancing error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/diagnostics/performance', methods=['GET'])
def performance_diagnostics():
    """
    Analyze team performance and identify issues
    Query params:
        ?group_id=int - Assignment group ID
        ?period_days=int - Analysis period (default: 30)
    """
    try:
        group_id = request.args.get('group_id', type=int)
        period_days = request.args.get('period_days', default=30, type=int)

        if not group_id:
            return jsonify({'error': 'Missing group_id'}), 400

        # TODO: Implement performance diagnostics
        # Identify bottlenecks, inefficiencies, and anomalies
        
        return jsonify({
            'group_id': group_id,
            'period_days': period_days,
            'diagnostics': {
                'avg_resolution_time': 4.5,
                'sla_compliance': 94.2,
                'fcr_rate': 71.3,
                'issues': [
                    {
                        'issue': 'High resolution time for database tickets',
                        'severity': 'high',
                        'recommendation': 'Provide additional training for DB team'
                    }
                ]
            }
        }), 200

    except Exception as e:
        logger.error(f"Diagnostics error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/anomalies/detect', methods=['GET'])
def detect_anomalies():
    """
    Detect anomalies in ticket data and performance
    Query params:
        ?group_id=int - Assignment group ID (optional)
    """
    try:
        group_id = request.args.get('group_id', type=int)

        # TODO: Implement anomaly detection
        # Use isolation forest or other anomaly detection algorithms
        
        return jsonify({
            'anomalies_detected': [
                {
                    'type': 'unusual_spike',
                    'date': '2026-05-03',
                    'value': 150,
                    'expected_value': 45,
                    'severity': 'high'
                }
            ],
            'total_anomalies': 1
        }), 200

    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml/fcr/predict', methods=['POST'])
def predict_fcr_risk():
    """
    Predict likelihood of first-contact resolution issues
    Expected body: {
        "ticket_category": str,
        "priority": str,
        "assigned_group": int
    }
    """
    try:
        data = request.json
        category = data.get('ticket_category')
        priority = data.get('priority')
        group_id = data.get('assigned_group')

        if not all([category, priority, group_id]):
            return jsonify({'error': 'Missing required fields'}), 400

        # TODO: Implement FCR prediction model
        # Classification model to predict non-FCR risk

        return jsonify({
            'ticket_params': {
                'category': category,
                'priority': priority,
                'group_id': group_id
            },
            'fcr_risk': {
                'risk_score': 0.67,
                'risk_level': 'high',
                'recommendation': 'Consider escalation or additional resources',
                'confidence': 0.89
            }
        }), 200

    except Exception as e:
        logger.error(f"FCR prediction error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('ML_PORT', 5001))
    debug = os.getenv('NODE_ENV', 'development') == 'development'
    
    logger.info(f"🚀 ML Service starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
