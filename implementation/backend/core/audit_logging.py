"""
KOSMOS DAR Audit Logging Service

Comprehensive audit logging for authentication, API requests, security events,
and administrative actions. Stores logs in PostgreSQL for compliance.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import text

from core.database import get_db

logger = structlog.get_logger()


# ============================================================================
# TYPES
# ============================================================================

class AuditEventType(str, Enum):
    """Audit event types."""
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    API_REQUEST = "api_request"
    SECURITY_EVENT = "security_event"
    DATA_ACCESS = "data_access"
    CONFIGURATION_CHANGE = "configuration_change"
    ADMIN_ACTION = "admin_action"
    AGENT_ACTION = "agent_action"
    COST_EVENT = "cost_event"
    OTHER = "other"


class AuditSeverity(str, Enum):
    """Audit severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditLogEntry(BaseModel):
    """Audit log entry model."""
    id: str
    event_type: AuditEventType
    severity: AuditSeverity
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# AUDIT LOGGER
# ============================================================================

class AuditLogger:
    """
    Centralized audit logging service.
    
    Features:
    - Comprehensive event logging
    - PostgreSQL storage for compliance
    - Structured logging with context
    - Log retention policies
    - Search and query capabilities
    """
    
    def __init__(self):
        self.logger = logger.bind(component="AuditLogger")
    
    async def log(
        self,
        event_type: AuditEventType,
        action: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.INFO
    ) -> str:
        """
        Log an audit event.
        
        Args:
            event_type: Type of event
            action: Action performed
            user_id: User ID (if applicable)
            tenant_id: Tenant ID (if applicable)
            resource_type: Type of resource accessed
            resource_id: ID of resource accessed
            details: Additional details
            ip_address: Client IP address
            user_agent: User agent string
            success: Whether action succeeded
            error_message: Error message if failed
            severity: Severity level
        
        Returns:
            Audit log entry ID
        """
        entry_id = str(uuid4())
        
        entry = AuditLogEntry(
            id=entry_id,
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message,
        )
        
        # Store in database
        try:
            async for db in get_db():
                await db.execute(
                    text("""
                        INSERT INTO audit.events (
                            id, event_type, severity, user_id, tenant_id,
                            resource_type, resource_id, action, details,
                            ip_address, user_agent, success, error_message, created_at
                        ) VALUES (
                            :id, :event_type, :severity, :user_id, :tenant_id,
                            :resource_type, :resource_id, :action, :details,
                            :ip_address, :user_agent, :success, :error_message, :created_at
                        )
                    """),
                    {
                        "id": entry_id,
                        "event_type": event_type.value,
                        "severity": severity.value,
                        "user_id": user_id,
                        "tenant_id": tenant_id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "action": action,
                        "details": str(details or {}),
                        "ip_address": ip_address,
                        "user_agent": user_agent,
                        "success": success,
                        "error_message": error_message,
                        "created_at": datetime.utcnow(),
                    }
                )
                await db.commit()
                break
        except Exception as e:
            # Log to structured logger even if DB fails
            self.logger.error("Failed to store audit log in database", error=str(e), entry_id=entry_id)
            # Continue - audit log is still in structured logs
        
        # Also log to structured logger
        log_level = severity.value
        log_data = {
            "audit_id": entry_id,
            "event_type": event_type.value,
            "action": action,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "success": success,
        }
        
        if error_message:
            log_data["error"] = error_message
        
        if log_level == "critical":
            self.logger.critical("Audit log", **log_data)
        elif log_level == "error":
            self.logger.error("Audit log", **log_data)
        elif log_level == "warning":
            self.logger.warning("Audit log", **log_data)
        else:
            self.logger.info("Audit log", **log_data)
        
        return entry_id
    
    async def log_authentication(
        self,
        action: str,
        user_id: Optional[str] = None,
        success: bool = True,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        error_message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log authentication event."""
        return await self.log(
            event_type=AuditEventType.AUTHENTICATION,
            action=action,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message,
            details=details,
            severity=AuditSeverity.ERROR if not success else AuditSeverity.INFO
        )
    
    async def log_api_request(
        self,
        method: str,
        path: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        status_code: int = 200,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log API request."""
        success = 200 <= status_code < 400
        severity = AuditSeverity.ERROR if status_code >= 500 else (
            AuditSeverity.WARNING if status_code >= 400 else AuditSeverity.INFO
        )
        
        return await self.log(
            event_type=AuditEventType.API_REQUEST,
            action=f"{method} {path}",
            user_id=user_id,
            tenant_id=tenant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=None if success else f"HTTP {status_code}",
            details={
                **(details or {}),
                "method": method,
                "path": path,
                "status_code": status_code,
            },
            severity=severity
        )
    
    async def log_security_event(
        self,
        action: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.WARNING
    ) -> str:
        """Log security event."""
        return await self.log(
            event_type=AuditEventType.SECURITY_EVENT,
            action=action,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,  # Security events are typically failures/threats
            details=details,
            severity=severity
        )
    
    async def log_data_access(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """Log data access event."""
        return await self.log(
            event_type=AuditEventType.DATA_ACCESS,
            action=action,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            success=success,
            details=details,
            severity=AuditSeverity.INFO
        )


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_audit_logger: Optional[AuditLogger] = None


async def get_audit_logger() -> AuditLogger:
    """Get audit logger singleton."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def log_audit_event(
    event_type: AuditEventType,
    action: str,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    **kwargs
) -> str:
    """Convenience function to log audit event."""
    logger_instance = await get_audit_logger()
    return await logger_instance.log(
        event_type=event_type,
        action=action,
        user_id=user_id,
        tenant_id=tenant_id,
        **kwargs
    )
