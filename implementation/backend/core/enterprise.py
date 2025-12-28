"""
KOSMOS V2.0 Enterprise Features

SSO integration, RBAC permissions, audit compliance,
and data residency for enterprise deployments.
"""

from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import asyncio
import hashlib
import hmac
import json
import logging
import re
from uuid import uuid4

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================================
# Enums and Types
# ============================================================================

class SSOProvider(str, Enum):
    """Supported SSO providers."""
    SAML = "saml"
    OIDC = "oidc"
    OAUTH2 = "oauth2"
    LDAP = "ldap"
    AZURE_AD = "azure_ad"
    OKTA = "okta"
    GOOGLE = "google"
    GITHUB = "github"


class PermissionAction(str, Enum):
    """Permission actions."""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    ADMIN = "admin"


class ResourceCategory(str, Enum):
    """Categories of resources for RBAC."""
    AGENTS = "agents"
    WORKFLOWS = "workflows"
    TOOLS = "tools"
    DATA = "data"
    SETTINGS = "settings"
    USERS = "users"
    BILLING = "billing"
    AUDIT = "audit"
    GOVERNANCE = "governance"


class AuditEventType(str, Enum):
    """Types of audit events."""
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_FAILED = "auth.failed"
    USER_CREATE = "user.create"
    USER_UPDATE = "user.update"
    USER_DELETE = "user.delete"
    ROLE_ASSIGN = "role.assign"
    ROLE_REVOKE = "role.revoke"
    DATA_ACCESS = "data.access"
    DATA_EXPORT = "data.export"
    DATA_DELETE = "data.delete"
    AGENT_INVOKE = "agent.invoke"
    TOOL_CALL = "tool.call"
    WORKFLOW_EXECUTE = "workflow.execute"
    SETTINGS_CHANGE = "settings.change"
    GOVERNANCE_VOTE = "governance.vote"
    SECURITY_ALERT = "security.alert"


class DataRegion(str, Enum):
    """Supported data regions."""
    US_EAST = "us-east"
    US_WEST = "us-west"
    EU_WEST = "eu-west"
    EU_CENTRAL = "eu-central"
    APAC_EAST = "apac-east"
    APAC_SOUTH = "apac-south"


class ComplianceFramework(str, Enum):
    """Compliance frameworks."""
    SOC2 = "soc2"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    ISO27001 = "iso27001"
    CCPA = "ccpa"


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class SSOConfig:
    """SSO provider configuration."""
    provider: SSOProvider
    client_id: str
    client_secret_hash: str  # Hashed, never stored plain
    issuer_url: str
    redirect_uri: str
    scopes: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    # SAML-specific
    idp_entity_id: Optional[str] = None
    idp_sso_url: Optional[str] = None
    idp_certificate: Optional[str] = None

    # Attribute mapping
    attribute_map: Dict[str, str] = field(default_factory=lambda: {
        "email": "email",
        "name": "name",
        "groups": "groups"
    })


@dataclass
class Permission:
    """A single permission."""
    resource: ResourceCategory
    action: PermissionAction
    conditions: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Role:
    """A role with permissions."""
    role_id: str
    name: str
    description: str
    permissions: List[Permission]
    is_system: bool = False  # System roles can't be deleted
    tenant_id: Optional[str] = None  # None = global role
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RoleAssignment:
    """Assignment of a role to a user."""
    assignment_id: str
    user_id: str
    role_id: str
    tenant_id: str
    assigned_by: str
    assigned_at: datetime
    expires_at: Optional[datetime] = None
    scope: Dict[str, Any] = field(default_factory=dict)  # Optional scope restrictions


@dataclass
class AuditEvent:
    """An audit event."""
    event_id: str
    event_type: AuditEventType
    timestamp: datetime
    actor_id: str
    actor_type: str  # user, agent, system
    tenant_id: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: Optional[str] = None
    outcome: str = "success"  # success, failure, denied
    details: Dict[str, Any] = field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    risk_score: float = 0.0


