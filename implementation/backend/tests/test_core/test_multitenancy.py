"""
Tests for Multi-Tenancy System

Tests tenant isolation, usage tracking, and billing.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestTenantRegistry:
    """Tests for TenantRegistry."""

    def test_registry_initialization(self):
        """Test tenant registry initialization."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        assert registry is not None

    @pytest.mark.asyncio
    async def test_create_tenant(self, sample_tenant):
        """Test creating a new tenant."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        tenant = await registry.create_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"],
            plan=sample_tenant["plan"]
        )

        assert tenant.id is not None
        assert tenant.name == sample_tenant["name"]
        assert tenant.slug == sample_tenant["slug"]

    @pytest.mark.asyncio
    async def test_get_tenant(self, sample_tenant):
        """Test retrieving a tenant."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        created = await registry.create_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"]
        )

        retrieved = await registry.get_tenant(created.id)

        assert retrieved is not None
        assert retrieved.id == created.id

    @pytest.mark.asyncio
    async def test_get_tenant_by_slug(self, sample_tenant):
        """Test retrieving tenant by slug."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        await registry.create_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"]
        )

        retrieved = await registry.get_tenant_by_slug(sample_tenant["slug"])

        assert retrieved is not None
        assert retrieved.slug == sample_tenant["slug"]

    @pytest.mark.asyncio
    async def test_update_tenant(self, sample_tenant):
        """Test updating a tenant."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        tenant = await registry.create_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"]
        )

        updated = await registry.update_tenant(
            tenant.id,
            name="Updated Name",
            plan="enterprise"
        )

        assert updated.name == "Updated Name"
        assert updated.plan == "enterprise"

    @pytest.mark.asyncio
    async def test_delete_tenant(self, sample_tenant):
        """Test deleting a tenant."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        tenant = await registry.create_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"]
        )

        await registry.delete_tenant(tenant.id)

        retrieved = await registry.get_tenant(tenant.id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_list_tenants(self):
        """Test listing all tenants."""
        from core.multitenancy import TenantRegistry

        registry = TenantRegistry()

        # Create multiple tenants
        for i in range(5):
            await registry.create_tenant(
                name=f"Tenant {i}",
                slug=f"tenant-{i}"
            )

        tenants = await registry.list_tenants()

        assert len(tenants) >= 5


@pytest.mark.unit
@pytest.mark.core
class TestUsageTracker:
    """Tests for UsageTracker."""

    def test_tracker_initialization(self):
        """Test usage tracker initialization."""
        from core.multitenancy import UsageTracker

        tracker = UsageTracker()

        assert tracker is not None

    @pytest.mark.asyncio
    async def test_record_api_call(self):
        """Test recording an API call."""
        from core.multitenancy import UsageTracker

        tracker = UsageTracker()

        await tracker.record_usage(
            tenant_id="tenant-123",
            usage_type="api_call",
            quantity=1,
            metadata={"endpoint": "/api/agents"}
        )

        usage = await tracker.get_usage(tenant_id="tenant-123", usage_type="api_call")

        assert usage["total"] >= 1

    @pytest.mark.asyncio
    async def test_record_agent_invocation(self):
        """Test recording agent invocation."""
        from core.multitenancy import UsageTracker

        tracker = UsageTracker()

        await tracker.record_usage(
            tenant_id="tenant-123",
            usage_type="agent_invocation",
            quantity=1,
            metadata={"agent": "zeus"}
        )

        usage = await tracker.get_usage(tenant_id="tenant-123", usage_type="agent_invocation")

        assert usage["total"] >= 1

    @pytest.mark.asyncio
    async def test_get_usage_by_period(self):
        """Test getting usage for a specific period."""
        from core.multitenancy import UsageTracker
        from datetime import datetime, timedelta

        tracker = UsageTracker()

        # Record usage
        await tracker.record_usage("tenant-123", "api_call", 10)

        start = datetime.utcnow() - timedelta(days=1)
        end = datetime.utcnow() + timedelta(days=1)

        usage = await tracker.get_usage_by_period(
            tenant_id="tenant-123",
            start_date=start,
            end_date=end
        )

        assert usage["api_call"] >= 10

    @pytest.mark.asyncio
    async def test_check_quota(self, sample_tenant):
        """Test checking quota limits."""
        from core.multitenancy import UsageTracker

        tracker = UsageTracker()

        # Set quota
        tracker.set_quota("tenant-123", "api_calls_per_day", 100)

        # Record usage
        await tracker.record_usage("tenant-123", "api_calls_per_day", 50)

        # Check quota
        within_quota = await tracker.check_quota("tenant-123", "api_calls_per_day")

        assert within_quota is True

    @pytest.mark.asyncio
    async def test_quota_exceeded(self):
        """Test quota exceeded scenario."""
        from core.multitenancy import UsageTracker

        tracker = UsageTracker()

        # Set low quota
        tracker.set_quota("tenant-123", "api_calls", 10)

        # Exceed quota
        await tracker.record_usage("tenant-123", "api_calls", 15)

        within_quota = await tracker.check_quota("tenant-123", "api_calls")

        assert within_quota is False


@pytest.mark.unit
@pytest.mark.core
class TestBillingManager:
    """Tests for BillingManager."""

    def test_billing_initialization(self):
        """Test billing manager initialization."""
        from core.multitenancy import BillingManager

        billing = BillingManager()

        assert billing is not None

    @pytest.mark.asyncio
    async def test_calculate_invoice(self):
        """Test calculating invoice for a tenant."""
        from core.multitenancy import BillingManager

        billing = BillingManager()

        # Setup usage data
        usage = {
            "api_calls": 1000,
            "agent_invocations": 500,
            "storage_gb": 10
        }

        rates = {
            "api_calls": 0.001,  # $0.001 per call
            "agent_invocations": 0.01,  # $0.01 per invocation
            "storage_gb": 0.10  # $0.10 per GB
        }

        invoice = await billing.calculate_invoice(
            tenant_id="tenant-123",
            period="2024-01",
            usage=usage,
            rates=rates
        )

        expected_total = (1000 * 0.001) + (500 * 0.01) + (10 * 0.10)
        assert abs(invoice["total"] - expected_total) < 0.01

    @pytest.mark.asyncio
    async def test_apply_discount(self):
        """Test applying discount to invoice."""
        from core.multitenancy import BillingManager

        billing = BillingManager()

        invoice = {
            "subtotal": 100.00,
            "items": [{"name": "API Calls", "amount": 100.00}]
        }

        discounted = await billing.apply_discount(
            invoice=invoice,
            discount_type="percentage",
            discount_value=10  # 10% discount
        )

        assert discounted["total"] == 90.00
        assert discounted["discount"] == 10.00

    @pytest.mark.asyncio
    async def test_get_billing_history(self):
        """Test getting billing history."""
        from core.multitenancy import BillingManager

        billing = BillingManager()

        # Create some invoices
        for i in range(3):
            await billing.create_invoice(
                tenant_id="tenant-123",
                period=f"2024-0{i+1}",
                amount=100.00 * (i + 1)
            )

        history = await billing.get_billing_history("tenant-123")

        assert len(history) >= 3


@pytest.mark.unit
@pytest.mark.core
class TestDataIsolation:
    """Tests for DataIsolation."""

    def test_isolation_initialization(self):
        """Test data isolation initialization."""
        from core.multitenancy import DataIsolation

        isolation = DataIsolation()

        assert isolation is not None

    def test_get_tenant_schema(self):
        """Test getting tenant-specific schema."""
        from core.multitenancy import DataIsolation

        isolation = DataIsolation()

        schema = isolation.get_tenant_schema("tenant-123")

        assert schema is not None
        assert "tenant-123" in schema or "tenant_123" in schema

    @pytest.mark.asyncio
    async def test_ensure_isolation(self):
        """Test ensuring data isolation for a query."""
        from core.multitenancy import DataIsolation

        isolation = DataIsolation()

        query = "SELECT * FROM users"
        tenant_id = "tenant-123"

        isolated_query = await isolation.apply_isolation(query, tenant_id)

        # Query should include tenant filter
        assert "tenant" in isolated_query.lower() or "schema" in isolated_query.lower()

    def test_validate_tenant_access(self):
        """Test validating tenant access to resource."""
        from core.multitenancy import DataIsolation

        isolation = DataIsolation()

        # Valid access
        is_valid = isolation.validate_access(
            tenant_id="tenant-123",
            resource_tenant_id="tenant-123"
        )
        assert is_valid is True

        # Invalid access
        is_valid = isolation.validate_access(
            tenant_id="tenant-123",
            resource_tenant_id="tenant-456"
        )
        assert is_valid is False


@pytest.mark.unit
@pytest.mark.core
class TestMultiTenantCoordinator:
    """Tests for MultiTenantCoordinator."""

    def test_coordinator_initialization(self):
        """Test coordinator initialization."""
        from core.multitenancy import MultiTenantCoordinator

        coordinator = MultiTenantCoordinator()

        assert coordinator is not None
        assert hasattr(coordinator, 'tenant_registry')
        assert hasattr(coordinator, 'usage_tracker')
        assert hasattr(coordinator, 'billing_manager')
        assert hasattr(coordinator, 'data_isolation')

    @pytest.mark.asyncio
    async def test_provision_tenant(self, sample_tenant):
        """Test provisioning a new tenant."""
        from core.multitenancy import MultiTenantCoordinator

        coordinator = MultiTenantCoordinator()

        result = await coordinator.provision_tenant(
            name=sample_tenant["name"],
            slug=sample_tenant["slug"],
            plan=sample_tenant["plan"],
            admin_email="admin@example.com"
        )

        assert result["success"] is True
        assert result["tenant_id"] is not None

    @pytest.mark.asyncio
    async def test_get_tenant_dashboard_data(self):
        """Test getting tenant dashboard data."""
        from core.multitenancy import MultiTenantCoordinator

        coordinator = MultiTenantCoordinator()

        # Create tenant first
        result = await coordinator.provision_tenant(
            name="Dashboard Test",
            slug="dashboard-test",
            plan="professional"
        )

        tenant_id = result["tenant_id"]

        dashboard = await coordinator.get_dashboard_data(tenant_id)

        assert "usage" in dashboard
        assert "billing" in dashboard
        assert "quota_status" in dashboard
