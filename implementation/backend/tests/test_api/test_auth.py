# KOSMOS V2.0 Authentication API Tests
"""
Tests for authentication endpoints including:
- User registration
- Login/logout
- Token refresh
- SSO (SAML, OIDC)
- Multi-tenancy auth
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from fastapi import status


@pytest.fixture
def mock_auth_service():
    """Mock authentication service."""
    service = MagicMock()
    service.authenticate = AsyncMock(return_value={
        "user_id": "user-123",
        "email": "test@kosmos.io",
        "tenant_id": "tenant-abc",
        "roles": ["user", "admin"],
    })
    service.create_tokens = MagicMock(return_value={
        "access_token": "mock-access-token",
        "refresh_token": "mock-refresh-token",
        "token_type": "bearer",
        "expires_in": 3600,
    })
    service.verify_token = AsyncMock(return_value={
        "user_id": "user-123",
        "tenant_id": "tenant-abc",
    })
    service.refresh_tokens = AsyncMock(return_value={
        "access_token": "new-access-token",
        "refresh_token": "new-refresh-token",
        "token_type": "bearer",
        "expires_in": 3600,
    })
    return service


@pytest.fixture
def auth_headers():
    """Authentication headers for protected endpoints."""
    return {"Authorization": "Bearer mock-access-token"}


class TestUserRegistration:
    """Tests for user registration endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_register_user_success(self, async_client: AsyncClient, mock_auth_service):
        """Test successful user registration."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/register",
                json={
                    "email": "newuser@kosmos.io",
                    "password": "SecurePass123!",
                    "full_name": "New User",
                    "tenant_id": "tenant-abc",
                }
            )

            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert "user_id" in data
            assert data["email"] == "newuser@kosmos.io"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_register_user_duplicate_email(self, async_client: AsyncClient, mock_auth_service):
        """Test registration with existing email fails."""
        mock_auth_service.register = AsyncMock(side_effect=ValueError("Email already exists"))

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/register",
                json={
                    "email": "existing@kosmos.io",
                    "password": "SecurePass123!",
                    "full_name": "Existing User",
                }
            )

            assert response.status_code == status.HTTP_409_CONFLICT

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_register_user_weak_password(self, async_client: AsyncClient):
        """Test registration with weak password fails validation."""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@kosmos.io",
                "password": "weak",
                "full_name": "User",
            }
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_register_user_invalid_email(self, async_client: AsyncClient):
        """Test registration with invalid email format."""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePass123!",
                "full_name": "User",
            }
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestLogin:
    """Tests for login endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_success(self, async_client: AsyncClient, mock_auth_service):
        """Test successful login returns tokens."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/login",
                data={
                    "username": "test@kosmos.io",
                    "password": "SecurePass123!",
                }
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_invalid_credentials(self, async_client: AsyncClient, mock_auth_service):
        """Test login with invalid credentials fails."""
        mock_auth_service.authenticate = AsyncMock(return_value=None)

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/login",
                data={
                    "username": "wrong@kosmos.io",
                    "password": "WrongPass123!",
                }
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_locked_account(self, async_client: AsyncClient, mock_auth_service):
        """Test login with locked account fails."""
        mock_auth_service.authenticate = AsyncMock(
            side_effect=ValueError("Account locked due to too many failed attempts")
        )

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/login",
                data={
                    "username": "locked@kosmos.io",
                    "password": "AnyPass123!",
                }
            )

            assert response.status_code == status.HTTP_423_LOCKED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_with_mfa(self, async_client: AsyncClient, mock_auth_service):
        """Test login requiring MFA returns challenge."""
        mock_auth_service.authenticate = AsyncMock(return_value={
            "mfa_required": True,
            "mfa_token": "mfa-challenge-token",
            "mfa_methods": ["totp", "sms"],
        })

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/login",
                data={
                    "username": "mfa-user@kosmos.io",
                    "password": "SecurePass123!",
                }
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["mfa_required"] is True
            assert "mfa_token" in data


class TestTokenRefresh:
    """Tests for token refresh endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_token_success(self, async_client: AsyncClient, mock_auth_service):
        """Test successful token refresh."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "valid-refresh-token"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_token_expired(self, async_client: AsyncClient, mock_auth_service):
        """Test refresh with expired token fails."""
        mock_auth_service.refresh_tokens = AsyncMock(
            side_effect=ValueError("Refresh token expired")
        )

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "expired-token"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_refresh_token_revoked(self, async_client: AsyncClient, mock_auth_service):
        """Test refresh with revoked token fails."""
        mock_auth_service.refresh_tokens = AsyncMock(
            side_effect=ValueError("Token has been revoked")
        )

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "revoked-token"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestLogout:
    """Tests for logout endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_logout_success(self, async_client: AsyncClient, mock_auth_service, auth_headers):
        """Test successful logout."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/logout",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_logout_all_sessions(self, async_client: AsyncClient, mock_auth_service, auth_headers):
        """Test logout from all sessions."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/logout-all",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK


