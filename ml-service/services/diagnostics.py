"""
Performance Diagnostics Module

Analyzes performance metrics and identifies issues and anomalies
"""

import numpy as np
from sklearn.ensemble import IsolationForest

class PerformanceDiagnostics:
    def __init__(self):
        self.anomaly_detector = IsolationForest(random_state=42, contamination=0.1)
    
    def calculate_kpis(self, tickets_data):
        """
        Calculate key performance indicators
        """
        total = len(tickets_data)
        resolved = len([t for t in tickets_data if t['status'] == 'resolved'])
        sla_met = len([t for t in tickets_data if t.get('sla_met', False)])
        fcr = len([t for t in tickets_data if t.get('fcr', False)])
        
        return {
            'total_tickets': total,
            'resolution_rate': (resolved / total * 100) if total > 0 else 0,
            'sla_compliance': (sla_met / total * 100) if total > 0 else 0,
            'fcr_rate': (fcr / total * 100) if total > 0 else 0
        }
    
    def identify_bottlenecks(self, team_performance):
        """
        Identify performance bottlenecks
        """
        bottlenecks = []
        
        for team in team_performance:
            if team['resolution_rate'] < 70:
                bottlenecks.append({
                    'team': team['name'],
                    'issue': 'Low resolution rate',
                    'value': team['resolution_rate'],
                    'severity': 'high',
                    'recommendation': 'Review ticket complexity or provide training'
                })
            
            if team['sla_compliance'] < 85:
                bottlenecks.append({
                    'team': team['name'],
                    'issue': 'SLA compliance below threshold',
                    'value': team['sla_compliance'],
                    'severity': 'high',
                    'recommendation': 'Increase staffing or optimize processes'
                })
        
        return bottlenecks
    
    def detect_performance_anomalies(self, historical_data):
        """
        Detect anomalies in performance metrics using Isolation Forest
        """
        try:
            # Prepare data
            values = np.array([d['value'] for d in historical_data]).reshape(-1, 1)
            
            # Detect anomalies
            predictions = self.anomaly_detector.fit_predict(values)
            
            anomalies = []
            for i, pred in enumerate(predictions):
                if pred == -1:  # Anomaly detected
                    anomalies.append({
                        'date': historical_data[i]['date'],
                        'value': historical_data[i]['value'],
                        'expected_range': (np.mean(values) - np.std(values), 
                                          np.mean(values) + np.std(values))
                    })
            
            return anomalies
        
        except Exception as e:
            return {'error': str(e)}
