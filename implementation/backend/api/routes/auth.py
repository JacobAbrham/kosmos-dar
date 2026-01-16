"""
KOSMOS V2.0 Authentication API

Endpoints for user authentication, registration, and token management.
"""

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, validator
from starlette import status

from core.auth import auth_service, AuthService, get_auth_service
from core.zitadel_auth import get_zitadel_auth, ZitadelAuth
from core.audit_logging import get_audit_logger, AuditEventType
from fastapi import Request


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ============================================================================
# Request/Response Models
# ============================================================================

class RegisterRequest(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=100)
    tenant_id: Optional[str] = None

    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v


class RegisterResponse(BaseModel):
    """User registration response."""
    user_id: str
    email: str
    full_name: str
    tenant_id: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str
    tenant_id: Optional[str] = None


class TokenResponse(BaseModel):
    """Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class UserResponse(BaseModel):
    """User info response."""
    user_id: str
    email: str
    full_name: str
    tenant_id: Optional[str] = None
    roles: list[str] = []


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    auth: AuthService = Depends(get_auth_service)
):
    """Register a new user."""
    try:
        result = await auth.register(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            tenant_id=request.tenant_id
        )
        return RegisterResponse(**result)
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    auth: AuthService = Depends(get_auth_service)
):
    """Authenticate user and return tokens."""
    audit_logger = await get_audit_logger()
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")
    
    try:
        user = await auth.authenticate(
            email=request.email,
            password=request.password,
            tenant_id=request.tenant_id
        )

        if not user:
            await audit_logger.log_authentication(
                action="login_failed",
                user_id=None,
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
                error_message="Invalid credentials",
                details={"email": request.email}
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Check for MFA requirement (placeholder)
        if user.get("mfa_required"):
            return {
                "mfa_required": True,
                "mfa_token": user.get("mfa_token"),
                "mfa_methods": user.get("mfa_methods", [])
            }

        tokens = auth.create_tokens(user)
        
        # Log successful authentication
        await audit_logger.log_authentication(
            action="login_success",
            user_id=user["user_id"],
            success=True,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": request.email, "tenant_id": request.tenant_id}
        )
        
        return TokenResponse(**tokens)

    except ValueError as e:
        await audit_logger.log_authentication(
            action="login_failed",
            user_id=None,
            success=False,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=str(e),
            details={"email": request.email}
        )
        if "locked" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@router.post("/login/form", response_model=TokenResponse)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth: AuthService = Depends(get_auth_service)
):
    """Login using OAuth2 form (for compatibility)."""
    user = await auth.authenticate(
        email=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    tokens = auth.create_tokens(user)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshRequest,
    auth: AuthService = Depends(get_auth_service)
):
    """Refresh access token using refresh token."""
    tokens = await auth.refresh_tokens(request.refresh_token)

    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    return TokenResponse(**tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    authorization: str = Header(...),
    auth: AuthService = Depends(get_auth_service)
):
    """Logout and invalidate token."""
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        auth.logout(token)
    return None


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    authorization: str = Header(...),
    auth: AuthService = Depends(get_auth_service)
):
    """Get current authenticated user info."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )

    token = authorization[7:]
    user = await auth.verify_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Get full user info
    full_user = await auth.get_user_by_id(user["user_id"])
    if not full_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(**full_user)


@router.get("/verify")
async def verify_token(
    authorization: str = Header(...),
    auth: AuthService = Depends(get_auth_service)
):
    """Verify if a token is valid."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )

    token = authorization[7:]
    user = await auth.verify_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    return {"valid": True, "user_id": user["user_id"]}


# ============================================================================
# Zitadel OAuth 2.0 Endpoints
# ============================================================================

class OAuthCallbackRequest(BaseModel):
    """OAuth callback request."""
    code: str
    state: Optional[str] = None


@router.get("/zitadel/authorize")
async def zitadel_authorize(
    redirect_uri: str,
    state: Optional[str] = None,
    scope: str = "openid profile email"
):
    """Get Zitadel authorization URL."""
    zitadel_auth = get_zitadel_auth()
    auth_url = zitadel_auth.get_authorization_url(
        redirect_uri=redirect_uri,
        state=state,
        scope=scope
    )
    return {"authorization_url": auth_url}


@router.post("/zitadel/callback")
async def zitadel_callback(
    request: OAuthCallbackRequest,
    redirect_uri: str,
    http_request: Request
):
    """Handle OAuth callback and exchange code for tokens."""
    audit_logger = await get_audit_logger()
    ip_address = http_request.client.host if http_request.client else None
    
    try:
        zitadel_auth = get_zitadel_auth()
        tokens = await zitadel_auth.exchange_code(
            code=request.code,
            redirect_uri=redirect_uri
        )
        
        # Verify token to get user info
        user_data = await zitadel_auth.verify_token(tokens["access_token"])
        
        # Log successful authentication
        await audit_logger.log_authentication(
            action="oauth_login_success",
            user_id=user_data["user_id"],
            success=True,
            ip_address=ip_address,
            details={"provider": "zitadel", "tenant_id": user_data.get("tenant_id")}
        )
        
        return TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token", ""),
            token_type=tokens.get("token_type", "bearer"),
            expires_in=tokens.get("expires_in", 3600)
        )
        
    except Exception as e:
        await audit_logger.log_authentication(
            action="oauth_login_failed",
            success=False,
            ip_address=ip_address,
            error_message=str(e),
            details={"provider": "zitadel"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OAuth callback failed: {str(e)}"
        )


@router.post("/zitadel/refresh")
async def zitadel_refresh(
    request: RefreshRequest,
    http_request: Request
):
    """Refresh Zitadel access token."""
    try:
        zitadel_auth = get_zitadel_auth()
        tokens = await zitadel_auth.refresh_token(request.refresh_token)
        
        return TokenResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token", request.refresh_token),
            token_type=tokens.get("token_type", "bearer"),
            expires_in=tokens.get("expires_in", 3600)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}"
        )