class TestSSO:
    """Tests for SSO endpoints (SAML, OIDC)."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_oidc_login_redirect(self, async_client: AsyncClient):
        """Test OIDC login initiates redirect."""
        response = await async_client.get(
            "/api/v1/auth/oidc/login",
            params={"provider": "google"},
            follow_redirects=False
        )

        assert response.status_code == status.HTTP_307_TEMPORARY_REDIRECT
        assert "location" in response.headers

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_oidc_callback_success(self, async_client: AsyncClient, mock_auth_service):
        """Test OIDC callback with valid code."""
        mock_auth_service.handle_oidc_callback = AsyncMock(return_value={
            "user_id": "user-123",
            "email": "sso-user@kosmos.io",
            "access_token": "sso-access-token",
            "refresh_token": "sso-refresh-token",
        })

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.get(
                "/api/v1/auth/oidc/callback",
                params={
                    "code": "valid-auth-code",
                    "state": "valid-state",
                }
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_saml_metadata(self, async_client: AsyncClient):
        """Test SAML metadata endpoint returns valid XML."""
        response = await async_client.get("/api/v1/auth/saml/metadata")

        assert response.status_code == status.HTTP_200_OK
        assert "application/xml" in response.headers.get("content-type", "")

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_saml_acs(self, async_client: AsyncClient, mock_auth_service):
        """Test SAML ACS endpoint processes assertion."""
        mock_auth_service.handle_saml_response = AsyncMock(return_value={
            "user_id": "user-123",
            "email": "saml-user@kosmos.io",
        })

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/saml/acs",
                data={"SAMLResponse": "base64-encoded-response"}
            )

            assert response.status_code in [status.HTTP_200_OK, status.HTTP_302_FOUND]


class TestMultiTenantAuth:
    """Tests for multi-tenant authentication."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_login_with_tenant(self, async_client: AsyncClient, mock_auth_service):
        """Test login specifying tenant."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/login",
                data={
                    "username": "test@kosmos.io",
                    "password": "SecurePass123!",
                },
                headers={"X-Tenant-ID": "tenant-abc"}
            )

            assert response.status_code == status.HTTP_200_OK
            mock_auth_service.authenticate.assert_called_once()

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_access_wrong_tenant_resource(self, async_client: AsyncClient, mock_auth_service, auth_headers):
        """Test accessing resource from wrong tenant fails."""
        mock_auth_service.verify_tenant_access = AsyncMock(return_value=False)

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.get(
                "/api/v1/tenants/other-tenant/resources",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_switch_tenant(self, async_client: AsyncClient, mock_auth_service, auth_headers):
        """Test switching tenant context."""
        mock_auth_service.switch_tenant = AsyncMock(return_value={
            "tenant_id": "new-tenant",
            "access_token": "new-tenant-token",
        })

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/switch-tenant",
                json={"tenant_id": "new-tenant"},
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["tenant_id"] == "new-tenant"


class TestPasswordManagement:
    """Tests for password management endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_request_password_reset(self, async_client: AsyncClient, mock_auth_service):
        """Test password reset request."""
        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": "user@kosmos.io"}
            )

            # Always return 200 to prevent email enumeration
            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reset_password_with_token(self, async_client: AsyncClient, mock_auth_service):
        """Test password reset with valid token."""
        mock_auth_service.reset_password = AsyncMock(return_value=True)

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/password-reset/confirm",
                json={
                    "token": "valid-reset-token",
                    "new_password": "NewSecurePass123!",
                }
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_change_password(self, async_client: AsyncClient, mock_auth_service, auth_headers):
        """Test authenticated password change."""
        mock_auth_service.change_password = AsyncMock(return_value=True)

        with patch("api.routes.auth.auth_service", mock_auth_service):
            response = await async_client.post(
                "/api/v1/auth/password/change",
                json={
                    "current_password": "OldPass123!",
                    "new_password": "NewSecurePass123!",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
