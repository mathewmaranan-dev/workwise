"""
Performance Diagnostics Module

Analyzes performance metrics, identifies issues, anomalies, and workload imbalances
"""

import logging
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)


class PerformanceDiagnostics:
    """Comprehensive performance diagnostics and anomaly detection"""
    
    def __init__(self):
        self.anomaly_detector = IsolationForest(random_state=42, contamination=0.1)
        self.fairness_threshold = 0.25  # 25% workload ratio difference threshold
    
    def calculate_kpis(self, tickets_data: List[Dict]) -> Dict[str, float]:
        """
        Calculate key performance indicators
        
        Args:
            tickets_data: List of ticket dictionaries
            
        Returns:
            Dictionary with KPI values
        """
        total = len(tickets_data)
        resolved = len([t for t in tickets_data if t['status'] == 'resolved'])
        sla_met = len([t for t in tickets_data if t.get('sla_met', False)])
        fcr = len([t for t in tickets_data if t.get('fcr', False)])
        reopened = sum([t.get('reopen_count', 0) for t in tickets_data])
        
        return {
            'total_tickets': total,
            'resolution_rate': (resolved / total * 100) if total > 0 else 0,
            'sla_compliance': (sla_met / total * 100) if total > 0 else 0,
            'fcr_rate': (fcr / total * 100) if total > 0 else 0,
            'reopen_rate': (reopened / total * 100) if total > 0 else 0,
            'avg_resolution_time': np.mean([t.get('duration', 0) for t in tickets_data]) if total > 0 else 0,
        }
    
    def identify_bottlenecks(self, team_performance: List[Dict]) -> List[Dict[str, Any]]:
        """
        Identify performance bottlenecks and issues
        
        Args:
            team_performance: List of team/employee performance data
            
        Returns:
            List of bottleneck issues with severity and recommendations
        """
        bottlenecks = []
        
        for team in team_performance:
            # Resolution rate check
            resolution_rate = team.get('resolution_rate', 0)
            if resolution_rate < 70:
                bottlenecks.append({
                    'team': team.get('name', 'Unknown'),
                    'issue': 'Low resolution rate',
                    'value': resolution_rate,
                    'severity': 'high',
                    'recommendation': 'Review ticket complexity, provide targeted training, or increase staffing'
                })
            
            # SLA compliance check
            sla_compliance = team.get('sla_compliance', 100)
            if sla_compliance < 85:
                bottlenecks.append({
                    'team': team.get('name', 'Unknown'),
                    'issue': 'SLA compliance below threshold',
                    'value': sla_compliance,
                    'severity': 'high',
                    'recommendation': 'Increase staffing, optimize processes, or reallocate high-complexity tickets'
                })
            
            # FCR rate check
            fcr_rate = team.get('fcr_rate', 0)
            if fcr_rate < 65:
                bottlenecks.append({
                    'team': team.get('name', 'Unknown'),
                    'issue': 'Low First-Contact Resolution rate',
                    'value': fcr_rate,
                    'severity': 'medium',
                    'recommendation': 'Provide product/process training, review knowledge base'
                })
            
            # Reopen rate check
            reopen_rate = team.get('reopen_rate', 0)
            if reopen_rate > 15:
                bottlenecks.append({
                    'team': team.get('name', 'Unknown'),
                    'issue': 'High ticket reopen rate',
                    'value': reopen_rate,
                    'severity': 'medium',
                    'recommendation': 'Review quality of resolutions, implement peer review process'
                })
        
        return bottlenecks
    
    def detect_performance_anomalies(self, historical_data: List[Dict]) -> List[Dict[str, Any]]:
        """
        Detect anomalies in performance metrics using Isolation Forest
        
        Args:
            historical_data: List of historical performance records
            
        Returns:
            List of detected anomalies
        """
        try:
            if not historical_data or len(historical_data) < 5:
                return []
            
            # Prepare data
            values = np.array([float(d.get('value', 0)) for d in historical_data]).reshape(-1, 1)
            
            # Detect anomalies
            predictions = self.anomaly_detector.fit_predict(values)
            
            anomalies = []
            mean_val = np.mean(values)
            std_val = np.std(values)
            
            for i, pred in enumerate(predictions):
                if pred == -1:  # Anomaly detected
                    anomaly = {
                        'date': historical_data[i].get('date', 'Unknown'),
                        'value': float(values[i][0]),
                        'expected_range': (float(mean_val - 2 * std_val), float(mean_val + 2 * std_val)),
                        'deviation': float((values[i][0] - mean_val) / std_val) if std_val > 0 else 0,
                        'severity': 'high' if abs(values[i][0] - mean_val) > 3 * std_val else 'medium'
                    }
                    anomalies.append(anomaly)
            
            return anomalies
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return []
    
    def detect_workload_imbalance(self, employee_workloads: List[Dict]) -> Dict[str, Any]:
        """
        Detect workload imbalances across employees
        
        Args:
            employee_workloads: List of employee workload data
            
        Returns:
            Dictionary with imbalance analysis and recommendations
        """
        try:
            if not employee_workloads:
                return {'imbalanced': False, 'details': 'No data'}
            
            workloads = [float(e.get('current_workload', 0)) for e in employee_workloads]
            
            if len(workloads) < 2 or all(w == 0 for w in workloads):
                return {'imbalanced': False, 'imbalance_ratio': 0, 'details': 'Insufficient data'}
            
            # Calculate statistics
            mean_workload = np.mean(workloads)
            max_workload = np.max(workloads)
            min_workload = np.min(workloads)
            std_workload = np.std(workloads)
            
            # Imbalance ratio (max/min, normalized)
            if min_workload > 0:
                imbalance_ratio = (max_workload / min_workload) - 1
            else:
                imbalance_ratio = (max_workload - min_workload) / mean_workload if mean_workload > 0 else 0
            
            # Coefficient of variation
            cv = (std_workload / mean_workload) if mean_workload > 0 else 0
            
            # Detect overloaded and underloaded employees
            overloaded = []
            underloaded = []
            
            for emp in employee_workloads:
                workload = float(emp.get('current_workload', 0))
                emp_id = emp.get('employee_id', 'Unknown')
                emp_name = emp.get('employee_name', emp_id)
                
                if workload > mean_workload + 1.5 * std_workload:
                    overloaded.append({
                        'employee_id': emp_id,
                        'employee_name': emp_name,
                        'current_workload': workload,
                        'deviation_from_mean': workload - mean_workload,
                        'severity': 'high' if workload > mean_workload + 2.5 * std_workload else 'medium'
                    })
                elif workload < mean_workload - 1.5 * std_workload and workload > 0:
                    underloaded.append({
                        'employee_id': emp_id,
                        'employee_name': emp_name,
                        'current_workload': workload,
                        'deviation_from_mean': workload - mean_workload,
                    })
            
            is_imbalanced = bool(imbalance_ratio > self.fairness_threshold)
            
            return {
                'imbalanced': is_imbalanced,
                'imbalance_ratio': float(imbalance_ratio),
                'coefficient_of_variation': float(cv),
                'mean_workload': float(mean_workload),
                'max_workload': float(max_workload),
                'min_workload': float(min_workload),
                'std_workload': float(std_workload),
                'fairness_threshold': self.fairness_threshold,
                'overloaded_employees': overloaded,
                'underloaded_employees': underloaded,
                'total_employees': len(employee_workloads),
                'recommendation': self._get_imbalance_recommendation(is_imbalanced, imbalance_ratio, 
                                                                     overloaded, underloaded)
            }
        except Exception as e:
            logger.error(f"Error detecting workload imbalance: {e}")
            return {'error': str(e)}
    
    def detect_non_fcr_drivers(self, tickets: List[Dict]) -> Dict[str, Any]:
        """
        Identify drivers of Non-FCR issues
        
        Args:
            tickets: List of ticket data
            
        Returns:
            Dictionary with Non-FCR drivers and recommendations
        """
        try:
            if not tickets:
                return {'drivers': []}
            
            df = pd.DataFrame(tickets)
            if 'fcr' in df.columns:
                df['fcr'] = df['fcr'].astype(bool)
            else:
                df['fcr'] = False

            non_fcr_tickets = df[~df['fcr']]
            if len(non_fcr_tickets) == 0:
                return {'fcr_rate': 100.0, 'drivers': []}

            overall_fcr_rate = float(df['fcr'].mean() * 100) if len(df) > 0 else 0.0
            overall_non_fcr_rate = 100.0 - overall_fcr_rate

            drivers = []
            
            # Category analysis
            if 'category' in df.columns:
                category_fcr = df.groupby('category').apply(
                    lambda x: (x['fcr'].sum() / len(x) * 100) if len(x) > 0 else 0
                )
                low_fcr_categories = category_fcr[category_fcr < overall_fcr_rate - 10]
                for category, rate in low_fcr_categories.items():
                    drivers.append({
                        'type': 'category',
                        'value': category,
                        'non_fcr_rate': round(float(100 - rate), 2),
                        'impact': 'high' if rate < overall_fcr_rate - 20 else 'medium',
                        'recommendation': f'Provide training for {category} category issues and review playbooks.'
                    })
            
            # Priority analysis
            if 'priority' in df.columns:
                priority_fcr = df.groupby('priority').apply(
                    lambda x: (x['fcr'].sum() / len(x) * 100) if len(x) > 0 else 0
                )
                low_fcr_priorities = priority_fcr[priority_fcr < overall_fcr_rate - 10]
                for priority, rate in low_fcr_priorities.items():
                    drivers.append({
                        'type': 'priority',
                        'value': f'Priority {priority}',
                        'non_fcr_rate': round(float(100 - rate), 2),
                        'impact': 'high' if rate < overall_fcr_rate - 20 else 'medium',
                        'recommendation': f'Create escalation path for Priority {priority} tickets'
                    })
            
            # Agent analysis
            agent_col = 'agent_name'
            if agent_col not in df.columns and 'assigned_to_id' in df.columns:
                agent_col = 'assigned_to_id'

            if agent_col in df.columns:
                agent_fcr = df.groupby(agent_col).apply(
                    lambda x: (x['fcr'].sum() / len(x) * 100) if len(x) > 0 else 0
                )
                low_fcr_agents = agent_fcr[agent_fcr < overall_fcr_rate - 10]
                for agent, rate in low_fcr_agents.items():
                    drivers.append({
                        'type': 'agent',
                        'value': str(agent),
                        'non_fcr_rate': round(float(100 - rate), 2),
                        'impact': 'high' if rate < overall_fcr_rate - 20 else 'medium',
                        'recommendation': f'Provide targeted coaching or reassignment support for {agent}.'
                    })

            # Category × employee interaction analysis
            if 'category' in df.columns and agent_col in df.columns:
                pair_fcr = df.groupby(['category', agent_col]).apply(
                    lambda x: (x['fcr'].sum() / len(x) * 100) if len(x) > 0 else 0
                )
                weak_pairs = pair_fcr[pair_fcr < overall_fcr_rate - 12]
                for (category, agent), rate in weak_pairs.items():
                    drivers.append({
                        'type': 'category_employee_pair',
                        'value': f'{category} / {agent}',
                        'non_fcr_rate': round(float(100 - rate), 2),
                        'impact': 'high' if rate < overall_fcr_rate - 20 else 'medium',
                        'recommendation': f'Train {agent} on {category} tickets or reassign these cases to a stronger specialist.'
                    })

            return {
                'overall_fcr_rate': float(overall_fcr_rate),
                'non_fcr_rate': float(overall_non_fcr_rate),
                'total_tickets': len(df),
                'non_fcr_tickets': len(non_fcr_tickets),
                'drivers': drivers,
            }
        except Exception as e:
            logger.error(f"Error detecting FCR drivers: {e}")
            return {'error': str(e)}
    
    @staticmethod
    def _get_imbalance_recommendation(is_imbalanced: bool, imbalance_ratio: float,
                                      overloaded: List[Dict], underloaded: List[Dict]) -> str:
        """Generate recommendation based on imbalance analysis"""
        if not is_imbalanced:
            return "Workload is balanced. Continue monitoring."
        
        recommendations = []
        
        if overloaded:
            recommendations.append(
                f"Redistribute tickets from overloaded employees ({len(overloaded)} identified). "
                f"Consider reassigning {len(underloaded)} underloaded employees' available capacity."
            )
        
        if imbalance_ratio > 0.5:
            recommendations.append("Severe imbalance detected. Implement immediate redistribution.")
        
        if not recommendations:
            recommendations.append("Rebalance workload across team members.")
        
        return ' '.join(recommendations)