@dataclass
class DataResidencyConfig:
    """Data residency configuration for a tenant."""
    tenant_id: str
    primary_region: DataRegion
    allowed_regions: List[DataRegion]
    restricted_regions: List[DataRegion] = field(default_factory=list)
    compliance_frameworks: List[ComplianceFramework] = field(default_factory=list)
    data_retention_days: int = 365
    encryption_required: bool = True
    pii_handling: str = "mask"  # mask, encrypt, delete
    cross_border_allowed: bool = False


@dataclass
class ComplianceReport:
    """A compliance report."""
    report_id: str
    tenant_id: str
    framework: ComplianceFramework
    generated_at: datetime
    period_start: datetime
    period_end: datetime
    status: str  # compliant, non_compliant, partial
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    evidence: Dict[str, Any]


# ============================================================================
# SSO Manager
# ============================================================================

class SSOManager:
    """
    Manages SSO integration with various providers.

    Supports SAML, OIDC, OAuth2, and enterprise identity providers.
    """

    def __init__(self):
        self._configs: Dict[str, Dict[str, SSOConfig]] = defaultdict(dict)  # tenant_id -> provider -> config
        self._sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session data
        self._nonces: Set[str] = set()  # For replay protection

    async def configure_sso(
        self,
        tenant_id: str,
        provider: SSOProvider,
        client_id: str,
        client_secret: str,
        issuer_url: str,
        redirect_uri: str,
        **kwargs
    ) -> SSOConfig:
        """Configure SSO for a tenant."""
        # Hash the client secret
        secret_hash = hashlib.sha256(client_secret.encode()).hexdigest()

        config = SSOConfig(
            provider=provider,
            client_id=client_id,
            client_secret_hash=secret_hash,
            issuer_url=issuer_url,
            redirect_uri=redirect_uri,
            scopes=kwargs.get("scopes", ["openid", "email", "profile"]),
            metadata=kwargs.get("metadata", {}),
            idp_entity_id=kwargs.get("idp_entity_id"),
            idp_sso_url=kwargs.get("idp_sso_url"),
            idp_certificate=kwargs.get("idp_certificate"),
            attribute_map=kwargs.get("attribute_map", {
                "email": "email",
                "name": "name",
                "groups": "groups"
            })
        )

        self._configs[tenant_id][provider.value] = config

        logger.info(f"Configured SSO {provider.value} for tenant {tenant_id}")

        return config

    async def get_sso_config(
        self,
        tenant_id: str,
        provider: Optional[SSOProvider] = None
    ) -> Optional[SSOConfig]:
        """Get SSO configuration for a tenant."""
        tenant_configs = self._configs.get(tenant_id, {})

        if provider:
            return tenant_configs.get(provider.value)

        # Return first enabled config
        for config in tenant_configs.values():
            if config.enabled:
                return config

        return None

    async def initiate_sso_login(
        self,
        tenant_id: str,
        provider: SSOProvider,
        redirect_after: Optional[str] = None
    ) -> Dict[str, Any]:
        """Initiate SSO login flow."""
        config = await self.get_sso_config(tenant_id, provider)

        if not config:
            return {"error": f"SSO not configured for provider: {provider.value}"}

        # Generate state and nonce
        state = str(uuid4())
        nonce = str(uuid4())
        self._nonces.add(nonce)

        # Store session state
        session_id = str(uuid4())
        self._sessions[session_id] = {
            "tenant_id": tenant_id,
            "provider": provider.value,
            "state": state,
            "nonce": nonce,
            "redirect_after": redirect_after,
            "created_at": datetime.utcnow().isoformat()
        }

        # Build authorization URL based on provider
        if config.provider in [SSOProvider.OIDC, SSOProvider.OAUTH2, SSOProvider.OKTA, SSOProvider.AZURE_AD]:
            auth_url = self._build_oidc_auth_url(config, state, nonce)
        elif config.provider == SSOProvider.SAML:
            auth_url = self._build_saml_auth_url(config, state)
        else:
            auth_url = self._build_oauth_auth_url(config, state)

        return {
            "session_id": session_id,
            "auth_url": auth_url,
            "provider": provider.value
        }

    def _build_oidc_auth_url(
        self,
        config: SSOConfig,
        state: str,
        nonce: str
    ) -> str:
        """Build OIDC authorization URL."""
        params = {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "scope": " ".join(config.scopes),
            "state": state,
            "nonce": nonce
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{config.issuer_url}/authorize?{query}"

    def _build_saml_auth_url(
        self,
        config: SSOConfig,
        state: str
    ) -> str:
        """Build SAML authorization URL."""
        # In real implementation, generate SAML AuthnRequest
        return f"{config.idp_sso_url}?RelayState={state}"

    def _build_oauth_auth_url(
        self,
        config: SSOConfig,
        state: str
    ) -> str:
        """Build OAuth2 authorization URL."""
        params = {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "scope": " ".join(config.scopes),
            "state": state
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{config.issuer_url}/authorize?{query}"

    async def complete_sso_login(
        self,
        session_id: str,
        code: str,
        state: str
    ) -> Dict[str, Any]:
        """Complete SSO login flow."""
        session = self._sessions.get(session_id)

        if not session:
            return {"error": "Invalid session"}

        if session["state"] != state:
            return {"error": "State mismatch - possible CSRF attack"}

        # Get config
        config = await self.get_sso_config(
            session["tenant_id"],
            SSOProvider(session["provider"])
        )

        if not config:
            return {"error": "SSO configuration not found"}

        # Exchange code for tokens (simulated)
        # In real implementation, call the token endpoint
        user_info = await self._exchange_code_for_user(config, code)

        if "error" in user_info:
            return user_info

        # Map attributes
        mapped_user = self._map_user_attributes(config, user_info)

        # Cleanup
        del self._sessions[session_id]

        return {
            "success": True,
            "user": mapped_user,
            "tenant_id": session["tenant_id"],
            "redirect_after": session.get("redirect_after")
        }

    async def _exchange_code_for_user(
        self,
        config: SSOConfig,
        code: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for user info."""
        # In real implementation, make HTTP calls to token and userinfo endpoints
        # For now, return mock data
        return {
            "sub": str(uuid4()),
            "email": "user@example.com",
            "name": "Example User",
            "groups": ["users"]
        }

    def _map_user_attributes(
        self,
        config: SSOConfig,
        user_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Map IdP attributes to KOSMOS user attributes."""
        mapped = {}

        for kosmos_attr, idp_attr in config.attribute_map.items():
            if idp_attr in user_info:
                mapped[kosmos_attr] = user_info[idp_attr]

        mapped["idp_id"] = user_info.get("sub")

        return mapped

    async def logout(
        self,
        session_id: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Logout from SSO session."""
        if session_id in self._sessions:
            del self._sessions[session_id]

        config = await self.get_sso_config(tenant_id)

        if config:
            # Build logout URL if supported
            logout_url = f"{config.issuer_url}/logout"
            return {"success": True, "logout_url": logout_url}

        return {"success": True}


# ============================================================================
# RBAC Manager
# ============================================================================

class RBACManager:
    """
    Role-Based Access Control manager.

    Manages roles, permissions, and access decisions.
    """

    def __init__(self):
        self._roles: Dict[str, Role] = {}
        self._assignments: Dict[str, List[RoleAssignment]] = defaultdict(list)  # user_id -> assignments
        self._permission_cache: Dict[str, Set[str]] = {}  # user:tenant -> permissions set

        # Initialize system roles
        self._init_system_roles()

    def _init_system_roles(self):
        """Initialize built-in system roles."""
        system_roles = [
            Role(
                role_id="super_admin",
                name="Super Admin",
                description="Full system access",
                permissions=[
                    Permission(resource, PermissionAction.ADMIN)
                    for resource in ResourceCategory
                ],
                is_system=True
            ),
            Role(
                role_id="tenant_admin",
                name="Tenant Admin",
                description="Full tenant access",
                permissions=[
                    Permission(resource, PermissionAction.ADMIN)
                    for resource in ResourceCategory
                    if resource != ResourceCategory.BILLING
                ],
                is_system=True
            ),
            Role(
                role_id="agent_operator",
                name="Agent Operator",
                description="Can run and manage agents",
                permissions=[
                    Permission(ResourceCategory.AGENTS, PermissionAction.EXECUTE),
                    Permission(ResourceCategory.AGENTS, PermissionAction.READ),
                    Permission(ResourceCategory.TOOLS, PermissionAction.EXECUTE),
                    Permission(ResourceCategory.TOOLS, PermissionAction.READ),
                    Permission(ResourceCategory.WORKFLOWS, PermissionAction.EXECUTE),
                    Permission(ResourceCategory.WORKFLOWS, PermissionAction.READ),
                ],
                is_system=True
            ),
            Role(
                role_id="viewer",
                name="Viewer",
                description="Read-only access",
                permissions=[
                    Permission(resource, PermissionAction.READ)
                    for resource in ResourceCategory
                    if resource not in [ResourceCategory.BILLING, ResourceCategory.AUDIT]
                ],
                is_system=True
            ),
            Role(
                role_id="data_analyst",
                name="Data Analyst",
                description="Data access and analysis",
                permissions=[
                    Permission(ResourceCategory.DATA, PermissionAction.READ),
                    Permission(ResourceCategory.DATA, PermissionAction.EXECUTE),
                    Permission(ResourceCategory.AGENTS, PermissionAction.READ),
                    Permission(ResourceCategory.WORKFLOWS, PermissionAction.READ),
                ],
                is_system=True
            ),
            Role(
                role_id="security_auditor",
                name="Security Auditor",
                description="Security and audit access",
                permissions=[
                    Permission(ResourceCategory.AUDIT, PermissionAction.READ),
                    Permission(ResourceCategory.GOVERNANCE, PermissionAction.READ),
                    Permission(ResourceCategory.SETTINGS, PermissionAction.READ),
                ],
                is_system=True
            ),
        ]

        for role in system_roles:
            self._roles[role.role_id] = role

    async def create_role(
        self,
        name: str,
        description: str,
        permissions: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> Role:
        """Create a custom role."""
        role_id = str(uuid4())

        permission_objs = [
            Permission(
                resource=ResourceCategory(p["resource"]),
                action=PermissionAction(p["action"]),
                conditions=p.get("conditions", {})
            )
            for p in permissions
        ]

        role = Role(
            role_id=role_id,
            name=name,
            description=description,
            permissions=permission_objs,
            tenant_id=tenant_id
        )

        self._roles[role_id] = role

        logger.info(f"Created role: {name} ({role_id})")

        return role

    async def get_role(self, role_id: str) -> Optional[Role]:
        """Get a role by ID."""
        return self._roles.get(role_id)

    async def list_roles(
        self,
        tenant_id: Optional[str] = None,
        include_system: bool = True
    ) -> List[Role]:
        """List available roles."""
        roles = list(self._roles.values())

        if not include_system:
            roles = [r for r in roles if not r.is_system]

        if tenant_id:
            # Include global roles and tenant-specific roles
            roles = [r for r in roles if r.tenant_id is None or r.tenant_id == tenant_id]

        return roles

    async def assign_role(
        self,
        user_id: str,
        role_id: str,
        tenant_id: str,
        assigned_by: str,
        expires_at: Optional[datetime] = None,
        scope: Optional[Dict[str, Any]] = None
    ) -> RoleAssignment:
        """Assign a role to a user."""
        role = self._roles.get(role_id)
        if not role:
            raise ValueError(f"Role not found: {role_id}")

        assignment = RoleAssignment(
            assignment_id=str(uuid4()),
            user_id=user_id,
            role_id=role_id,
            tenant_id=tenant_id,
            assigned_by=assigned_by,
            assigned_at=datetime.utcnow(),
            expires_at=expires_at,
            scope=scope or {}
        )

        self._assignments[user_id].append(assignment)

        # Invalidate permission cache
        cache_key = f"{user_id}:{tenant_id}"
        if cache_key in self._permission_cache:
            del self._permission_cache[cache_key]

        logger.info(f"Assigned role {role_id} to user {user_id} in tenant {tenant_id}")

        return assignment

    async def revoke_role(
        self,
        user_id: str,
        role_id: str,
        tenant_id: str
    ) -> bool:
        """Revoke a role from a user."""
        assignments = self._assignments.get(user_id, [])

        for i, assignment in enumerate(assignments):
            if assignment.role_id == role_id and assignment.tenant_id == tenant_id:
                del assignments[i]

                # Invalidate cache
                cache_key = f"{user_id}:{tenant_id}"
                if cache_key in self._permission_cache:
                    del self._permission_cache[cache_key]

                logger.info(f"Revoked role {role_id} from user {user_id} in tenant {tenant_id}")
                return True

        return False

    async def get_user_roles(
        self,
        user_id: str,
        tenant_id: str
    ) -> List[Role]:
        """Get all roles assigned to a user in a tenant."""
        now = datetime.utcnow()
        assignments = self._assignments.get(user_id, [])

        roles = []
        for assignment in assignments:
            if assignment.tenant_id != tenant_id:
                continue
            if assignment.expires_at and assignment.expires_at < now:
                continue

            role = self._roles.get(assignment.role_id)
            if role:
                roles.append(role)

        return roles

    async def get_user_permissions(
        self,
        user_id: str,
        tenant_id: str
    ) -> Set[str]:
        """Get all permissions for a user in a tenant."""
        cache_key = f"{user_id}:{tenant_id}"

        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]

        roles = await self.get_user_roles(user_id, tenant_id)

        permissions = set()
        for role in roles:
            for perm in role.permissions:
                perm_str = f"{perm.resource.value}:{perm.action.value}"
                permissions.add(perm_str)

                # Admin implies all actions
                if perm.action == PermissionAction.ADMIN:
                    for action in PermissionAction:
                        permissions.add(f"{perm.resource.value}:{action.value}")

        self._permission_cache[cache_key] = permissions

        return permissions

    async def check_permission(
        self,
        user_id: str,
        tenant_id: str,
        resource: ResourceCategory,
        action: PermissionAction,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if a user has a specific permission."""
        permissions = await self.get_user_permissions(user_id, tenant_id)

        perm_str = f"{resource.value}:{action.value}"
        admin_str = f"{resource.value}:admin"

        if perm_str in permissions or admin_str in permissions:
            # Check conditions if present
            # In real implementation, evaluate conditions against context
            return True

        return False

    async def get_effective_permissions(
        self,
        user_id: str,
        tenant_id: str
    ) -> Dict[str, List[str]]:
        """Get effective permissions grouped by resource."""
        permissions = await self.get_user_permissions(user_id, tenant_id)

        grouped: Dict[str, List[str]] = defaultdict(list)
        for perm in permissions:
            resource, action = perm.split(":")
            grouped[resource].append(action)

        return dict(grouped)


# ============================================================================
# Audit Manager
# ============================================================================

class AuditManager:
    """
    Manages audit logging and compliance reporting.

    Provides comprehensive audit trail for all system activities.
    """

    def __init__(self):
        self._events: List[AuditEvent] = []
        self._event_handlers: List[Callable] = []
        self._retention_days = 365
        self._lock = asyncio.Lock()

    async def log_event(
        self,
        event_type: AuditEventType,
        actor_id: str,
        actor_type: str,
        tenant_id: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
        outcome: str = "success",
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> AuditEvent:
        """Log an audit event."""
        async with self._lock:
            event = AuditEvent(
                event_id=str(uuid4()),
                event_type=event_type,
                timestamp=datetime.utcnow(),
                actor_id=actor_id,
                actor_type=actor_type,
                tenant_id=tenant_id,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                outcome=outcome,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                risk_score=self._calculate_risk_score(event_type, outcome)
            )

            self._events.append(event)

            # Trigger event handlers
            for handler in self._event_handlers:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Audit handler error: {e}")

            # Cleanup old events
            await self._cleanup_old_events()

            return event

    def _calculate_risk_score(
        self,
        event_type: AuditEventType,
        outcome: str
    ) -> float:
        """Calculate risk score for an event."""
        # Base scores by event type
        risk_scores = {
            AuditEventType.AUTH_FAILED: 0.6,
            AuditEventType.AUTH_LOGIN: 0.1,
            AuditEventType.DATA_DELETE: 0.5,
            AuditEventType.DATA_EXPORT: 0.4,
            AuditEventType.SETTINGS_CHANGE: 0.3,
            AuditEventType.ROLE_ASSIGN: 0.3,
            AuditEventType.SECURITY_ALERT: 0.9,
        }

        base_score = risk_scores.get(event_type, 0.1)

        # Adjust for outcome
        if outcome == "failure":
            base_score *= 1.5
        elif outcome == "denied":
            base_score *= 2.0

        return min(1.0, base_score)

    async def _cleanup_old_events(self) -> None:
        """Remove events older than retention period."""
        cutoff = datetime.utcnow() - timedelta(days=self._retention_days)
        self._events = [e for e in self._events if e.timestamp > cutoff]

    def register_handler(self, handler: Callable) -> None:
        """Register an audit event handler."""
        self._event_handlers.append(handler)

    async def query_events(
        self,
        tenant_id: str,
        event_types: Optional[List[AuditEventType]] = None,
        actor_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        outcome: Optional[str] = None,
        min_risk_score: Optional[float] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditEvent]:
        """Query audit events with filters."""
        events = [e for e in self._events if e.tenant_id == tenant_id]

        if event_types:
            events = [e for e in events if e.event_type in event_types]
        if actor_id:
            events = [e for e in events if e.actor_id == actor_id]
        if resource_type:
            events = [e for e in events if e.resource_type == resource_type]
        if start_time:
            events = [e for e in events if e.timestamp >= start_time]
        if end_time:
            events = [e for e in events if e.timestamp <= end_time]
        if outcome:
            events = [e for e in events if e.outcome == outcome]
        if min_risk_score is not None:
            events = [e for e in events if e.risk_score >= min_risk_score]

        # Sort by timestamp descending
        events.sort(key=lambda e: e.timestamp, reverse=True)

        return events[offset:offset + limit]

    async def get_activity_summary(
        self,
        tenant_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get activity summary for a tenant."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        events = [e for e in self._events if e.tenant_id == tenant_id and e.timestamp > cutoff]

        by_type: Dict[str, int] = defaultdict(int)
        by_outcome: Dict[str, int] = defaultdict(int)
        by_actor: Dict[str, int] = defaultdict(int)
        high_risk_events = []

        for event in events:
            by_type[event.event_type.value] += 1
            by_outcome[event.outcome] += 1
            by_actor[event.actor_id] += 1

            if event.risk_score >= 0.7:
                high_risk_events.append({
                    "event_id": event.event_id,
                    "event_type": event.event_type.value,
                    "timestamp": event.timestamp.isoformat(),
                    "risk_score": event.risk_score
                })

        return {
            "period_days": days,
            "total_events": len(events),
            "by_type": dict(by_type),
            "by_outcome": dict(by_outcome),
            "top_actors": sorted(by_actor.items(), key=lambda x: x[1], reverse=True)[:10],
            "high_risk_events": high_risk_events[:20],
            "timestamp": datetime.utcnow().isoformat()
        }

    async def export_audit_log(
        self,
        tenant_id: str,
        start_time: datetime,
        end_time: datetime,
        format: str = "json"
    ) -> Dict[str, Any]:
        """Export audit log for compliance."""
        events = await self.query_events(
            tenant_id=tenant_id,
            start_time=start_time,
            end_time=end_time,
            limit=10000
        )

        export_data = {
            "tenant_id": tenant_id,
            "export_timestamp": datetime.utcnow().isoformat(),
            "period_start": start_time.isoformat(),
            "period_end": end_time.isoformat(),
            "event_count": len(events),
            "events": [
                {
                    "event_id": e.event_id,
                    "event_type": e.event_type.value,
                    "timestamp": e.timestamp.isoformat(),
                    "actor_id": e.actor_id,
                    "actor_type": e.actor_type,
                    "resource_type": e.resource_type,
                    "resource_id": e.resource_id,
                    "action": e.action,
                    "outcome": e.outcome,
                    "details": e.details,
                    "ip_address": e.ip_address,
                    "risk_score": e.risk_score
                }
                for e in events
            ]
        }

        return export_data


# ============================================================================
# Data Residency Manager
# ============================================================================

class DataResidencyManager:
    """
    Manages data residency and compliance requirements.

    Ensures data is stored and processed according to regulatory requirements.
    """

    def __init__(self):
        self._configs: Dict[str, DataResidencyConfig] = {}
        self._region_endpoints: Dict[DataRegion, str] = {
            DataRegion.US_EAST: "us-east-1.kosmos.ai",
            DataRegion.US_WEST: "us-west-1.kosmos.ai",
            DataRegion.EU_WEST: "eu-west-1.kosmos.ai",
            DataRegion.EU_CENTRAL: "eu-central-1.kosmos.ai",
            DataRegion.APAC_EAST: "apac-east-1.kosmos.ai",
            DataRegion.APAC_SOUTH: "apac-south-1.kosmos.ai",
        }

    async def configure_residency(
        self,
        tenant_id: str,
        primary_region: DataRegion,
        allowed_regions: List[DataRegion],
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        **kwargs
    ) -> DataResidencyConfig:
        """Configure data residency for a tenant."""
        config = DataResidencyConfig(
            tenant_id=tenant_id,
            primary_region=primary_region,
            allowed_regions=allowed_regions,
            restricted_regions=kwargs.get("restricted_regions", []),
            compliance_frameworks=compliance_frameworks or [],
            data_retention_days=kwargs.get("data_retention_days", 365),
            encryption_required=kwargs.get("encryption_required", True),
            pii_handling=kwargs.get("pii_handling", "mask"),
            cross_border_allowed=kwargs.get("cross_border_allowed", False)
        )

        self._configs[tenant_id] = config

        logger.info(f"Configured data residency for tenant {tenant_id}: {primary_region.value}")

        return config

    async def get_residency_config(
        self,
        tenant_id: str
    ) -> Optional[DataResidencyConfig]:
        """Get data residency configuration."""
        return self._configs.get(tenant_id)

    async def validate_data_operation(
        self,
        tenant_id: str,
        operation: str,
        target_region: DataRegion,
        data_type: str = "general"
    ) -> Dict[str, Any]:
        """Validate if a data operation is allowed."""
        config = self._configs.get(tenant_id)

        if not config:
            return {"allowed": True, "reason": "no_residency_config"}

        # Check if region is allowed
        if target_region in config.restricted_regions:
            return {
                "allowed": False,
                "reason": "region_restricted",
                "region": target_region.value
            }

        if target_region not in config.allowed_regions:
            if not config.cross_border_allowed:
                return {
                    "allowed": False,
                    "reason": "cross_border_not_allowed",
                    "allowed_regions": [r.value for r in config.allowed_regions]
                }

        # Check compliance requirements
        compliance_issues = []
        for framework in config.compliance_frameworks:
            issue = self._check_compliance(framework, operation, data_type, target_region)
            if issue:
                compliance_issues.append(issue)

        if compliance_issues:
            return {
                "allowed": False,
                "reason": "compliance_violation",
                "issues": compliance_issues
            }

        return {
            "allowed": True,
            "endpoint": self._region_endpoints.get(target_region)
        }

    def _check_compliance(
        self,
        framework: ComplianceFramework,
        operation: str,
        data_type: str,
        region: DataRegion
    ) -> Optional[str]:
        """Check compliance requirements for a specific framework."""
        # GDPR checks
        if framework == ComplianceFramework.GDPR:
            # Data transfers outside EU require adequacy decision
            eu_regions = [DataRegion.EU_WEST, DataRegion.EU_CENTRAL]
            if region not in eu_regions and data_type in ["personal", "pii"]:
                return "GDPR: Personal data transfer outside EU requires adequacy decision"

        # HIPAA checks
        if framework == ComplianceFramework.HIPAA:
            if data_type == "phi" and operation == "export":
                return "HIPAA: PHI export requires additional authorization"

        # PCI-DSS checks
        if framework == ComplianceFramework.PCI_DSS:
            if data_type == "payment" and operation in ["transfer", "export"]:
                return "PCI-DSS: Payment data transfer requires encryption verification"

        return None

    async def get_primary_endpoint(self, tenant_id: str) -> Optional[str]:
        """Get the primary data endpoint for a tenant."""
        config = self._configs.get(tenant_id)
        if config:
            return self._region_endpoints.get(config.primary_region)
        return None

    async def generate_compliance_report(
        self,
        tenant_id: str,
        framework: ComplianceFramework,
        period_start: datetime,
        period_end: datetime
    ) -> ComplianceReport:
        """Generate a compliance report."""
        config = self._configs.get(tenant_id)

        findings = []
        recommendations = []
        evidence = {}

        # Check configuration compliance
        if config:
            if framework == ComplianceFramework.GDPR:
                if not config.encryption_required:
                    findings.append({
                        "severity": "high",
                        "finding": "Encryption not enforced",
                        "requirement": "GDPR Article 32"
                    })
                if config.data_retention_days > 365:
                    recommendations.append("Consider reducing data retention period")

            if framework == ComplianceFramework.SOC2:
                if not config.encryption_required:
                    findings.append({
                        "severity": "medium",
                        "finding": "Encryption not enforced",
                        "requirement": "CC6.1"
                    })

        # Determine status
        high_findings = sum(1 for f in findings if f["severity"] == "high")
        if high_findings > 0:
            status = "non_compliant"
        elif findings:
            status = "partial"
        else:
            status = "compliant"

        report = ComplianceReport(
            report_id=str(uuid4()),
            tenant_id=tenant_id,
            framework=framework,
            generated_at=datetime.utcnow(),
            period_start=period_start,
            period_end=period_end,
            status=status,
            findings=findings,
            recommendations=recommendations,
            evidence=evidence
        )

        return report


# ============================================================================
# Enterprise Coordinator
# ============================================================================

class EnterpriseCoordinator:
    """
    Coordinates all enterprise features.

    Provides unified interface for SSO, RBAC, audit, and data residency.
    """

    def __init__(self):
        self.sso_manager = SSOManager()
        self.rbac_manager = RBACManager()
        self.audit_manager = AuditManager()
        self.data_residency_manager = DataResidencyManager()

        # Wire up audit logging
        self._setup_audit_integration()

    def _setup_audit_integration(self):
        """Set up automatic audit logging."""
        # This would connect to other system events
        pass

    async def authorize_action(
        self,
        user_id: str,
        tenant_id: str,
        resource: ResourceCategory,
        action: PermissionAction,
        context: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Authorize an action and log it."""
        # Check RBAC
        allowed = await self.rbac_manager.check_permission(
            user_id, tenant_id, resource, action, context
        )

        # Log the attempt
        await self.audit_manager.log_event(
            event_type=AuditEventType.DATA_ACCESS,
            actor_id=user_id,
            actor_type="user",
            tenant_id=tenant_id,
            resource_type=resource.value,
            action=action.value,
            outcome="success" if allowed else "denied",
            ip_address=ip_address
        )

        return {
            "allowed": allowed,
            "resource": resource.value,
            "action": action.value
        }

    async def get_enterprise_dashboard(
        self,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get enterprise feature dashboard data."""
        # Get SSO status
        sso_config = await self.sso_manager.get_sso_config(tenant_id)
        sso_status = {
            "enabled": sso_config is not None and sso_config.enabled,
            "provider": sso_config.provider.value if sso_config else None
        }

        # Get RBAC stats
        roles = await self.rbac_manager.list_roles(tenant_id)
        rbac_stats = {
            "total_roles": len(roles),
            "custom_roles": sum(1 for r in roles if not r.is_system)
        }

        # Get audit summary
        audit_summary = await self.audit_manager.get_activity_summary(tenant_id, days=7)

        # Get data residency config
        residency_config = await self.data_residency_manager.get_residency_config(tenant_id)
        residency_status = {
            "configured": residency_config is not None,
            "primary_region": residency_config.primary_region.value if residency_config else None,
            "frameworks": [f.value for f in residency_config.compliance_frameworks] if residency_config else []
        }

        return {
            "sso": sso_status,
            "rbac": rbac_stats,
            "audit": {
                "events_7d": audit_summary["total_events"],
                "high_risk": len(audit_summary["high_risk_events"])
            },
            "data_residency": residency_status,
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================================================
# Singleton Access
# ============================================================================

_coordinator: Optional[EnterpriseCoordinator] = None


async def get_enterprise_coordinator() -> EnterpriseCoordinator:
    """Get the global enterprise coordinator."""
    global _coordinator
    if _coordinator is None:
        _coordinator = EnterpriseCoordinator()
    return _coordinator
