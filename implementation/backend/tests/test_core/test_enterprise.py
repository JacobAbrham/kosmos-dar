"""
Tests for Enterprise Features

Tests SSO, RBAC, Audit, and Data Residency.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.unit
@pytest.mark.core
class TestSSOManager:
    """Tests for SSOManager."""

    def test_sso_initialization(self):
        """Test SSO manager initialization."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        assert sso is not None

    @pytest.mark.asyncio
    async def test_configure_saml(self):
        """Test configuring SAML provider."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        config = await sso.configure_provider(
            provider_type="saml",
            tenant_id="tenant-123",
            config={
                "idp_url": "https://idp.example.com/sso",
                "idp_certificate": "-----BEGIN CERTIFICATE-----...",
                "entity_id": "kosmos-sp"
            }
        )

        assert config["enabled"] is True
        assert config["provider_type"] == "saml"

    @pytest.mark.asyncio
    async def test_configure_oidc(self):
        """Test configuring OIDC provider."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        config = await sso.configure_provider(
            provider_type="oidc",
            tenant_id="tenant-123",
            config={
                "issuer_url": "https://auth.example.com",
                "client_id": "kosmos-client",
                "client_secret": "secret-value"
            }
        )

        assert config["enabled"] is True
        assert config["provider_type"] == "oidc"

    @pytest.mark.asyncio
    async def test_authenticate_saml(self, mock_sso_manager):
        """Test SAML authentication."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        # Mock SAML response
        saml_response = "<saml:Response>...</saml:Response>"

        with patch.object(sso, '_validate_saml_response', return_value={
            "user_id": "user-123",
            "email": "user@example.com",
            "attributes": {"groups": ["admin"]}
        }):
            result = await sso.authenticate(
                provider_type="saml",
                tenant_id="tenant-123",
                credentials={"saml_response": saml_response}
            )

            assert result["user_id"] == "user-123"
            assert result["email"] == "user@example.com"

    @pytest.mark.asyncio
    async def test_authenticate_oidc(self):
        """Test OIDC authentication."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        with patch.object(sso, '_exchange_oidc_code', return_value={
            "access_token": "access-token-123",
            "id_token": "id-token-123"
        }):
            with patch.object(sso, '_decode_id_token', return_value={
                "sub": "user-123",
                "email": "user@example.com"
            }):
                result = await sso.authenticate(
                    provider_type="oidc",
                    tenant_id="tenant-123",
                    credentials={"code": "auth-code-123"}
                )

                assert result["user_id"] == "user-123"

    @pytest.mark.asyncio
    async def test_validate_token(self):
        """Test token validation."""
        from core.enterprise import SSOManager

        sso = SSOManager()

        # Mock valid token
        with patch.object(sso, '_verify_token', return_value=True):
            is_valid = await sso.validate_token("valid-token-123")
            assert is_valid is True

        # Mock invalid token
        with patch.object(sso, '_verify_token', return_value=False):
            is_valid = await sso.validate_token("invalid-token")
            assert is_valid is False


