"""
First-Contact Resolution (FCR) Risk Prediction Module

Predicts likelihood of ticket non-resolution and provides actionable recommendations.
Loads a trained local model when available and falls back to sophisticated heuristics.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any

import joblib
import numpy as np

logger = logging.getLogger(__name__)


class FCRPredictor:
    """FCR Risk prediction with explainability"""
    
    def __init__(self):
        project_root = Path(__file__).resolve().parents[1]
        model_dir = project_root / 'models'
        self.model_path = model_dir / 'fcr_model.joblib'
        self.feature_order_path = model_dir / 'fcr_feature_order.json'
        self.threshold_path = model_dir / 'fcr_threshold.json'
        self.feature_importance_path = model_dir / 'fcr_feature_importance.json'
        
        self.model = None
        self.feature_order = []
        self.threshold = 0.5
        self.feature_importance = {}
        self._load_model()
    
    def _load_model(self):
        """Load persisted model and metadata"""
        try:
            if self.model_path.exists():
                self.model = joblib.load(self.model_path)
                logger.info("✅ FCR model loaded from disk")
            
            if self.feature_order_path.exists():
                with open(self.feature_order_path, 'r') as f:
                    self.feature_order = json.load(f)
            
            if self.threshold_path.exists():
                with open(self.threshold_path, 'r') as f:
                    self.threshold = float(json.load(f).get('threshold', 0.5))
            
            if self.feature_importance_path.exists():
                with open(self.feature_importance_path, 'r') as f:
                    self.feature_importance = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load model: {e}. Using heuristic mode.")
    
    def predict_fcr_risk(self, ticket_features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict FCR risk for a ticket
        
        Args:
            ticket_features: Dictionary with ticket attributes
            
        Returns:
            Dictionary with risk score, level, and recommendations
        """
        try:
            if self.model is not None and self.feature_order:
                risk_score, used_model = self._predict_with_model(ticket_features)
            else:
                risk_score = self._heuristic_risk(ticket_features)
                used_model = 'heuristic'
            
            # Determine risk level and confidence
            risk_level = self._categorize_risk(risk_score)
            confidence = self._calculate_confidence(risk_score, used_model)
            
            # Get drivers and recommendations
            drivers = self._build_drivers(ticket_features, risk_score)
            recommendations = self._get_recommendations(risk_level, drivers)
            
            return {
                'risk_score': float(np.clip(risk_score, 0, 1)),
                'risk_level': risk_level,
                'confidence': confidence,
                'model_type': used_model,
                'threshold': self.threshold,
                'drivers': drivers,
                'recommendations': recommendations,
                'intervention_required': risk_level in ['medium', 'high'],
                'priority_actions': self._get_priority_actions(risk_level, drivers),
            }
        except Exception as e:
            logger.error(f"Error predicting FCR risk: {e}")
            return {
                'error': str(e),
                'risk_score': 0.5,
                'risk_level': 'medium',
                'confidence': 0.5
            }
    
    def _predict_with_model(self, ticket_features: Dict[str, Any]) -> tuple:
        """Make prediction using trained model"""
        try:
            # Build feature vector in correct order
            vector = []
            for feature_name in self.feature_order:
                if feature_name in ticket_features:
                    value = ticket_features[feature_name]
                else:
                    value = 0
                
                # Convert to float
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    value = 0
                
                vector.append(value)
            
            # Get probability
            probability = float(self.model.predict_proba(np.array([vector]))[:, 1][0])
            risk_score = float(np.clip(probability, 0, 1))
            
            return risk_score, 'trained_model'
        except Exception as e:
            logger.warning(f"Model prediction failed: {e}. Falling back to heuristic.")
            return self._heuristic_risk(ticket_features), 'heuristic'
    
    def _heuristic_risk(self, ticket_features: Dict[str, Any]) -> float:
        """
        Calculate FCR risk using sophisticated heuristics
        
        Based on empirical research and domain knowledge
        """
        risk_score = 0.2  # Base risk
        
        # Priority impact (higher priority = more complex = higher non-FCR risk)
        priority = ticket_features.get('priority_id', 3)
        priority_risk = min(priority, 5) * 0.08
        risk_score += priority_risk
        
        # Reopen history (strong indicator of resolution quality)
        reopen_count = max(ticket_features.get('reopen_count', 0), 0)
        reopen_risk = reopen_count * 0.12
        risk_score += reopen_risk
        
        # Reassignment history
        reassignment_count = max(ticket_features.get('reassignment_count', 0), 0)
        reassignment_risk = reassignment_count * 0.10
        risk_score += reassignment_risk
        
        # Resolution time (longer = more complex)
        duration = ticket_features.get('duration', 60)
        duration_risk = min(duration / 300, 1) * 0.15
        risk_score += duration_risk
        
        # Ticket complexity (if provided)
        complexity = ticket_features.get('ticket_complexity', 5)
        complexity_risk = min(complexity / 12, 1) * 0.12
        risk_score += complexity_risk
        
        # Agent experience and history
        agent_fcr_history = min(ticket_features.get('agent_fcr_history', 0.7), 1)
        agent_risk = (1 - agent_fcr_history) * 0.20
        risk_score += agent_risk
        
        # Category-level non-FCR rates
        category_non_fcr = min(ticket_features.get('category_non_fcr_rate', 0.2), 1)
        category_risk = category_non_fcr * 0.23
        risk_score += category_risk
        
        # Normalize
        risk_score = float(np.clip(risk_score, 0, 1))
        
        return risk_score
    
    def _categorize_risk(self, risk_score: float) -> str:
        """Categorize risk into low/medium/high"""
        if risk_score < 0.35:
            return 'low'
        elif risk_score < 0.65:
            return 'medium'
        else:
            return 'high'
    
    def _calculate_confidence(self, risk_score: float, model_type: str) -> float:
        """Calculate confidence score"""
        base_confidence = 0.65 if model_type == 'trained_model' else 0.55
        
        # Confidence increases toward extremes (very low or very high risk)
        if risk_score < 0.3 or risk_score > 0.7:
            confidence = base_confidence + 0.15
        else:
            confidence = base_confidence
        
        return float(np.clip(confidence, 0.5, 0.95))
    
    def _build_drivers(self, ticket_features: Dict[str, Any], risk_score: float) -> List[Dict[str, Any]]:
        """
        Identify and explain drivers of non-FCR risk
        
        Returns list of risk drivers with explanations and impact
        """
        drivers = []
        
        # High priority driver
        priority = ticket_features.get('priority_id', 0)
        if priority >= 3:
            drivers.append({
                'type': 'complexity',
                'factor': f'Priority {priority} (High priority complexity)',
                'impact': 'high' if priority >= 4 else 'medium',
                'contribution_to_risk': 0.08 * priority,
                'explanation': 'Higher priority tickets tend to be more complex and less likely to resolve on first contact.'
            })
        
        # Reopen history
        if ticket_features.get('reopen_count', 0) > 0:
            reopen_count = ticket_features.get('reopen_count', 0)
            drivers.append({
                'type': 'history',
                'factor': f'{reopen_count} previous reopen(s)',
                'impact': 'high',
                'contribution_to_risk': 0.12 * reopen_count,
                'explanation': 'Tickets with reopen history are strong indicators of potential second resolution failure.'
            })
        
        # Category analysis
        category = ticket_features.get('category', 'unknown')
        category_non_fcr = ticket_features.get('category_non_fcr_rate', 0.2)
        if category_non_fcr > 0.25:
            drivers.append({
                'type': 'category',
                'factor': f'{category} category ({category_non_fcr*100:.1f}% non-FCR rate)',
                'impact': 'medium',
                'contribution_to_risk': 0.23 * category_non_fcr,
                'explanation': f'Tickets in the {category} category have a higher-than-average non-FCR rate.'
            })
        
        # Agent experience
        agent_fcr = ticket_features.get('agent_fcr_history', 0.7)
        if agent_fcr < 0.65:
            drivers.append({
                'type': 'agent',
                'factor': f'Agent with {agent_fcr*100:.1f}% FCR history',
                'impact': 'medium',
                'contribution_to_risk': 0.20 * (1 - agent_fcr),
                'explanation': 'This agent has lower-than-average first contact resolution rate.'
            })
        
        # Resolution time
        duration = ticket_features.get('duration', 60)
        if duration > 180:
            drivers.append({
                'type': 'complexity',
                'factor': f'High resolution time ({duration} minutes)',
                'impact': 'medium',
                'contribution_to_risk': 0.15 * min(duration / 300, 1),
                'explanation': 'Longer resolution times indicate complex issues less likely to resolve immediately.'
            })
        
        return drivers
    
    def _get_recommendations(self, risk_level: str, drivers: List[Dict]) -> List[str]:
        """Generate recommendations based on risk level and drivers"""
        recommendations = {
            'low': [
                'Route to standard agent pool',
                'Monitor for deviations',
                'Maintain current process'
            ],
            'medium': [
                'Route to experienced agent or team',
                'Consider knowledge base consultation',
                'Monitor ticket for quality issues',
                'Prepare escalation path if needed'
            ],
            'high': [
                'Route to specialist or senior agent',
                'Assign supervisor for oversight',
                'Provide real-time knowledge base access',
                'Set escalation triggers',
                'Consider proactive customer communication',
                'Plan for potential reopens'
            ]
        }
        
        base_recommendations = recommendations.get(risk_level, [])
        
        # Add driver-specific recommendations
        driver_specific = []
        for driver in drivers[:2]:  # Top 2 drivers
            driver_type = driver.get('type', '')
            if driver_type == 'category':
                driver_specific.append(f"Provide product training for {driver.get('factor', 'this category')}")
            elif driver_type == 'agent':
                driver_specific.append(f"Consider pairing with mentor or providing training")
            elif driver_type == 'history':
                driver_specific.append(f"Review and address recurring issues")
        
        return base_recommendations + driver_specific
    
    def _get_priority_actions(self, risk_level: str, drivers: List[Dict]) -> List[str]:
        """Get top priority actions to reduce risk"""
        actions = []
        
        if risk_level == 'high':
            actions.append('Immediate: Assign to senior agent or specialist')
            actions.append('Immediate: Prepare escalation path')
        elif risk_level == 'medium':
            actions.append('Recommended: Assign to experienced team member')
            actions.append('Recommended: Provide knowledge base resources')
        
        # Add data-driven actions
        for driver in drivers:
            if driver['type'] == 'category':
                actions.append(f'Action: Schedule training for {driver.get("factor")} handling')
            elif driver['type'] == 'agent':
                actions.append('Action: Provide targeted coaching or mentoring')
        
        return actions
