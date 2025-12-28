"""
KOSMOS V2.0 Multi-Tenant System

Tenant isolation, custom branding, usage quotas,
and billing integration for enterprise deployments.
"""

from typing import Any, Dict, List, Optional, Set, TypeVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import asyncio
import hashlib
import json
import logging
from uuid import uuid4
from contextlib import asynccontextmanager

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================================
# Enums and Types
# ============================================================================

class TenantStatus(str, Enum):
    """Status of a tenant."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    PENDING = "pending"
    ARCHIVED = "archived"


class TenantTier(str, Enum):
    """Tenant subscription tiers."""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


class ResourceType(str, Enum):
    """Types of resources that can be metered."""
    API_CALLS = "api_calls"
    LLM_TOKENS = "llm_tokens"
    STORAGE_BYTES = "storage_bytes"
    AGENTS_ACTIVE = "agents_active"
    WORKFLOWS = "workflows"
    USERS = "users"
    MCP_SERVERS = "mcp_servers"
    EMBEDDINGS = "embeddings"


class QuotaEnforcement(str, Enum):
    """How quotas are enforced."""
    SOFT = "soft"  # Warn but allow overage
    HARD = "hard"  # Block at limit
    THROTTLE = "throttle"  # Slow down at limit


class BillingCycle(str, Enum):
    """Billing cycle options."""
    MONTHLY = "monthly"
    ANNUAL = "annual"
    PAY_AS_YOU_GO = "pay_as_you_go"


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class BrandingConfig:
    """Tenant branding configuration."""
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#6366f1"  # Indigo
    secondary_color: str = "#8b5cf6"  # Violet
    accent_color: str = "#10b981"  # Emerald
    background_color: str = "#0f172a"  # Slate-900
    font_family: str = "Inter, sans-serif"
    custom_css: Optional[str] = None
    company_name: Optional[str] = None
    support_email: Optional[str] = None
    custom_domain: Optional[str] = None


@dataclass
class QuotaConfig:
    """Quota configuration for a resource."""
    resource_type: ResourceType
    limit: int
    period: str = "monthly"  # daily, monthly, lifetime
    enforcement: QuotaEnforcement = QuotaEnforcement.SOFT
    overage_rate: Optional[float] = None  # Cost per unit over limit


@dataclass
class UsageRecord:
    """A single usage record."""
    tenant_id: str
    resource_type: ResourceType
    amount: int
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Tenant:
    """A tenant (organization) in the system."""
    tenant_id: str
    name: str
    slug: str  # URL-friendly identifier
    status: TenantStatus
    tier: TenantTier
    branding: BrandingConfig
    quotas: Dict[ResourceType, QuotaConfig]
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    owner_user_id: Optional[str] = None
    billing_email: Optional[str] = None


@dataclass
class TenantUser:
    """A user belonging to a tenant."""
    user_id: str
    tenant_id: str
    role: str  # admin, member, viewer
    permissions: List[str]
    created_at: datetime
    last_active: Optional[datetime] = None
    settings: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BillingRecord:
    """A billing record for a tenant."""
    record_id: str
    tenant_id: str
    period_start: datetime
    period_end: datetime
    usage: Dict[str, int]  # resource_type -> amount
    base_amount: float
    overage_amount: float
    total_amount: float
    status: str  # pending, paid, failed
    invoice_url: Optional[str] = None


# ============================================================================
# Tenant Registry
# ============================================================================

class TenantRegistry:
    """
    Manages tenant registration and lookup.

    Provides tenant CRUD operations and validation.
    """

    def __init__(self):
        self._tenants: Dict[str, Tenant] = {}
        self._by_slug: Dict[str, str] = {}  # slug -> tenant_id
        self._by_domain: Dict[str, str] = {}  # domain -> tenant_id

        # Default quotas by tier
        self._tier_quotas: Dict[TenantTier, Dict[ResourceType, QuotaConfig]] = {
            TenantTier.FREE: {
                ResourceType.API_CALLS: QuotaConfig(ResourceType.API_CALLS, 1000, "monthly"),
                ResourceType.LLM_TOKENS: QuotaConfig(ResourceType.LLM_TOKENS, 100000, "monthly"),
                ResourceType.STORAGE_BYTES: QuotaConfig(ResourceType.STORAGE_BYTES, 100 * 1024 * 1024, "lifetime"),  # 100MB
                ResourceType.USERS: QuotaConfig(ResourceType.USERS, 3, "lifetime"),
                ResourceType.AGENTS_ACTIVE: QuotaConfig(ResourceType.AGENTS_ACTIVE, 5, "lifetime"),
            },
            TenantTier.STARTER: {
                ResourceType.API_CALLS: QuotaConfig(ResourceType.API_CALLS, 10000, "monthly"),
                ResourceType.LLM_TOKENS: QuotaConfig(ResourceType.LLM_TOKENS, 1000000, "monthly"),
                ResourceType.STORAGE_BYTES: QuotaConfig(ResourceType.STORAGE_BYTES, 1024 * 1024 * 1024, "lifetime"),  # 1GB
                ResourceType.USERS: QuotaConfig(ResourceType.USERS, 10, "lifetime"),
                ResourceType.AGENTS_ACTIVE: QuotaConfig(ResourceType.AGENTS_ACTIVE, 11, "lifetime"),
            },
            TenantTier.PROFESSIONAL: {
                ResourceType.API_CALLS: QuotaConfig(ResourceType.API_CALLS, 100000, "monthly"),
                ResourceType.LLM_TOKENS: QuotaConfig(ResourceType.LLM_TOKENS, 10000000, "monthly"),
                ResourceType.STORAGE_BYTES: QuotaConfig(ResourceType.STORAGE_BYTES, 10 * 1024 * 1024 * 1024, "lifetime"),  # 10GB
                ResourceType.USERS: QuotaConfig(ResourceType.USERS, 50, "lifetime"),
                ResourceType.AGENTS_ACTIVE: QuotaConfig(ResourceType.AGENTS_ACTIVE, 11, "lifetime"),
                ResourceType.WORKFLOWS: QuotaConfig(ResourceType.WORKFLOWS, 100, "lifetime"),
            },
            TenantTier.ENTERPRISE: {
                ResourceType.API_CALLS: QuotaConfig(ResourceType.API_CALLS, 1000000, "monthly", QuotaEnforcement.SOFT),
                ResourceType.LLM_TOKENS: QuotaConfig(ResourceType.LLM_TOKENS, 100000000, "monthly", QuotaEnforcement.SOFT),
                ResourceType.STORAGE_BYTES: QuotaConfig(ResourceType.STORAGE_BYTES, 100 * 1024 * 1024 * 1024, "lifetime"),  # 100GB
                ResourceType.USERS: QuotaConfig(ResourceType.USERS, 500, "lifetime"),
                ResourceType.AGENTS_ACTIVE: QuotaConfig(ResourceType.AGENTS_ACTIVE, 11, "lifetime"),
                ResourceType.WORKFLOWS: QuotaConfig(ResourceType.WORKFLOWS, 1000, "lifetime"),
                ResourceType.MCP_SERVERS: QuotaConfig(ResourceType.MCP_SERVERS, 88, "lifetime"),
            },
        }

    async def create_tenant(
        self,
        name: str,
        slug: str,
        tier: TenantTier = TenantTier.FREE,
        owner_user_id: Optional[str] = None,
        branding: Optional[BrandingConfig] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Tenant:
        """Create a new tenant."""
        # Validate slug
        if slug in self._by_slug:
            raise ValueError(f"Slug already taken: {slug}")

        tenant_id = str(uuid4())
        now = datetime.utcnow()

        tenant = Tenant(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            status=TenantStatus.ACTIVE,
            tier=tier,
            branding=branding or BrandingConfig(),
            quotas=self._tier_quotas.get(tier, {}),
            created_at=now,
            updated_at=now,
            owner_user_id=owner_user_id,
            settings=settings or {}
        )

        self._tenants[tenant_id] = tenant
        self._by_slug[slug] = tenant_id

        if tenant.branding.custom_domain:
            self._by_domain[tenant.branding.custom_domain] = tenant_id

        logger.info(f"Created tenant: {name} ({tenant_id})")

        return tenant

    async def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        """Get a tenant by ID."""
        return self._tenants.get(tenant_id)

    async def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get a tenant by slug."""
        tenant_id = self._by_slug.get(slug)
        if tenant_id:
            return self._tenants.get(tenant_id)
        return None

    async def get_tenant_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get a tenant by custom domain."""
        tenant_id = self._by_domain.get(domain)
        if tenant_id:
            return self._tenants.get(tenant_id)
        return None

    async def update_tenant(
        self,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Tenant]:
        """Update a tenant."""
        tenant = self._tenants.get(tenant_id)
        if not tenant:
            return None

        # Apply updates
        for key, value in updates.items():
            if hasattr(tenant, key):
                setattr(tenant, key, value)

        tenant.updated_at = datetime.utcnow()

        # Update indexes
        if "slug" in updates:
            # Remove old slug
            old_slug = next(
                (s for s, tid in self._by_slug.items() if tid == tenant_id),
                None
            )
            if old_slug:
                del self._by_slug[old_slug]
            self._by_slug[updates["slug"]] = tenant_id

        return tenant

    async def delete_tenant(self, tenant_id: str) -> bool:
        """Delete (archive) a tenant."""
        tenant = self._tenants.get(tenant_id)
        if not tenant:
            return False

        tenant.status = TenantStatus.ARCHIVED
        tenant.updated_at = datetime.utcnow()

        # Remove from indexes
        if tenant.slug in self._by_slug:
            del self._by_slug[tenant.slug]
        if tenant.branding.custom_domain in self._by_domain:
            del self._by_domain[tenant.branding.custom_domain]

        logger.info(f"Archived tenant: {tenant.name} ({tenant_id})")

        return True

    async def list_tenants(
        self,
        status: Optional[TenantStatus] = None,
        tier: Optional[TenantTier] = None,
        limit: int = 100
    ) -> List[Tenant]:
        """List tenants with optional filters."""
        tenants = list(self._tenants.values())

        if status:
            tenants = [t for t in tenants if t.status == status]
        if tier:
            tenants = [t for t in tenants if t.tier == tier]

        return tenants[:limit]

    async def upgrade_tier(
        self,
        tenant_id: str,
        new_tier: TenantTier
    ) -> Optional[Tenant]:
        """Upgrade a tenant's tier."""
        tenant = self._tenants.get(tenant_id)
        if not tenant:
            return None

        old_tier = tenant.tier
        tenant.tier = new_tier
        tenant.quotas = self._tier_quotas.get(new_tier, tenant.quotas)
        tenant.updated_at = datetime.utcnow()

        logger.info(f"Upgraded tenant {tenant_id} from {old_tier} to {new_tier}")

        return tenant


