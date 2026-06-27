"""
Database Integration Module

Handles communication with backend PostgreSQL database
"""

import logging
import os
import time
from typing import List, Dict, Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from pathlib import Path

from dotenv import load_dotenv

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env', override=True)
if not os.getenv('DATABASE_URL') and os.getenv('\ufeffDATABASE_URL'):
    os.environ['DATABASE_URL'] = os.getenv('\ufeffDATABASE_URL', '')


class DatabaseConnector:
    """Manages database connections and queries"""
    
    def __init__(self):
        self.conn = None
        self.last_error = None
        self.available = psycopg2 is not None and RealDictCursor is not None
        if not self.available:
            logger.warning(
                "psycopg2 is not installed; database-backed ML features will be unavailable until the dependency is fixed."
            )

    def _resolve_connection_string(self, sslmode: str = 'prefer') -> str:
        raw_url = (os.getenv('DATABASE_URL') or os.getenv('\ufeffDATABASE_URL') or '').strip()
        if not raw_url:
            # Keep a local default for development if DATABASE_URL is missing.
            raw_url = 'postgresql://user:password@localhost:5432/workwise_db'

        try:
            parsed = urlsplit(raw_url)
            host = (parsed.hostname or '').lower()
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))

            # Apply sslmode if not already set
            if 'sslmode' not in query:
                query['sslmode'] = sslmode
            
            # Set connection timeout for remote hosts
            if host and host not in {'localhost', '127.0.0.1'}:
                if 'connect_timeout' not in query:
                    query['connect_timeout'] = '10'

            return urlunsplit((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(query),
                parsed.fragment,
            ))
        except Exception:
            return raw_url
    
    def connect(self, max_retries: int = 3) -> bool:
        """Establish database connection with retry logic and SSL fallback.
        
        Args:
            max_retries: Maximum number of connection attempts
            
        Returns:
            True if connected, False otherwise
        """
        if not self.available:
            self.last_error = "psycopg2 and RealDictCursor are unavailable"
            logger.warning("Database connector is unavailable because psycopg2 is not installed")
            return False
        
        # Try multiple SSL modes if initial mode fails
        ssl_modes = ['prefer', 'allow', 'disable']
        
        for ssl_mode in ssl_modes:
            connection_string = self._resolve_connection_string(sslmode=ssl_mode)
            logger.info(f"Attempting connection with sslmode={ssl_mode}...")
            
            for attempt in range(max_retries):
                try:
                    self.conn = psycopg2.connect(connection_string, connect_timeout=10)
                    self.last_error = None
                    logger.info(f"✅ Database connected successfully with sslmode={ssl_mode}")
                    return True
                except psycopg2.OperationalError as e:
                    error_msg = str(e).lower()
                    # SSL-specific errors should try next SSL mode
                    if 'ssl' in error_msg or 'certificate' in error_msg or 'decryption' in error_msg:
                        logger.warning(f"SSL error on attempt {attempt + 1}: {e}")
                        break  # Try next SSL mode
                    else:
                        self.last_error = str(e)
                        if attempt < max_retries - 1:
                            wait_time = 2 ** attempt  # Exponential backoff
                            logger.warning(f"Connection attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait_time}s...")
                            time.sleep(wait_time)
                        else:
                            logger.error(f"All connection attempts failed: {e}")
                except Exception as e:
                    self.last_error = str(e)
                    logger.error(f"Unexpected error on attempt {attempt + 1}: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)
        
        self.last_error = "Failed to connect with all SSL modes"
        logger.error("❌ Database connection failed with all SSL modes")
        return False

    def _connection_is_open(self) -> bool:
        """Check if a psycopg2 connection exists and is still open."""
        return self.conn is not None and getattr(self.conn, 'closed', 1) == 0

    def _ensure_connection(self) -> bool:
        """Ensure there is an active DB connection, reconnecting when stale."""
        if self._connection_is_open():
            return True
        self.conn = None
        return self.connect(max_retries=2)  # Use 2 retries for mid-connection checks
    
    def disconnect(self):
        """Close database connection"""
        if self._connection_is_open():
            self.conn.close()
            logger.info("Database disconnected")
        self.conn = None
    
    def get_tickets(self, days_back: int = 90, group_id: Optional[int] = None, strict: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch ticket data from database
        
        Args:
            days_back: Number of days of historical data
            group_id: Optional assignment group ID filter
            strict: If True, raise exceptions instead of returning empty list
            
        Returns:
            List of ticket dictionaries
        """
        try:
            if not self.available:
                self.last_error = "Database connector is unavailable"
                if strict:
                    raise RuntimeError(self.last_error)
                return []
            if not self._ensure_connection():
                self.last_error = self.last_error or "Database connection could not be established"
                if strict:
                    raise RuntimeError(self.last_error)
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                SELECT 
                    t.ticket_id,
                    t.assignment_group_id,
                    t.assigned_to_id,
                    t.category_id,
                    t.priority_id,
                    t.status_id,
                    t.created_date AS created_at,
                    t.updated_at,
                    t.resolved_date AS resolved_at,
                    t.made_sla AS sla_met,
                    t.fcr,
                    t.reopen_count,
                    t.reassignment_count,
                    t.duration
                FROM tickets t
                WHERE t.created_date >= NOW() - (%s * INTERVAL '1 day')
                """
                
                params = [int(days_back)]
                if group_id is not None:
                    query += " AND t.assignment_group_id = %s"
                    params.append(group_id)
                
                query += " ORDER BY t.created_date DESC"
                
                cur.execute(query, params)
                rows = cur.fetchall()
                self.last_error = None
                return rows
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error fetching tickets: {e}")
            # Close connection on error to force reconnection on next attempt
            self.disconnect()
            if strict:
                raise
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
            if not self._ensure_connection():
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
            if not self._ensure_connection():
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
            if not self._ensure_connection():
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
            if not self._ensure_connection():
                return []
            
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = "SELECT id, name FROM ticket_categories ORDER BY name"
                cur.execute(query)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching categories: {e}")
            return []
