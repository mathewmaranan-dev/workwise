"""
Workload Balancing Module

Uses clustering, optimization algorithms, and fairness constraints to recommend 
optimal workload distribution that balances performance with employee equity.
"""

import logging
from typing import Dict, List, Any, Tuple

import numpy as np
import pandas as pd
from scipy.optimize import linprog
from sklearn.cluster import KMeans

logger = logging.getLogger(__name__)


class WorkloadOptimizer:
    """Workload optimization with fairness constraints and prescriptive analytics"""
    
    def __init__(self, fairness_threshold: float = 0.25, max_workload_ratio: float = 1.5):
        """
        Initialize workload optimizer
        
        Args:
            fairness_threshold: Maximum allowed workload ratio difference (0.25 = 25%)
            max_workload_ratio: Maximum ratio of max to min workload
        """
        self.fairness_threshold = fairness_threshold
        self.max_workload_ratio = max_workload_ratio
        self.target_variance = 0.1
    
    def analyze_current_load(self, team_members: List[Dict]) -> Dict[str, float]:
        """
        Analyze current workload distribution
        
        Args:
            team_members: List of dicts with 'user_id', 'current_tickets', 'sla_compliance', etc.
            
        Returns:
            Dictionary with workload statistics
        """
        try:
            loads = [float(m.get('current_tickets', 0)) for m in team_members]
            
            if not loads or all(l == 0 for l in loads):
                return {
                    'mean': 0,
                    'std_dev': 0,
                    'coefficient_of_variation': 0,
                    'imbalance_ratio': 0,
                    'total_workload': 0
                }
            
            mean_load = np.mean(loads)
            std_load = np.std(loads)
            
            # Imbalance ratio
            max_load = max(loads)
            min_load = min(loads) if min(loads) > 0 else 1
            imbalance_ratio = max_load / min_load
            
            return {
                'mean': float(mean_load),
                'std_dev': float(std_load),
                'coefficient_of_variation': float(std_load / mean_load) if mean_load > 0 else 0,
                'imbalance_ratio': float(imbalance_ratio),
                'total_workload': float(sum(loads)),
                'min_load': float(min_load),
                'max_load': float(max_load),
                'fairness_score': float(1 - min(imbalance_ratio / self.max_workload_ratio, 1))
            }
        except Exception as e:
            logger.error(f"Error analyzing current load: {e}")
            return {}
    
    def recommend_distribution(self, team_members: List[Dict], incoming_tickets: int = 0) -> Dict[str, Any]:
        """
        Recommend optimal workload distribution with fairness constraints
        
        Args:
            team_members: List of employee data with current workload and metrics
            incoming_tickets: Number of tickets to distribute
            
        Returns:
            Dictionary with optimization recommendations
        """
        try:
            if not team_members or len(team_members) == 0:
                return {'error': 'No team members provided'}
            
            n_employees = len(team_members)
            current_loads = np.array([float(m.get('current_tickets', 0)) for m in team_members])
            total_workload = float(current_loads.sum() + incoming_tickets)
            target_load = total_workload / n_employees if n_employees > 0 else 0
            
            # Get performance weights (higher performing employees can handle more)
            performance_weights = self._calculate_performance_weights(team_members)
            
            # Optimize distribution considering fairness and performance weights
            optimized_distribution = self._optimize_with_fairness(
                current_loads, incoming_tickets, performance_weights, target_load
            )
            
            # Generate recommendations
            recommendations = []
            total_reassignments = 0
            
            for i, member in enumerate(team_members):
                current = float(member.get('current_tickets', 0))
                optimized = float(optimized_distribution[i])
                adjustment = optimized - current
                reassignments = max(0, int(adjustment))
                
                rec = {
                    'user_id': member.get('user_id', f'emp_{i}'),
                    'employee_name': member.get('employee_name', 'Unknown'),
                    'current_load': current,
                    'recommended_load': optimized,
                    'adjustment': adjustment,
                    'tickets_to_assign': reassignments,
                    'tickets_to_release': max(0, int(-adjustment)),
                    'utilization_rate': (optimized / (member.get('capacity', 20))) if member.get('capacity') else 0.5,
                    'sla_compliance': float(member.get('sla_compliance', 85)),
                    'fcr_rate': float(member.get('fcr_rate', 70)),
                    'performance_weight': float(performance_weights[i])
                }
                recommendations.append(rec)
                total_reassignments += reassignments
            
            # Analyze optimized distribution
            optimized_members = [
                {'user_id': rec['user_id'], 'current_tickets': rec['recommended_load']}
                for rec in recommendations
            ]
            analysis = self.analyze_current_load(optimized_members)
            is_balanced = bool(analysis.get('imbalance_ratio', 2) <= self.max_workload_ratio)
            
            current_analysis = self.analyze_current_load(team_members)
            predicted_improvements = self._estimate_kpi_improvements(current_analysis, analysis)

            return {
                'recommendations': recommendations,
                'is_balanced': is_balanced,
                'optimization_status': 'optimal' if is_balanced else 'improved',
                'target_load': float(target_load),
                'current_analysis': current_analysis,
                'optimized_analysis': analysis,
                'predicted_improvements': predicted_improvements,
                'total_reassignments': total_reassignments,
                'fairness_score': float(analysis.get('fairness_score', 0)),
                'implementation_difficulty': self._assess_implementation_difficulty(recommendations),
                'business_impact': self._assess_business_impact(recommendations)
            }
        except Exception as e:
            logger.error(f"Error recommending distribution: {e}")
            return {'error': str(e)}
    
    def predict_staffing_needs(self, forecast_volume: List[int], current_team_size: int,
                              avg_capacity: float = 20.0) -> Dict[str, Any]:
        """
        Predict staffing needs based on forecasted volume
        
        Args:
            forecast_volume: List of forecasted daily ticket volumes
            current_team_size: Current number of agents
            avg_capacity: Average tickets per agent per day
            
        Returns:
            Staffing recommendation
        """
        try:
            if not forecast_volume:
                return {'error': 'No forecast data'}
            
            max_forecast = max(forecast_volume)
            avg_forecast = np.mean(forecast_volume)
            
            # Calculate needed staff
            needed_for_max = max_forecast / avg_capacity
            needed_for_avg = avg_forecast / avg_capacity
            
            # Add buffer for quality (85% utilization)
            needed_for_max = needed_for_max / 0.85
            needed_for_avg = needed_for_avg / 0.85
            
            staffing_change = needed_for_avg - current_team_size
            peak_staffing_change = needed_for_max - current_team_size
            
            return {
                'current_team_size': current_team_size,
                'needed_for_average_volume': float(np.ceil(needed_for_avg)),
                'needed_for_peak_volume': float(np.ceil(needed_for_max)),
                'recommended_team_size': float(np.ceil(needed_for_avg)),
                'staffing_change': float(np.ceil(staffing_change)),
                'peak_staffing_change': float(np.ceil(peak_staffing_change)),
                'utilization_at_recommended': float(avg_forecast / (np.ceil(needed_for_avg) * avg_capacity) * 100),
                'implementation_timeline': self._get_staffing_timeline(staffing_change),
                'cost_impact': self._estimate_cost_impact(staffing_change),
            }
        except Exception as e:
            logger.error(f"Error predicting staffing needs: {e}")
            return {'error': str(e)}
    
    def _calculate_performance_weights(self, team_members: List[Dict]) -> np.ndarray:
        """
        Calculate performance weights for each employee
        
        Higher performing employees can handle relatively more tickets
        """
        try:
            weights = []
            for member in team_members:
                # Composite score: 60% SLA, 40% FCR
                sla = float(member.get('sla_compliance', 85)) / 100
                fcr = float(member.get('fcr_rate', 70)) / 100
                efficiency = sla * 0.6 + fcr * 0.4
                
                # Experience multiplier
                experience = float(member.get('experience_level', 1))
                weight = efficiency * experience
                
                weights.append(weight)
            
            # Normalize weights
            total_weight = sum(weights)
            if total_weight > 0:
                weights = [w / total_weight * len(weights) for w in weights]
            else:
                weights = [1.0] * len(weights)
            
            return np.array(weights)
        except Exception as e:
            logger.error(f"Error calculating performance weights: {e}")
            return np.ones(len(team_members))
    
    def _optimize_with_fairness(self, current_loads: np.ndarray, incoming_tickets: int,
                                performance_weights: np.ndarray, target_load: float) -> np.ndarray:
        """
        Optimize distribution considering fairness constraints
        
        Uses weighted distribution: higher performers get more tickets,
        but fairness constraints prevent extreme imbalances
        """
        try:
            n = len(current_loads)
            total_workload = float(current_loads.sum() + incoming_tickets)

            # Fairness bounds around mean
            mean_load = float(total_workload / max(n, 1))
            min_allowed = max(0.0, mean_load * (1.0 - self.fairness_threshold))
            max_allowed = mean_load * (1.0 + self.fairness_threshold)

            distribution = current_loads.copy().astype(float)
            tickets_remaining = int(incoming_tickets)

            # Greedy allocation: at each step, assign one ticket to the employee
            # with the highest priority score who is below the max_allowed.
            # Priority score favors high performance and lower current load.
            if tickets_remaining <= 0:
                return distribution

            # Pre-normalize performance weights
            perf = performance_weights.copy().astype(float)
            if perf.sum() <= 0:
                perf = np.ones_like(perf)

            # Loop to assign tickets one-by-one to satisfy integer constraints
            while tickets_remaining > 0:
                # compute scores
                scores = np.zeros(n)
                for i in range(n):
                    # Skip if already at or above max_allowed
                    if distribution[i] >= max_allowed:
                        scores[i] = -1e9
                        continue
                    # lower load -> higher urgency; combine with performance
                    load_deficit = max_allowed - distribution[i]
                    # score = performance * (load_deficit / (max_allowed - min_allowed + 1e-6))
                    denom = max(1e-6, (max_allowed - min_allowed))
                    scores[i] = perf[i] * (load_deficit / denom)

                # pick best index
                best = int(np.argmax(scores))
                if scores[best] <= 0:
                    # no eligible employee (all at cap) - assign to lowest load
                    best = int(np.argmin(distribution))

                distribution[best] += 1.0
                tickets_remaining -= 1

                # defensive break
                if tickets_remaining <= 0:
                    break

            return distribution
        except Exception as e:
            logger.error(f"Error optimizing with fairness: {e}")
            return current_loads
    
    @staticmethod
    def _assess_implementation_difficulty(recommendations: List[Dict]) -> str:
        """Assess implementation difficulty"""
        total_changes = sum(float(r.get('adjustment', 0)) for r in recommendations)
        pct_changes = total_changes / len(recommendations) if recommendations else 0
        
        if abs(pct_changes) < 2:
            return 'low'
        elif abs(pct_changes) < 5:
            return 'medium'
        else:
            return 'high'
    
    @staticmethod
    def _assess_business_impact(recommendations: List[Dict]) -> Dict[str, Any]:
        """Assess business impact of recommendations"""
        try:
            # Assess changes in KPIs
            impact = {
                'sla_impact': 'positive',  # Usually improves with better distribution
                'fcr_impact': 'positive',
                'employee_satisfaction': 'positive',
                'implementation_risk': 'low'
            }
            
            # Check for significant workload shifts
            large_changes = [r for r in recommendations if abs(r.get('adjustment', 0)) > 5]
            if large_changes:
                impact['implementation_risk'] = 'medium'
            
            return impact
        except Exception as e:
            logger.error(f"Error assessing business impact: {e}")
            return {}

    def _estimate_kpi_improvements(self, current_analysis: Dict[str, float], optimized_analysis: Dict[str, float]) -> Dict[str, Any]:
        """Estimate KPI improvement from workload redistribution"""
        try:
            fairness_delta = float(optimized_analysis.get('fairness_score', 0)) - float(current_analysis.get('fairness_score', 0))
            variance_delta = float(current_analysis.get('coefficient_of_variation', 0)) - float(optimized_analysis.get('coefficient_of_variation', 0))

            sla_improvement = max(0.0, min(10.0, fairness_delta * 20 + variance_delta * 15))
            resolution_improvement = max(0.0, min(15.0, fairness_delta * 28 + variance_delta * 20))
            fcr_improvement = max(0.0, min(8.0, fairness_delta * 10 + variance_delta * 5))

            summary = (
                f"Balancing workload for this team could improve SLA compliance by approximately {sla_improvement:.1f} points, "
                f"reduce average resolution time by about {resolution_improvement:.1f}% and boost FCR by roughly {fcr_improvement:.1f} points."
            )

            return {
                'sla_compliance_gain_pct': round(sla_improvement, 1),
                'avg_resolution_time_reduction_pct': round(resolution_improvement, 1),
                'fcr_rate_gain_pct': round(fcr_improvement, 1),
                'summary': summary
            }
        except Exception as e:
            logger.error(f"Error estimating KPI improvements: {e}")
            return {
                'sla_compliance_gain_pct': 0.0,
                'avg_resolution_time_reduction_pct': 0.0,
                'fcr_rate_gain_pct': 0.0,
                'summary': 'Estimated KPI improvement unavailable.'
            }
    
    @staticmethod
    def _get_staffing_timeline(staffing_change: float) -> str:
        """Estimate implementation timeline for staffing changes"""
        change = abs(staffing_change)
        if change == 0:
            return 'No change needed'
        elif change <= 1:
            return '1-2 weeks'
        elif change <= 3:
            return '2-4 weeks'
        else:
            return '4-8 weeks'
    
    @staticmethod
    def _estimate_cost_impact(staffing_change: float) -> Dict[str, Any]:
        """Estimate cost impact of staffing changes"""
        avg_salary = 50000  # Annual average salary per agent
        
        annual_impact = staffing_change * avg_salary
        monthly_impact = annual_impact / 12
        
        return {
            'annual_impact': float(annual_impact),
            'monthly_impact': float(monthly_impact),
            'savings' if staffing_change < 0 else 'cost': float(abs(monthly_impact))
        }
