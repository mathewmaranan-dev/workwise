"""
Workload Balancing Module

Uses clustering and optimization algorithms to recommend optimal workload distribution
"""

import numpy as np
from sklearn.cluster import KMeans

class WorkloadOptimizer:
    def __init__(self):
        self.target_variance = 0.1  # 10% acceptable variance
    
    def analyze_current_load(self, team_members):
        """
        Analyze current workload distribution
        
        Args:
            team_members: List of dicts with 'user_id' and 'current_tickets'
        """
        loads = [m['current_tickets'] for m in team_members]
        mean_load = np.mean(loads)
        std_load = np.std(loads)
        
        return {
            'mean': mean_load,
            'std_dev': std_load,
            'coefficient_of_variation': std_load / mean_load if mean_load > 0 else 0
        }
    
    def recommend_distribution(self, team_members, incoming_tickets):
        """
        Recommend optimal workload distribution
        """
        try:
            current_loads = np.array([m['current_tickets'] for m in team_members]).reshape(-1, 1)
            
            # Use K-means clustering to identify load imbalances
            kmeans = KMeans(n_clusters=2, random_state=42)
            clusters = kmeans.fit_predict(current_loads)
            
            recommendations = []
            target_load = (sum([m['current_tickets'] for m in team_members]) + incoming_tickets) / len(team_members)
            
            for i, member in enumerate(team_members):
                current = member['current_tickets']
                adjustment = target_load - current
                
                recommendations.append({
                    'user_id': member['user_id'],
                    'current_load': current,
                    'recommended_load': target_load,
                    'adjustment': adjustment,
                    'tickets_to_assign': max(0, int(adjustment))
                })
            
            # Check if balanced
            analysis = self.analyze_current_load(team_members)
            is_balanced = analysis['coefficient_of_variation'] < self.target_variance
            
            return {
                'recommendations': recommendations,
                'is_balanced': is_balanced,
                'target_load': target_load,
                'current_variance': analysis['coefficient_of_variation']
            }
        
        except Exception as e:
            return {'error': str(e)}