# ============================================================================
# Tenant Context
# ============================================================================

class TenantContext:
    """
    Thread-safe tenant context for request handling.

    Uses asyncio context variables to maintain tenant
    context across async operations.
    """

    _current_tenant: Optional[Tenant] = None
    _current_user: Optional[TenantUser] = None
    _lock = asyncio.Lock()

    @classmethod
    @asynccontextmanager
    async def set_context(
        cls,
        tenant: Tenant,
        user: Optional[TenantUser] = None
    ):
        """Set the tenant context for a block of code."""
        async with cls._lock:
            old_tenant = cls._current_tenant
            old_user = cls._current_user

            cls._current_tenant = tenant
            cls._current_user = user

            try:
                yield
            finally:
                cls._current_tenant = old_tenant
                cls._current_user = old_user

    @classmethod
    def get_current_tenant(cls) -> Optional[Tenant]:
        """Get the current tenant."""
        return cls._current_tenant

    @classmethod
    def get_current_user(cls) -> Optional[TenantUser]:
        """Get the current tenant user."""
        return cls._current_user

    @classmethod
    def require_tenant(cls) -> Tenant:
        """Get the current tenant, raising if not set."""
        if not cls._current_tenant:
            raise RuntimeError("No tenant context set")
        return cls._current_tenant


