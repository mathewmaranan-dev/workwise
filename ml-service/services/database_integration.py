"""
Database Integration Module

Handles communication with backend PostgreSQL database
"""

import logging
import os
import time
from typing import List, Dict, Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

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
        self.last_error = None
        self.available = psycopg2 is not None and RealDictCursor is not None
        if not self.available:
            logger.warning(
                "psycopg2 is not installed; database-backed ML features will be unavailable until the dependency is fixed."
            )
    
    def _resolve_connection_string(self, sslmode: str = 'prefer') -> str:
        """Build connection string with specified SSL mode."""
        raw_url = os.getenv('DATABASE_URL', self.connection_string)
        
        try:
            parsed = urlsplit(raw_url)
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            query['sslmode'] = sslmode
            
            # Add connection timeout for remote hosts
            if parsed.hostname and parsed.hostname not in {'localhost', '127.0.0.1'}:
                query['connect_timeout'] = '10'
            
            return urlunsplit((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(query),
                parsed.fragment,
            ))
        except Exception:
            return self.connection_string
    
    def connect(self, max_retries: int = 2) -> bool:
        """Establish database connection with retry logic and SSL fallback.
        
        OPTIMIZATION FOR 30s PROXY TIMEOUT:
        - max_retries=2 (not 3) to reduce total retry time
        - Constant 0.5s backoff (not exponential 2^n) for speed
        - SSL errors skip retry and go straight to next mode
        
        Total max time per connect: ~3-4 seconds instead of 10+
        
        Args:
            max_retries: Maximum number of connection attempts per SSL mode
            
        Returns:
            True if connected, False otherwise
        """
        if not self.available:
            self.last_error = "psycopg2 and RealDictCursor are unavailable"
            logger.warning("Database connector is unavailable because psycopg2 is not installed")
            return False
        
        ssl_modes = ['prefer', 'allow', 'disable']
        
        for ssl_mode in ssl_modes:
            connection_string = self._resolve_connection_string(sslmode=ssl_mode)
            logger.info(f"Attempting connection with sslmode={ssl_mode}...")
            
            for attempt in range(max_retries):
                try:
                    self.conn = psycopg2.connect(connection_string, connect_timeout=10)
                    self.last_error = None
                    logger.info(f"✅ Database connected with sslmode={ssl_mode}")
                    return True
                except psycopg2.OperationalError as e:
                    error_msg = str(e).lower()
                    if 'ssl' in error_msg or 'certificate' in error_msg or 'decryption' in error_msg:
                        logger.warning(f"SSL error - trying next mode: {e}")
                        break  # SSL errors: don't retry, go to next mode immediately
                    else:
                        self.last_error = str(e)
                        if attempt < max_retries - 1:
                            # Constant 0.5s backoff (not exponential)
                            logger.warning(f"Retry {attempt + 1}/{max_retries} in 0.5s... {e}")
                            time.sleep(0.5)
                except Exception as e:
                    self.last_error = str(e)
                    logger.error(f"Connection error: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(0.5)
        
        self.last_error = "Connection failed on all SSL modes"
        logger.error("❌ Database connection exhausted all SSL modes")
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
            # Close broken connection to force reconnection on next attempt
            self.disconnect()
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
            self.disconnect()
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
            self.disconnect()
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
            self.disconnect()
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
            self.disconnect()
            return []
