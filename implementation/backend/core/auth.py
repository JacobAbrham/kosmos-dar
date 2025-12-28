"""
KOSMOS V2.0 Authentication Service

Handles user authentication, token management, and session handling.
"""

import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenData(BaseModel):
    """Token payload data."""
    user_id: str
    email: str
    tenant_id: Optional[str] = None
    roles: list[str] = []


class User(BaseModel):
    """User model."""
    id: str
    email: EmailStr
    full_name: str
    tenant_id: Optional[str] = None
    roles: list[str] = []
    is_active: bool = True
    created_at: datetime = datetime.utcnow()


class AuthService:
    """Authentication service."""

    # In-memory user store (replace with database in production)
    _users: Dict[str, Dict[str, Any]] = {
        "demo@kosmos.io": {
            "id": "user-demo-001",
            "email": "demo@kosmos.io",
            "full_name": "Demo User",
            "password_hash": pwd_context.hash("demo123"),
            "tenant_id": "default",
            "roles": ["user", "admin"],
            "is_active": True,
        }
    }

    # Token blacklist for logout
    _blacklist: set[str] = set()

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)

    def hash_password(self, password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password)

    async def authenticate(
        self,
        email: str,
        password: str,
        tenant_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Authenticate a user by email and password."""
        user = self._users.get(email)

        if not user:
            return None

        if not user.get("is_active", False):
            raise ValueError("Account is disabled")

        if not self.verify_password(password, user["password_hash"]):
            return None

        # Check tenant if specified
        if tenant_id and user.get("tenant_id") != tenant_id:
            return None

        return {
            "user_id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "tenant_id": user.get("tenant_id"),
            "roles": user.get("roles", []),
        }

    async def register(
        self,
        email: str,
        password: str,
        full_name: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register a new user."""
        if email in self._users:
            raise ValueError("Email already exists")

        user_id = f"user-{secrets.token_hex(8)}"

        self._users[email] = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "password_hash": self.hash_password(password),
            "tenant_id": tenant_id or "default",
            "roles": ["user"],
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
        }

        return {
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "tenant_id": tenant_id or "default",
        }

    def create_tokens(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create access and refresh tokens for a user."""
        now = datetime.utcnow()

        # Access token
        access_payload = {
            "sub": user_data["user_id"],
            "email": user_data["email"],
            "tenant_id": user_data.get("tenant_id"),
            "roles": user_data.get("roles", []),
            "type": "access",
            "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": now,
        }
        access_token = jwt.encode(access_payload, SECRET_KEY, algorithm=ALGORITHM)

        # Refresh token
        refresh_payload = {
            "sub": user_data["user_id"],
            "type": "refresh",
            "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "iat": now,
        }
        refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode an access token."""
        if token in self._blacklist:
            return None

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

            if payload.get("type") != "access":
                return None

            return {
                "user_id": payload.get("sub"),
                "email": payload.get("email"),
                "tenant_id": payload.get("tenant_id"),
                "roles": payload.get("roles", []),
            }
        except JWTError:
            return None

    async def refresh_tokens(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Create new tokens using a refresh token."""
        try:
            payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

            if payload.get("type") != "refresh":
                return None

            user_id = payload.get("sub")

            # Find user by ID
            user = None
            for u in self._users.values():
                if u["id"] == user_id:
                    user = u
                    break

            if not user or not user.get("is_active"):
                return None

            return self.create_tokens({
                "user_id": user["id"],
                "email": user["email"],
                "tenant_id": user.get("tenant_id"),
                "roles": user.get("roles", []),
            })
        except JWTError:
            return None

    def logout(self, token: str) -> None:
        """Invalidate a token by adding to blacklist."""
        self._blacklist.add(token)

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        for user in self._users.values():
            if user["id"] == user_id:
                return {
                    "user_id": user["id"],
                    "email": user["email"],
                    "full_name": user["full_name"],
                    "tenant_id": user.get("tenant_id"),
                    "roles": user.get("roles", []),
                    "is_active": user.get("is_active", True),
                }
        return None


# Singleton instance
auth_service = AuthService()

# HTTP Bearer for token auth
security = HTTPBearer()


def get_auth_service() -> AuthService:
    """Dependency to get auth service."""
    return auth_service


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_svc: AuthService = Depends(get_auth_service)
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user from JWT token.

    Raises:
        HTTPException: If token is invalid or missing
    """
    token = credentials.credentials

    user_data = await auth_svc.verify_token(token)

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_data


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    auth_svc: AuthService = Depends(get_auth_service)
) -> Optional[Dict[str, Any]]:
    """
    Dependency to optionally get the current authenticated user.
    Returns None if no valid token is provided.
    """
    if not credentials:
        return None

    token = credentials.credentials
    return await auth_svc.verify_token(token)