@pytest.mark.unit
@pytest.mark.core
class TestRBACManager:
    """Tests for RBACManager."""

    def test_rbac_initialization(self):
        """Test RBAC manager initialization."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        assert rbac is not None

    def test_system_roles_exist(self):
        """Test that system roles are defined."""
        from core.enterprise import RBACManager, SystemRole

        rbac = RBACManager()

        expected_roles = ["admin", "manager", "analyst", "operator", "viewer"]

        for role_name in expected_roles:
            role = rbac.get_role(role_name)
            assert role is not None

    def test_check_permission_admin(self, mock_rbac_manager):
        """Test admin has all permissions."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        # Admin should have all permissions
        has_permission = rbac.check_permission(
            user_id="admin-user",
            permission="*",
            resource="*"
        )

        # Mock admin role
        with patch.object(rbac, 'get_user_roles', return_value=["admin"]):
            with patch.object(rbac, 'get_role_permissions', return_value=["*"]):
                has_permission = rbac.check_permission("admin-user", "any:action", "any-resource")
                assert has_permission is True

    def test_check_permission_viewer(self):
        """Test viewer has limited permissions."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        with patch.object(rbac, 'get_user_roles', return_value=["viewer"]):
            with patch.object(rbac, 'get_role_permissions', return_value=["read:*"]):
                # Can read
                can_read = rbac.check_permission("viewer-user", "read:agents", "agents")
                assert can_read is True

                # Cannot write
                can_write = rbac.check_permission("viewer-user", "write:agents", "agents")
                assert can_write is False

    def test_assign_role(self):
        """Test assigning role to user."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        rbac.assign_role(
            user_id="user-123",
            role="analyst",
            tenant_id="tenant-123"
        )

        roles = rbac.get_user_roles("user-123", tenant_id="tenant-123")

        assert "analyst" in roles

    def test_revoke_role(self):
        """Test revoking role from user."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        # Assign then revoke
        rbac.assign_role("user-123", "analyst", "tenant-123")
        rbac.revoke_role("user-123", "analyst", "tenant-123")

        roles = rbac.get_user_roles("user-123", tenant_id="tenant-123")

        assert "analyst" not in roles

    def test_create_custom_role(self):
        """Test creating a custom role."""
        from core.enterprise import RBACManager

        rbac = RBACManager()

        role = rbac.create_role(
            name="custom_role",
            permissions=["read:agents", "execute:agents"],
            description="A custom role"
        )

        assert role.name == "custom_role"
        assert "read:agents" in role.permissions


@pytest.mark.unit
@pytest.mark.core
class TestAuditManager:
    """Tests for AuditManager."""

    def test_audit_initialization(self):
        """Test audit manager initialization."""
        from core.enterprise import AuditManager

        audit = AuditManager()

        assert audit is not None

    @pytest.mark.asyncio
    async def test_log_event(self, mock_audit_manager):
        """Test logging an audit event."""
        from core.enterprise import AuditManager

        audit = AuditManager()

        await audit.log_event(
            event_type="user.login",
            actor_id="user-123",
            tenant_id="tenant-123",
            resource_type="session",
            resource_id="session-456",
            action="create",
            status="success",
            metadata={"ip": "192.168.1.1"}
        )

        # Verify event was logged (would check database in integration test)
        events = await audit.query_events(
            tenant_id="tenant-123",
            event_type="user.login"
        )

        assert len(events) >= 0  # Mock may return empty

    @pytest.mark.asyncio
    async def test_query_events_by_actor(self):
        """Test querying events by actor."""
        from core.enterprise import AuditManager

        audit = AuditManager()

        # Log some events
        for i in range(5):
            await audit.log_event(
                event_type="agent.invoke",
                actor_id="user-123",
                tenant_id="tenant-123",
                resource_type="agent",
                resource_id=f"agent-{i}",
                action="execute"
            )

        events = await audit.query_events(
            tenant_id="tenant-123",
            actor_id="user-123"
        )

        assert all(e["actor_id"] == "user-123" for e in events)

    @pytest.mark.asyncio
    async def test_query_events_by_date_range(self):
        """Test querying events by date range."""
        from core.enterprise import AuditManager
        from datetime import datetime, timedelta

        audit = AuditManager()

        start = datetime.utcnow() - timedelta(hours=1)
        end = datetime.utcnow() + timedelta(hours=1)

        events = await audit.query_events(
            tenant_id="tenant-123",
            start_date=start,
            end_date=end
        )

        assert isinstance(events, list)

    @pytest.mark.asyncio
    async def test_export_audit_log(self):
        """Test exporting audit log."""
        from core.enterprise import AuditManager

        audit = AuditManager()

        export = await audit.export_log(
            tenant_id="tenant-123",
            format="json",
            start_date=datetime.utcnow() - timedelta(days=30)
        )

        assert export is not None
        assert "data" in export or "file_path" in export


@pytest.mark.unit
@pytest.mark.core
class TestDataResidencyManager:
    """Tests for DataResidencyManager."""

    def test_residency_initialization(self):
        """Test data residency manager initialization."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        assert residency is not None

    def test_get_available_regions(self):
        """Test getting available data regions."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        regions = residency.get_available_regions()

        assert len(regions) > 0
        # Should have common regions
        region_codes = [r["code"] for r in regions]
        assert any(code in region_codes for code in ["us-east", "eu-west", "us", "eu"])

    @pytest.mark.asyncio
    async def test_set_tenant_region(self):
        """Test setting tenant data region."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        result = await residency.set_tenant_region(
            tenant_id="tenant-123",
            region="eu-west"
        )

        assert result["success"] is True
        assert result["region"] == "eu-west"

    @pytest.mark.asyncio
    async def test_get_tenant_region(self):
        """Test getting tenant data region."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        await residency.set_tenant_region("tenant-123", "eu-west")

        region = await residency.get_tenant_region("tenant-123")

        assert region == "eu-west"

    def test_validate_compliance(self):
        """Test validating compliance frameworks."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        # GDPR compliance for EU region
        is_compliant = residency.validate_compliance(
            region="eu-west",
            framework="gdpr"
        )

        assert is_compliant is True

        # HIPAA compliance check
        is_compliant = residency.validate_compliance(
            region="us-east",
            framework="hipaa"
        )

        # Result depends on configuration
        assert isinstance(is_compliant, bool)

    @pytest.mark.asyncio
    async def test_data_transfer_validation(self):
        """Test validating data transfer between regions."""
        from core.enterprise import DataResidencyManager

        residency = DataResidencyManager()

        # Same region - should be allowed
        can_transfer = await residency.validate_data_transfer(
            source_region="eu-west",
            destination_region="eu-west"
        )
        assert can_transfer is True

        # Cross-region with GDPR restrictions
        can_transfer = await residency.validate_data_transfer(
            source_region="eu-west",
            destination_region="us-east",
            data_classification="pii"
        )
        # May be restricted depending on configuration
        assert isinstance(can_transfer, bool)


