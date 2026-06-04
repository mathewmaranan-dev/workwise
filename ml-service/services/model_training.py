"""
Model Training and Evaluation Module

Handles model training, evaluation, and persistence
"""

import json
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
    f1_score, mean_squared_error, mean_absolute_error, r2_score
)

logger = logging.getLogger(__name__)


class ModelTrainer:
    """Handles training and evaluation of ML models"""
    
    def __init__(self, model_dir: str = None):
        self.model_dir = Path(model_dir) if model_dir else Path(__file__).resolve().parents[1] / 'models'
        self.model_dir.mkdir(exist_ok=True)
        
        self.fcr_model = None
        self.workload_model = None
        self.feature_scalers = {}
    
    def train_fcr_model(self, X: np.ndarray, y: np.ndarray, 
                       feature_names: List[str]) -> Dict[str, Any]:
        """
        Train FCR risk prediction model
        
        Args:
            X: Feature matrix
            y: Target labels (0: FCR, 1: Non-FCR)
            feature_names: Names of features
            
        Returns:
            Dictionary with training results and metrics
        """
        try:
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.3, random_state=42, stratify=y
            )
            
            # Train a Logistic Regression model to match the paper's Non-FCR detector design
            base_model = LogisticRegression(
                max_iter=10000,
                class_weight='balanced',
                random_state=42,
            )
            grid_search = GridSearchCV(
                base_model,
                param_grid={
                    'C': [0.1, 0.5, 1.0, 2.0],
                    'solver': ['lbfgs', 'liblinear'],
                },
                cv=5,
                scoring='roc_auc',
            )
            grid_search.fit(X_train, y_train)

            self.fcr_model = grid_search.best_estimator_
            
            # Evaluate
            y_pred = self.fcr_model.predict(X_test)
            y_pred_proba = self.fcr_model.predict_proba(X_test)[:, 1]
            
            metrics = {
                'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
                'accuracy': float(np.mean(y_pred == y_test)),
                'precision': float(np.sum((y_pred == 1) & (y_test == 1)) / np.sum(y_pred == 1)) if np.sum(y_pred == 1) else 0.0,
                'recall': float(np.sum((y_pred == 1) & (y_test == 1)) / np.sum(y_test == 1)) if np.sum(y_test == 1) else 0.0,
                'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
                'classification_report': classification_report(y_test, y_pred, output_dict=True),
                'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
                'best_params': grid_search.best_params_,
                'cv_score': float(grid_search.best_score_),
            }

            # Calculate feature importance from logistic regression coefficients
            coef_values = np.abs(self.fcr_model.coef_[0]) if hasattr(self.fcr_model, 'coef_') and self.fcr_model.coef_.ndim > 1 else np.abs(self.fcr_model.coef_)
            feature_importance = {
                name: float(importance)
                for name, importance in zip(feature_names, coef_values)
            }
            
            # Save model
            model_path = self.model_dir / 'fcr_model.joblib'
            joblib.dump(self.fcr_model, model_path)
            
            # Save feature order and importance
            feature_order_path = self.model_dir / 'fcr_feature_order.json'
            with open(feature_order_path, 'w') as f:
                json.dump(feature_names, f)
            
            feature_importance_path = self.model_dir / 'fcr_feature_importance.json'
            with open(feature_importance_path, 'w') as f:
                json.dump(feature_importance, f)
            
            # Determine optimal threshold
            threshold = self._find_optimal_threshold(y_test, y_pred_proba)
            threshold_path = self.model_dir / 'fcr_threshold.json'
            with open(threshold_path, 'w') as f:
                json.dump({'threshold': threshold}, f)
            
            logger.info(f"✅ FCR model trained. ROC-AUC: {metrics['roc_auc']:.4f}")
            
            return {
                'model_name': 'FCR Risk Predictor',
                'model_type': 'Logistic Regression',
                'metrics': metrics,
                'feature_importance': feature_importance,
                'optimal_threshold': threshold,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
            }
        except Exception as e:
            logger.error(f"Error training FCR model: {e}")
            return {'error': str(e)}
    
    def train_workload_model(self, X: np.ndarray, y: np.ndarray,
                           feature_names: List[str]) -> Dict[str, Any]:
        """
        Train workload imbalance prediction model
        
        Args:
            X: Feature matrix (employee metrics)
            y: Target (workload imbalance score 0-1)
            feature_names: Names of features
            
        Returns:
            Dictionary with training results and metrics
        """
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Train gradient boosting regressor
            param_grid = {
                'n_estimators': [50, 100, 150],
                'learning_rate': [0.01, 0.05, 0.1],
                'max_depth': [3, 5, 7],
            }
            
            base_model = GradientBoostingRegressor(random_state=42, loss='huber')
            grid_search = GridSearchCV(base_model, param_grid, cv=5, scoring='r2')
            grid_search.fit(X_train, y_train)
            
            self.workload_model = grid_search.best_estimator_
            
            # Evaluate
            y_pred = self.workload_model.predict(X_test)
            
            metrics = {
                'r2_score': float(r2_score(y_test, y_pred)),
                'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred))),
                'mae': float(mean_absolute_error(y_test, y_pred)),
                'best_params': grid_search.best_params_,
                'cv_score': float(grid_search.best_score_),
            }
            
            # Feature importance
            feature_importance = {
                name: float(importance)
                for name, importance in zip(feature_names, self.workload_model.feature_importances_)
            }
            
            # Save model
            model_path = self.model_dir / 'workload_model.joblib'
            joblib.dump(self.workload_model, model_path)
            
            feature_order_path = self.model_dir / 'workload_feature_order.json'
            with open(feature_order_path, 'w') as f:
                json.dump(feature_names, f)
            
            feature_importance_path = self.model_dir / 'workload_feature_importance.json'
            with open(feature_importance_path, 'w') as f:
                json.dump(feature_importance, f)
            
            logger.info(f"✅ Workload model trained. R²: {metrics['r2_score']:.4f}")
            
            return {
                'model_name': 'Workload Imbalance Predictor',
                'model_type': 'GradientBoosting',
                'metrics': metrics,
                'feature_importance': feature_importance,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
            }
        except Exception as e:
            logger.error(f"Error training workload model: {e}")
            return {'error': str(e)}
    
    def _find_optimal_threshold(self, y_test: np.ndarray, y_pred_proba: np.ndarray) -> float:
        """
        Find optimal probability threshold for FCR classification
        
        Using Youden's index: sensitivity + specificity - 1
        """
        try:
            from sklearn.metrics import roc_curve
            
            fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
            youden_scores = tpr - fpr
            optimal_idx = np.argmax(youden_scores)
            optimal_threshold = thresholds[optimal_idx]
            
            return float(np.clip(optimal_threshold, 0.3, 0.7))
        except Exception as e:
            logger.error(f"Error finding optimal threshold: {e}")
            return 0.5
    
    def evaluate_model(self, model, X_test: np.ndarray, y_test: np.ndarray,
                      model_type: str = 'classification') -> Dict[str, Any]:
        """
        Evaluate trained model
        
        Args:
            model: Trained model
            X_test: Test features
            y_test: Test labels/values
            model_type: 'classification' or 'regression'
            
        Returns:
            Evaluation metrics
        """
        try:
            if model_type == 'classification':
                y_pred = model.predict(X_test)
                y_pred_proba = model.predict_proba(X_test)[:, 1]
                
                return {
                    'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
                    'accuracy': float(np.mean(y_pred == y_test)),
                    'precision': float(np.sum((y_pred == 1) & (y_test == 1)) / np.sum(y_pred == 1)),
                    'recall': float(np.sum((y_pred == 1) & (y_test == 1)) / np.sum(y_test == 1)),
                }
            else:  # regression
                y_pred = model.predict(X_test)
                return {
                    'r2_score': float(r2_score(y_test, y_pred)),
                    'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred))),
                    'mae': float(mean_absolute_error(y_test, y_pred)),
                }
        except Exception as e:
            logger.error(f"Error evaluating model: {e}")
            return {}
    
    def get_feature_importance(self, model_type: str = 'fcr') -> Dict[str, float]:
        """Get feature importance for a model"""
        try:
            importance_path = self.model_dir / f'{model_type}_feature_importance.json'
            if importance_path.exists():
                with open(importance_path, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Error reading feature importance: {e}")
            return {}
    
    def create_training_report(self, fcr_results: Dict, workload_results: Dict) -> str:
        """Create comprehensive training report"""
        try:
            report = f"""
# ML Model Training Report

## FCR Risk Predictor
- Model Type: {fcr_results.get('model_type', 'N/A')}
- ROC-AUC Score: {fcr_results.get('metrics', {}).get('roc_auc', 'N/A')}
- Training Samples: {fcr_results.get('training_samples', 'N/A')}
- Test Samples: {fcr_results.get('test_samples', 'N/A')}
- Optimal Threshold: {fcr_results.get('optimal_threshold', 0.5)}

Top Features:
{self._format_feature_importance(fcr_results.get('feature_importance', {}))}

## Workload Imbalance Predictor
- Model Type: {workload_results.get('model_type', 'N/A')}
- R² Score: {workload_results.get('metrics', {}).get('r2_score', 'N/A')}
- RMSE: {workload_results.get('metrics', {}).get('rmse', 'N/A')}
- Training Samples: {workload_results.get('training_samples', 'N/A')}
- Test Samples: {workload_results.get('test_samples', 'N/A')}

Top Features:
{self._format_feature_importance(workload_results.get('feature_importance', {}))}
"""
            return report
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            return ""
    
    @staticmethod
    def _format_feature_importance(importance_dict: Dict[str, float]) -> str:
        """Format feature importance for display"""
        sorted_features = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)[:5]
        return '\n'.join([f"  - {name}: {value:.4f}" for name, value in sorted_features])
