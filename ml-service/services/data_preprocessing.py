"""
Data Preprocessing Module

Handles data extraction, cleaning, feature engineering, and normalization
for ML pipeline.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """Handles data extraction, cleaning, and feature engineering"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.minmax_scaler = MinMaxScaler()
        self.feature_names = []
    
    def extract_ticket_features(self, ticket: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract and engineer features from raw ticket data
        
        Args:
            ticket: Raw ticket dictionary from database
            
        Returns:
            Dictionary with engineered features
        """
        try:
            created_at = pd.to_datetime(ticket.get('created_at', datetime.now()))
            resolved_at = pd.to_datetime(ticket.get('resolved_at', datetime.now()))
            
            # Calculate resolution time in hours
            resolution_time = (resolved_at - created_at).total_seconds() / 3600
            resolution_time = max(0, resolution_time)
            
            # Time features
            day_of_week = created_at.dayofweek
            hour_of_day = created_at.hour
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Priority features
            priority = ticket.get('priority', 3)
            
            # Status features
            reopen_count = ticket.get('reopen_count', 0)
            reassignment_count = ticket.get('reassignment_count', 0)
            
            # Performance indicators
            sla_met = 1 if ticket.get('sla_met', False) else 0
            fcr = 1 if ticket.get('fcr', False) else 0
            
            # Category encoding (will be one-hot encoded later)
            category = ticket.get('category', 'other')
            
            # Employee performance
            agent_fcr_rate = ticket.get('agent_fcr_rate', 0.7)
            agent_sla_rate = ticket.get('agent_sla_rate', 0.85)
            agent_avg_resolution_time = ticket.get('agent_avg_resolution_time', 120)
            
            return {
                'resolution_time': float(resolution_time),
                'priority': float(priority),
                'reopen_count': float(reopen_count),
                'reassignment_count': float(reassignment_count),
                'sla_met': float(sla_met),
                'fcr': float(fcr),
                'day_of_week': float(day_of_week),
                'hour_of_day': float(hour_of_day),
                'is_weekend': float(is_weekend),
                'agent_fcr_rate': float(agent_fcr_rate),
                'agent_sla_rate': float(agent_sla_rate),
                'agent_avg_resolution_time': float(agent_avg_resolution_time),
                'category': str(category),
            }
        except Exception as e:
            logger.error(f"Error extracting ticket features: {e}")
            return {}
    
    def engineer_employee_features(self, employee: Dict[str, Any], tickets: List[Dict]) -> Dict[str, float]:
        """
        Engineer features for an employee from their ticket data
        
        Args:
            employee: Employee data dictionary
            tickets: List of tickets assigned to this employee
            
        Returns:
            Dictionary with engineered features
        """
        try:
            total_tickets = len(tickets)
            
            if total_tickets == 0:
                return {
                    'sla_compliance_rate': 0.85,
                    'fcr_rate': 0.70,
                    'avg_resolution_time': 120,
                    'reopen_rate': 0.05,
                    'ticket_count': 0,
                    'workload_score': 0,
                    'efficiency_score': 0,
                    'experience_level': float(employee.get('experience_level', 1)),
                }
            
            sla_met = len([t for t in tickets if t.get('sla_met', False)])
            fcr_count = len([t for t in tickets if t.get('fcr', False)])
            reopen_count = sum([t.get('reopen_count', 0) for t in tickets])
            
            resolution_times = [t.get('duration', 120) for t in tickets if t.get('duration')]
            avg_resolution = np.mean(resolution_times) if resolution_times else 120
            
            sla_compliance = (sla_met / total_tickets) * 100 if total_tickets > 0 else 0
            fcr_rate = (fcr_count / total_tickets) * 100 if total_tickets > 0 else 0
            reopen_rate = (reopen_count / total_tickets) * 100 if total_tickets > 0 else 0
            
            # Efficiency score: weighted combination of SLA and FCR
            efficiency_score = (sla_compliance * 0.6 + fcr_rate * 0.4) / 100
            
            # Workload score: tickets handled relative to average
            workload_score = float(total_tickets)
            
            return {
                'sla_compliance_rate': float(sla_compliance),
                'fcr_rate': float(fcr_rate),
                'avg_resolution_time': float(avg_resolution),
                'reopen_rate': float(reopen_rate),
                'ticket_count': float(total_tickets),
                'workload_score': workload_score,
                'efficiency_score': float(np.clip(efficiency_score, 0, 1)),
                'experience_level': float(employee.get('experience_level', 1)),
            }
        except Exception as e:
            logger.error(f"Error engineering employee features: {e}")
            return {}
    
    def prepare_workload_dataset(self, teams_data: List[Dict]) -> Tuple[pd.DataFrame, Dict]:
        """
        Prepare dataset for workload analysis
        
        Args:
            teams_data: List of team/employee workload data
            
        Returns:
            Tuple of (DataFrame, scaling_params)
        """
        try:
            records = []
            for team in teams_data:
                employees = team.get('employees', [])
                for emp in employees:
                    record = {
                        'team_id': team.get('team_id'),
                        'employee_id': emp.get('employee_id'),
                        'current_workload': emp.get('current_workload', 0),
                        'sla_compliance': emp.get('sla_compliance', 85),
                        'fcr_rate': emp.get('fcr_rate', 70),
                        'avg_resolution_time': emp.get('avg_resolution_time', 120),
                        'experience_level': emp.get('experience_level', 1),
                        'workload_capacity': emp.get('workload_capacity', 20),
                    }
                    records.append(record)
            
            df = pd.DataFrame(records)
            
            # Calculate scaling parameters
            scaling_params = {
                'workload_mean': float(df['current_workload'].mean()),
                'workload_std': float(df['current_workload'].std()),
                'capacity_mean': float(df['workload_capacity'].mean()),
            }
            
            return df, scaling_params
        except Exception as e:
            logger.error(f"Error preparing workload dataset: {e}")
            return pd.DataFrame(), {}
    
    def prepare_fcr_dataset(self, tickets: List[Dict]) -> Tuple[np.ndarray, List[str]]:
        """
        Prepare features for FCR prediction
        
        Args:
            tickets: List of ticket dictionaries
            
        Returns:
            Tuple of (feature_array, feature_names)
        """
        try:
            features_list = []
            feature_names = [
                'priority', 'reopen_count', 'reassignment_count', 
                'duration', 'day_of_week', 'hour_of_day',
                'agent_fcr_rate', 'agent_sla_rate', 'agent_avg_resolution_time'
            ]
            
            for ticket in tickets:
                features = self.extract_ticket_features(ticket)
                feature_vector = [
                    features.get('priority', 3),
                    features.get('reopen_count', 0),
                    features.get('reassignment_count', 0),
                    features.get('resolution_time', 120),
                    features.get('day_of_week', 2),
                    features.get('hour_of_day', 12),
                    features.get('agent_fcr_rate', 0.7),
                    features.get('agent_sla_rate', 0.85),
                    features.get('agent_avg_resolution_time', 120),
                ]
                features_list.append(feature_vector)
            
            return np.array(features_list), feature_names
        except Exception as e:
            logger.error(f"Error preparing FCR dataset: {e}")
            return np.array([]), []
    
    def normalize_features(self, features: np.ndarray, fit: bool = False) -> np.ndarray:
        """
        Normalize features using StandardScaler
        
        Args:
            features: Feature array to normalize
            fit: Whether to fit the scaler on this data
            
        Returns:
            Normalized features
        """
        try:
            if fit:
                return self.scaler.fit_transform(features)
            else:
                return self.scaler.transform(features)
        except Exception as e:
            logger.error(f"Error normalizing features: {e}")
            return features
    
    def create_time_series_data(self, tickets: List[Dict], window_size: int = 7) -> Tuple[pd.DataFrame, List[str]]:
        """
        Create time series dataset from ticket data
        
        Args:
            tickets: List of tickets with timestamps
            window_size: Rolling window size in days
            
        Returns:
            Tuple of (DataFrame, feature_names)
        """
        try:
            df = pd.DataFrame(tickets)
            
            if 'created_at' not in df.columns:
                return pd.DataFrame(), []
            
            df['created_at'] = pd.to_datetime(df['created_at'])
            df = df.sort_values('created_at')
            df.set_index('created_at', inplace=True)
            
            # Aggregate by day
            daily_data = df.resample('D').agg({
                'ticket_id': 'count',
                'sla_met': 'mean',
                'fcr': 'mean',
                'duration': 'mean',
                'reopen_count': 'sum',
            }).rename(columns={'ticket_id': 'volume'})
            
            # Create rolling features
            daily_data['volume_ma7'] = daily_data['volume'].rolling(window=window_size).mean()
            daily_data['volume_std7'] = daily_data['volume'].rolling(window=window_size).std()
            daily_data['sla_ma7'] = daily_data['sla_met'].rolling(window=window_size).mean()
            daily_data['fcr_ma7'] = daily_data['fcr'].rolling(window=window_size).mean()
            
            daily_data = daily_data.fillna(method='bfill').fillna(method='ffill')
            
            feature_names = ['volume', 'sla_met', 'fcr', 'duration', 'reopen_count',
                           'volume_ma7', 'volume_std7', 'sla_ma7', 'fcr_ma7']
            
            return daily_data, feature_names
        except Exception as e:
            logger.error(f"Error creating time series data: {e}")
            return pd.DataFrame(), []
    
    def handle_missing_values(self, df: pd.DataFrame, strategy: str = 'mean') -> pd.DataFrame:
        """
        Handle missing values in dataframe
        
        Args:
            df: Input dataframe
            strategy: 'mean', 'median', 'forward_fill', or 'drop'
            
        Returns:
            Cleaned dataframe
        """
        try:
            if strategy == 'drop':
                return df.dropna()
            elif strategy == 'mean':
                return df.fillna(df.mean())
            elif strategy == 'median':
                return df.fillna(df.median())
            elif strategy == 'forward_fill':
                return df.fillna(method='ffill').fillna(method='bfill')
            else:
                return df
        except Exception as e:
            logger.error(f"Error handling missing values: {e}")
            return df
    
    def remove_outliers(self, df: pd.DataFrame, columns: List[str], threshold: float = 3.0) -> pd.DataFrame:
        """
        Remove outliers using z-score
        
        Args:
            df: Input dataframe
            columns: Columns to check for outliers
            threshold: Z-score threshold (default 3.0)
            
        Returns:
            Dataframe with outliers removed
        """
        try:
            df_cleaned = df.copy()
            for col in columns:
                if col in df_cleaned.columns:
                    z_scores = np.abs((df_cleaned[col] - df_cleaned[col].mean()) / df_cleaned[col].std())
                    df_cleaned = df_cleaned[z_scores <= threshold]
            return df_cleaned
        except Exception as e:
            logger.error(f"Error removing outliers: {e}")
            return df
