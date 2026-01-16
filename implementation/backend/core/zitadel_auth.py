"""
KOSMOS DAR Zitadel Authentication Integration

OIDC/OAuth 2.0 authentication using Zitadel with JWT validation.
Supports both user authentication and service account authentication.
"""

import httpx
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

import structlog
from jose import jwt, jwk, JWTError
from jose.utils import base64url_decode
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.config import settings

logger = structlog.get_logger()


# ============================================================================
# ZITADEL OIDC CONFIGURATION
# ============================================================================

class ZitadelAuth:
    """
    Zitadel OIDC/OAuth 2.0 authentication service.
    
    Features:
    - JWT token validation using JWKS
    - User authentication via OIDC
    - Service account authentication via JWT Profile
    - Token introspection
    - User info retrieval
    """
    
    def __init__(self):
        self.domain = settings.zitadel_domain
        self.project_id = settings.zitadel_project_id
        self.client_id = settings.zitadel_client_id
        self.client_secret = settings.zitadel_client_secret
        
        # Zitadel endpoints
        self.issuer = f"http://{self.domain}" if not self.domain.startswith("http") else self.domain
        self.jwks_url = f"{self.issuer}/.well-known/openid-configuration"
        self.token_url = f"{self.issuer}/oauth/v2/token"
        self.userinfo_url = f"{self.issuer}/oidc/v1/userinfo"
        self.introspect_url = f"{self.issuer}/oauth/v2/introspect"
        
        # JWKS cache
        self._jwks: Optional[Dict[str, Any]] = None
        self._jwks_expires: Optional[datetime] = None
        
        self.logger = logger.bind(component="ZitadelAuth")
    
    async def _get_jwks(self) -> Dict[str, Any]:
        """Get JWKS from Zitadel (with caching)."""
        # Check cache
        if self._jwks and self._jwks_expires and datetime.utcnow() < self._jwks_expires:
            return self._jwks
        
        try:
            async with httpx.AsyncClient() as client:
                # Get OpenID configuration
                config_response = await client.get(self.jwks_url)
                config_response.raise_for_status()
                config = config_response.json()
                
                # Get JWKS
                jwks_response = await client.get(config.get("jwks_uri", f"{self.issuer}/.well-known/jwks.json"))
                jwks_response.raise_for_status()
                jwks_data = jwks_response.json()
                
                # Cache for 1 hour
                self._jwks = jwks_data
                self._jwks_expires = datetime.utcnow() + timedelta(hours=1)
                
                self.logger.debug("JWKS fetched and cached", keys_count=len(jwks_data.get("keys", [])))
                
                return jwks_data
                
        except Exception as e:
            self.logger.error("Failed to fetch JWKS", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
    
    def _get_signing_key(self, token: str, jwks: Dict[str, Any]) -> Optional[jwk.Key]:
        """Get the signing key for a token."""
        try:
            # Decode token header
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            
            if not kid:
                return None
            
            # Find key in JWKS
            for key_data in jwks.get("keys", []):
                if key_data.get("kid") == kid:
                    return jwk.construct(key_data)
            
            return None
            
        except Exception as e:
            self.logger.warning("Failed to get signing key", error=str(e))
            return None
    
    async def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode a JWT token from Zitadel.
        
        Args:
            token: JWT token string
        
        Returns:
            Decoded token claims
        
        Raises:
            HTTPException: If token is invalid
        """
        try:
            # Get JWKS
            jwks = await self._get_jwks()
            
            # Get signing key
            signing_key = self._get_signing_key(token, jwks)
            if not signing_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: signing key not found"
                )
            
            # Verify and decode token
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.issuer,
                options={
                    "verify_signature": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_exp": True,
                }
            )
            
            # Extract user info
            user_data = {
                "user_id": claims.get("sub"),
                "email": claims.get("email"),
                "full_name": claims.get("name") or claims.get("preferred_username"),
                "tenant_id": claims.get("org_id") or claims.get("tenant_id"),
                "roles": claims.get("roles", []),
                "permissions": claims.get("permissions", []),
                "email_verified": claims.get("email_verified", False),
            }
            
            self.logger.debug("Token verified", user_id=user_data["user_id"])
            
            return user_data
            
        except JWTError as e:
            self.logger.warning("Token verification failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        except Exception as e:
            self.logger.error("Token verification error", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed"
            )
    
    async def introspect_token(self, token: str) -> Dict[str, Any]:
        """
        Introspect a token using Zitadel's introspection endpoint.
        
        Args:
            token: Token to introspect
        
        Returns:
            Token introspection result
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.introspect_url,
                    data={
                        "token": token,
                        "token_type_hint": "access_token",
                    },
                    auth=(self.client_id, self.client_secret) if self.client_secret else None,
                )
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            self.logger.error("Token introspection failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token introspection failed"
            )
    
    async def get_userinfo(self, token: str) -> Dict[str, Any]:
        """
        Get user info from Zitadel's userinfo endpoint.
        
        Args:
            token: Access token
        
        Returns:
            User info
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.userinfo_url,
                    headers={"Authorization": f"Bearer {token}"}
                )
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            self.logger.error("Failed to get userinfo", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to retrieve user info"
            )
    
    def get_authorization_url(
        self,
        redirect_uri: str,
        state: Optional[str] = None,
        scope: str = "openid profile email",
        code_challenge: Optional[str] = None,
        code_challenge_method: str = "S256"
    ) -> str:
        """
        Generate Zitadel authorization URL for OAuth 2.0 flow.
        
        Args:
            redirect_uri: Redirect URI after authorization
            state: Optional state parameter
            scope: OAuth scopes
            code_challenge: PKCE code challenge
            code_challenge_method: PKCE method (S256 or plain)
        
        Returns:
            Authorization URL
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
        }
        
        if state:
            params["state"] = state
        
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = code_challenge_method
        
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.issuer}/oauth/v2/authorize?{query_string}"
    
    async def exchange_code(
        self,
        code: str,
        redirect_uri: str,
        code_verifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for tokens.
        
        Args:
            code: Authorization code
            redirect_uri: Redirect URI used in authorization
            code_verifier: PKCE code verifier (if using PKCE)
        
        Returns:
            Token response with access_token, refresh_token, etc.
        """
        try:
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
            }
            
            if code_verifier:
                data["code_verifier"] = code_verifier
            
            auth = None
            if self.client_secret:
                auth = (self.client_id, self.client_secret)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data=data,
                    auth=auth,
                )
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            self.logger.error("Token exchange failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to exchange authorization code"
            )
    
    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Refresh token
        
        Returns:
            New token response
        """
        try:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
            }
            
            auth = None
            if self.client_secret:
                auth = (self.client_id, self.client_secret)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data=data,
                    auth=auth,
                )
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            self.logger.error("Token refresh failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to refresh token"
            )


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_zitadel_auth: Optional[ZitadelAuth] = None


def get_zitadel_auth() -> ZitadelAuth:
    """Get Zitadel auth service singleton."""
    global _zitadel_auth
    if _zitadel_auth is None:
        _zitadel_auth = ZitadelAuth()
    return _zitadel_auth


# ============================================================================
# FASTAPI DEPENDENCIES
# ============================================================================

security = HTTPBearer()


async def get_current_user_zitadel(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency to get current user from Zitadel JWT token.
    
    Usage:
        @router.get("/protected")
        async def protected_route(user: Dict = Depends(get_current_user_zitadel)):
            return {"user_id": user["user_id"]}
    """
    token = credentials.credentials
    zitadel_auth = get_zitadel_auth()
    return await zitadel_auth.verify_token(token)