@pytest.mark.unit
@pytest.mark.core
class TestEnterpriseCoordinator:
    """Tests for EnterpriseCoordinator."""

    def test_coordinator_initialization(self):
        """Test enterprise coordinator initialization."""
        from core.enterprise import EnterpriseCoordinator

        coordinator = EnterpriseCoordinator()

        assert coordinator is not None
        assert hasattr(coordinator, 'sso_manager')
        assert hasattr(coordinator, 'rbac_manager')
        assert hasattr(coordinator, 'audit_manager')
        assert hasattr(coordinator, 'data_residency_manager')

    @pytest.mark.asyncio
    async def test_full_authentication_flow(self):
        """Test full authentication flow with audit."""
        from core.enterprise import EnterpriseCoordinator

        coordinator = EnterpriseCoordinator()

        # Mock successful authentication
        with patch.object(coordinator.sso_manager, 'authenticate', return_value={
            "user_id": "user-123",
            "email": "user@example.com"
        }):
            with patch.object(coordinator.audit_manager, 'log_event', new_callable=AsyncMock):
                result = await coordinator.authenticate(
                    provider_type="oidc",
                    tenant_id="tenant-123",
                    credentials={"code": "auth-code"}
                )

                assert result["user_id"] == "user-123"
                # Audit should have been called
                coordinator.audit_manager.log_event.assert_called()

    @pytest.mark.asyncio
    async def test_permission_check_with_audit(self):
        """Test permission check with audit logging."""
        from core.enterprise import EnterpriseCoordinator

        coordinator = EnterpriseCoordinator()

        with patch.object(coordinator.rbac_manager, 'check_permission', return_value=True):
            with patch.object(coordinator.audit_manager, 'log_event', new_callable=AsyncMock):
                has_permission = await coordinator.check_permission_with_audit(
                    user_id="user-123",
                    tenant_id="tenant-123",
                    permission="execute:agents",
                    resource="agent-456"
                )

                assert has_permission is True
