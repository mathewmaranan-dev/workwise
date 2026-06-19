"""
Database Integration Module

Handles communication with backend PostgreSQL database
"""

import logging
import os
from typing import List, Dict, Any, Optional

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

logger = logging.getLogger(__name__)


class DatabaseConnector:
    """Manages database connections and queries"""
    
    def __init__(self):
        self.connection_string = os.getenv(
            'DATABASE_URL',
            'postgresql://user:password@localhost:5432/workwise'
        )
        self.conn = None
        self.available = psycopg2 is not None and RealDictCursor is not None
        if not self.available:
            logger.warning(
                "psycopg2 is not installed; database-backed ML features will be unavailable until the dependency is fixed."
            )
    
    def connect(self) -> bool:
        """Establish database connection"""
        if not self.available:
            logger.warning("Database connector is unavailable because psycopg2 is not installed")
            return False
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("✅ Database connected")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database disconnected")
    
    def get_tickets(self, days_back: int = 90, group_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch ticket data from database
        
        Args:
            days_back: Number of days of historical data
            group_id: Optional assignment group ID filter
            
        Returns:
            List of ticket dictionaries
        """
        try:
            if not self.available:
                return []
            if not self.conn:
                self.connect()
            if not self.conn:
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT 
                    t.id as ticket_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.category_id,
                    c.name as category,
                    t.assignment_group_id,
                    t.assigned_to,
                    t.created_at,
                    t.updated_at,
                    t.resolved_at,
                    t.sla_met,
                    t.fcr,
                    t.reopen_count,
                    t.reassignment_count,
                    EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at))/3600 as duration,
                    u.name as agent_name,
                    u.experience_level
                FROM tickets t
                LEFT JOIN ticket_categories c ON t.category_id = c.id
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.created_at >= NOW() - INTERVAL '{days_back} days'
                """
                
                params = []
                if group_id:
                    query += " AND t.assignment_group_id = %s"
                    params.append(group_id)
                
                query += " ORDER BY t.created_at DESC"
                
                cur.execute(query, params)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching tickets: {e}")
            return []
    
    def get_employees(self, group_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch employee data
        
        Args:
            group_id: Optional assignment group ID filter
            
        Returns:
            List of employee dictionaries
        """
        try:
            if not self.available:
                return []
            if not self.conn:
                self.connect()
            if not self.conn:
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT 
                    u.id,
                    u.name,
                    u.email,
                    u.experience_level,
                    ag.id as group_id,
                    ag.name as group_name,
                    COUNT(t.id) as ticket_count,
                    AVG(CASE WHEN t.sla_met THEN 1 ELSE 0 END) * 100 as sla_compliance,
                    AVG(CASE WHEN t.fcr THEN 1 ELSE 0 END) * 100 as fcr_rate,
                    AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at))/3600) as avg_resolution_time
                FROM users u
                LEFT JOIN assignment_groups ag ON u.assignment_group_id = ag.id
                LEFT JOIN tickets t ON u.id = t.assigned_to AND t.created_at >= NOW() - INTERVAL '30 days'
                WHERE u.role = 'agent'
                """
                
                if group_id:
                    query += " AND ag.id = %s"
                
                query += " GROUP BY u.id, u.name, u.email, u.experience_level, ag.id, ag.name"
                query += " ORDER BY u.name"
                
                params = [group_id] if group_id else []
                cur.execute(query, params)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching employees: {e}")
            return []
    
    def get_assignment_groups(self) -> List[Dict[str, Any]]:
        """Fetch all assignment groups"""
        try:
            if not self.available:
                return []
            if not self.conn:
                self.connect()
            if not self.conn:
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT 
                    ag.id,
                    ag.name,
                    COUNT(DISTINCT u.id) as team_size,
                    COUNT(DISTINCT t.id) as total_tickets_30d,
                    AVG(CASE WHEN t.sla_met THEN 1 ELSE 0 END) * 100 as group_sla_compliance
                FROM assignment_groups ag
                LEFT JOIN users u ON ag.id = u.assignment_group_id AND u.role = 'agent'
                LEFT JOIN tickets t ON ag.id = t.assignment_group_id AND t.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY ag.id, ag.name
                ORDER BY ag.name
                """
                cur.execute(query)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching assignment groups: {e}")
            return []
    
    def save_model_prediction(self, prediction_type: str, ticket_id: int, 
                             prediction: float, confidence: float) -> bool:
        """
        Save model prediction to database
        
        Args:
            prediction_type: Type of prediction (fcr_risk, workload_risk, etc.)
            ticket_id: Ticket ID
            prediction: Predicted value
            confidence: Confidence score
            
        Returns:
            Success status
        """
        try:
            if not self.available:
                return False
            if not self.conn:
                self.connect()
            if not self.conn:
                return False
            
            with self.conn.cursor() as cur:
                query = """
                INSERT INTO ml_predictions 
                (prediction_type, ticket_id, prediction_value, confidence, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (prediction_type, ticket_id) 
                DO UPDATE SET prediction_value = %s, confidence = %s, updated_at = NOW()
                """
                cur.execute(query, (prediction_type, ticket_id, prediction, confidence, 
                                   prediction, confidence))
                self.conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error saving prediction: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def get_ticket_categories(self) -> List[Dict[str, Any]]:
        """Fetch ticket categories"""
        try:
            if not self.available:
                return []
            if not self.conn:
                self.connect()
            if not self.conn:
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = "SELECT id, name FROM ticket_categories ORDER BY name"
                cur.execute(query)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching categories: {e}")
            return []