# ============================================================================
# Usage Tracker
# ============================================================================

class UsageTracker:
    """
    Tracks resource usage per tenant.

    Maintains usage counters and provides quota checking.
    """

    def __init__(self):
        self._usage: Dict[str, Dict[ResourceType, List[UsageRecord]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._daily_aggregates: Dict[str, Dict[str, Dict[ResourceType, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        self._lock = asyncio.Lock()

    async def record_usage(
        self,
        tenant_id: str,
        resource_type: ResourceType,
        amount: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> UsageRecord:
        """Record resource usage."""
        async with self._lock:
            record = UsageRecord(
                tenant_id=tenant_id,
                resource_type=resource_type,
                amount=amount,
                timestamp=datetime.utcnow(),
                metadata=metadata or {}
            )

            self._usage[tenant_id][resource_type].append(record)

            # Update daily aggregate
            day = record.timestamp.strftime("%Y-%m-%d")
            self._daily_aggregates[tenant_id][day][resource_type] += amount

            # Cleanup old records (keep last 30 days)
            cutoff = datetime.utcnow() - timedelta(days=30)
            self._usage[tenant_id][resource_type] = [
                r for r in self._usage[tenant_id][resource_type]
                if r.timestamp > cutoff
            ]

            return record

    async def get_usage(
        self,
        tenant_id: str,
        resource_type: ResourceType,
        period: str = "monthly"
    ) -> int:
        """Get total usage for a period."""
        now = datetime.utcnow()

        if period == "daily":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "monthly":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "lifetime":
            start = datetime.min
        else:
            start = now - timedelta(days=30)

        records = self._usage.get(tenant_id, {}).get(resource_type, [])
        return sum(r.amount for r in records if r.timestamp >= start)

    async def check_quota(
        self,
        tenant_id: str,
        resource_type: ResourceType,
        requested_amount: int,
        tenant: Optional[Tenant] = None
    ) -> Dict[str, Any]:
        """Check if usage would exceed quota."""
        if not tenant:
            return {"allowed": True, "reason": "no_tenant_context"}

        quota = tenant.quotas.get(resource_type)
        if not quota:
            return {"allowed": True, "reason": "no_quota_configured"}

        current_usage = await self.get_usage(tenant_id, resource_type, quota.period)
        projected_usage = current_usage + requested_amount

        if projected_usage <= quota.limit:
            return {
                "allowed": True,
                "current_usage": current_usage,
                "limit": quota.limit,
                "remaining": quota.limit - current_usage
            }

        if quota.enforcement == QuotaEnforcement.SOFT:
            return {
                "allowed": True,
                "warning": True,
                "current_usage": current_usage,
                "limit": quota.limit,
                "overage": projected_usage - quota.limit,
                "overage_rate": quota.overage_rate
            }
        elif quota.enforcement == QuotaEnforcement.THROTTLE:
            return {
                "allowed": True,
                "throttle": True,
                "current_usage": current_usage,
                "limit": quota.limit,
                "delay_factor": min(10, (projected_usage / quota.limit))
            }
        else:  # HARD enforcement
            return {
                "allowed": False,
                "reason": "quota_exceeded",
                "current_usage": current_usage,
                "limit": quota.limit,
                "requested": requested_amount
            }

    async def get_usage_summary(
        self,
        tenant_id: str,
        period: str = "monthly"
    ) -> Dict[str, Any]:
        """Get usage summary for all resources."""
        summary = {}

        for resource_type in ResourceType:
            usage = await self.get_usage(tenant_id, resource_type, period)
            summary[resource_type.value] = usage

        return {
            "tenant_id": tenant_id,
            "period": period,
            "usage": summary,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def get_usage_history(
        self,
        tenant_id: str,
        resource_type: ResourceType,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get daily usage history."""
        history = []
        now = datetime.utcnow()

        for i in range(days):
            day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            usage = self._daily_aggregates.get(tenant_id, {}).get(day, {}).get(resource_type, 0)
            history.append({"date": day, "usage": usage})

        return list(reversed(history))


# ============================================================================
# Billing Manager
# ============================================================================

class BillingManager:
    """
    Manages tenant billing and invoicing.

    Calculates billing based on usage, generates invoices,
    and integrates with payment providers.
    """

    def __init__(self, usage_tracker: UsageTracker):
        self.usage_tracker = usage_tracker
        self._billing_records: Dict[str, List[BillingRecord]] = defaultdict(list)
        self._pricing: Dict[TenantTier, Dict[str, Any]] = {
            TenantTier.FREE: {"base_price": 0, "overage_rates": {}},
            TenantTier.STARTER: {
                "base_price": 29,
                "overage_rates": {
                    ResourceType.API_CALLS: 0.001,
                    ResourceType.LLM_TOKENS: 0.00001,
                    ResourceType.STORAGE_BYTES: 0.00000001,
                }
            },
            TenantTier.PROFESSIONAL: {
                "base_price": 99,
                "overage_rates": {
                    ResourceType.API_CALLS: 0.0008,
                    ResourceType.LLM_TOKENS: 0.000008,
                    ResourceType.STORAGE_BYTES: 0.000000008,
                }
            },
            TenantTier.ENTERPRISE: {
                "base_price": 499,
                "overage_rates": {
                    ResourceType.API_CALLS: 0.0005,
                    ResourceType.LLM_TOKENS: 0.000005,
                    ResourceType.STORAGE_BYTES: 0.000000005,
                }
            },
        }

    async def calculate_bill(
        self,
        tenant: Tenant,
        period_start: datetime,
        period_end: datetime
    ) -> BillingRecord:
        """Calculate billing for a period."""
        pricing = self._pricing.get(tenant.tier, {"base_price": 0, "overage_rates": {}})

        usage = {}
        overage_amount = 0.0

        for resource_type in ResourceType:
            current_usage = await self.usage_tracker.get_usage(
                tenant.tenant_id, resource_type, "monthly"
            )
            usage[resource_type.value] = current_usage

            # Calculate overage
            quota = tenant.quotas.get(resource_type)
            if quota and current_usage > quota.limit:
                overage = current_usage - quota.limit
                rate = pricing["overage_rates"].get(resource_type, 0)
                overage_amount += overage * rate

        record = BillingRecord(
            record_id=str(uuid4()),
            tenant_id=tenant.tenant_id,
            period_start=period_start,
            period_end=period_end,
            usage=usage,
            base_amount=pricing["base_price"],
            overage_amount=overage_amount,
            total_amount=pricing["base_price"] + overage_amount,
            status="pending"
        )

        self._billing_records[tenant.tenant_id].append(record)

        return record

    async def get_billing_history(
        self,
        tenant_id: str,
        limit: int = 12
    ) -> List[BillingRecord]:
        """Get billing history for a tenant."""
        records = self._billing_records.get(tenant_id, [])
        records.sort(key=lambda r: r.period_start, reverse=True)
        return records[:limit]

    async def get_current_bill_estimate(
        self,
        tenant: Tenant
    ) -> Dict[str, Any]:
        """Get estimate for current billing period."""
        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        if now.month == 12:
            period_end = now.replace(year=now.year + 1, month=1, day=1)
        else:
            period_end = now.replace(month=now.month + 1, day=1)

        # Calculate partial period bill
        record = await self.calculate_bill(tenant, period_start, period_end)

        # Project to end of period
        days_elapsed = (now - period_start).days + 1
        days_in_period = (period_end - period_start).days

        if days_elapsed > 0:
            projected_usage = {}
            for resource, usage in record.usage.items():
                projected = int(usage * days_in_period / days_elapsed)
                projected_usage[resource] = projected

            return {
                "current_usage": record.usage,
                "projected_usage": projected_usage,
                "current_total": record.total_amount,
                "projected_total": record.total_amount * days_in_period / days_elapsed,
                "days_elapsed": days_elapsed,
                "days_remaining": days_in_period - days_elapsed,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat()
            }

        return {
            "current_usage": record.usage,
            "current_total": record.total_amount,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat()
        }

    async def process_payment(
        self,
        record_id: str,
        payment_method: str,
        payment_details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process payment for a billing record."""
        # Find the record
        record = None
        for tenant_records in self._billing_records.values():
            for r in tenant_records:
                if r.record_id == record_id:
                    record = r
                    break

        if not record:
            return {"success": False, "error": "Record not found"}

        # In real implementation, integrate with Stripe/payment provider
        # For now, simulate successful payment
        record.status = "paid"

        return {
            "success": True,
            "record_id": record_id,
            "amount": record.total_amount,
            "status": "paid"
        }


# ============================================================================
# Data Isolation
# ============================================================================

class DataIsolation:
    """
    Ensures data isolation between tenants.

    Provides methods for scoping queries and validating access.
    """

    @staticmethod
    def scope_query(
        tenant_id: str,
        query: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add tenant scoping to a query."""
        return {**query, "tenant_id": tenant_id}

    @staticmethod
    def validate_access(
        tenant_id: str,
        resource_tenant_id: str
    ) -> bool:
        """Validate that a tenant can access a resource."""
        return tenant_id == resource_tenant_id

    @staticmethod
    def get_tenant_prefix(tenant_id: str) -> str:
        """Get a prefix for tenant-specific resources."""
        return f"tenant:{tenant_id}:"

    @staticmethod
    def get_storage_path(tenant_id: str, path: str) -> str:
        """Get tenant-scoped storage path."""
        return f"tenants/{tenant_id}/{path}"

    @staticmethod
    def get_cache_key(tenant_id: str, key: str) -> str:
        """Get tenant-scoped cache key."""
        return f"t:{tenant_id}:{key}"


# ============================================================================
# Multi-Tenant Coordinator
# ============================================================================

class MultiTenantCoordinator:
    """
    Coordinates multi-tenant operations.

    Provides a unified interface for tenant management,
    usage tracking, billing, and data isolation.
    """

    def __init__(self):
        self.registry = TenantRegistry()
        self.usage_tracker = UsageTracker()
        self.billing_manager = BillingManager(self.usage_tracker)
        self.isolation = DataIsolation()
        self._user_tenants: Dict[str, List[TenantUser]] = defaultdict(list)

    async def create_tenant(
        self,
        name: str,
        slug: str,
        owner_user_id: str,
        tier: TenantTier = TenantTier.FREE,
        branding: Optional[Dict[str, Any]] = None
    ) -> Tenant:
        """Create a new tenant with owner."""
        branding_config = BrandingConfig(**branding) if branding else None

        tenant = await self.registry.create_tenant(
            name=name,
            slug=slug,
            tier=tier,
            owner_user_id=owner_user_id,
            branding=branding_config
        )

        # Add owner as admin
        await self.add_user_to_tenant(
            tenant_id=tenant.tenant_id,
            user_id=owner_user_id,
            role="admin"
        )

        return tenant

    async def add_user_to_tenant(
        self,
        tenant_id: str,
        user_id: str,
        role: str = "member",
        permissions: Optional[List[str]] = None
    ) -> TenantUser:
        """Add a user to a tenant."""
        tenant_user = TenantUser(
            user_id=user_id,
            tenant_id=tenant_id,
            role=role,
            permissions=permissions or [],
            created_at=datetime.utcnow()
        )

        self._user_tenants[user_id].append(tenant_user)

        return tenant_user

    async def get_user_tenants(self, user_id: str) -> List[Tenant]:
        """Get all tenants a user belongs to."""
        tenant_users = self._user_tenants.get(user_id, [])
        tenants = []

        for tu in tenant_users:
            tenant = await self.registry.get_tenant(tu.tenant_id)
            if tenant and tenant.status == TenantStatus.ACTIVE:
                tenants.append(tenant)

        return tenants

    async def get_user_role(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[TenantUser]:
        """Get a user's role in a tenant."""
        tenant_users = self._user_tenants.get(user_id, [])
        return next(
            (tu for tu in tenant_users if tu.tenant_id == tenant_id),
            None
        )

    async def track_usage(
        self,
        resource_type: ResourceType,
        amount: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Track usage for current tenant."""
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            return {"error": "No tenant context"}

        # Check quota first
        quota_check = await self.usage_tracker.check_quota(
            tenant.tenant_id, resource_type, amount, tenant
        )

        if not quota_check.get("allowed"):
            return {"error": "quota_exceeded", "details": quota_check}

        # Record usage
        await self.usage_tracker.record_usage(
            tenant.tenant_id, resource_type, amount, metadata
        )

        return {"success": True, **quota_check}

    async def get_tenant_dashboard(
        self,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get dashboard data for a tenant."""
        tenant = await self.registry.get_tenant(tenant_id)
        if not tenant:
            return {"error": "Tenant not found"}

        usage_summary = await self.usage_tracker.get_usage_summary(tenant_id)
        bill_estimate = await self.billing_manager.get_current_bill_estimate(tenant)

        # Calculate quota usage percentages
        quota_usage = {}
        for resource_type, quota in tenant.quotas.items():
            current = usage_summary["usage"].get(resource_type.value, 0)
            quota_usage[resource_type.value] = {
                "current": current,
                "limit": quota.limit,
                "percentage": (current / quota.limit * 100) if quota.limit > 0 else 0,
                "enforcement": quota.enforcement.value
            }

        return {
            "tenant": {
                "id": tenant.tenant_id,
                "name": tenant.name,
                "tier": tenant.tier.value,
                "status": tenant.status.value
            },
            "usage": usage_summary["usage"],
            "quotas": quota_usage,
            "billing": bill_estimate,
            "branding": {
                "primary_color": tenant.branding.primary_color,
                "company_name": tenant.branding.company_name,
                "logo_url": tenant.branding.logo_url
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    @asynccontextmanager
    async def tenant_scope(self, tenant_id: str, user_id: Optional[str] = None):
        """Context manager for tenant-scoped operations."""
        tenant = await self.registry.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")

        user = None
        if user_id:
            user = await self.get_user_role(user_id, tenant_id)

        async with TenantContext.set_context(tenant, user):
            yield tenant


# ============================================================================
# Singleton Access
# ============================================================================

_coordinator: Optional[MultiTenantCoordinator] = None


async def get_multitenancy_coordinator() -> MultiTenantCoordinator:
    """Get the global multi-tenancy coordinator."""
    global _coordinator
    if _coordinator is None:
        _coordinator = MultiTenantCoordinator()
    return _coordinator
