"""
KOSMOS V2.0 Configuration
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="KOSMOS_",
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    log_level: str = "INFO"

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://kosmos:kosmos_dev_password@localhost:5432/kosmos",
        validation_alias=AliasChoices("KOSMOS_DATABASE_URL", "DATABASE_URL"),
    )

    # Cache
    redis_url: str = Field(
        default="redis://localhost:6379",
        validation_alias=AliasChoices("KOSMOS_REDIS_URL", "REDIS_URL"),
    )

    # NATS
    nats_url: str = Field(
        default="nats://localhost:4222",
        validation_alias=AliasChoices("KOSMOS_NATS_URL", "NATS_URL"),
    )

    # MinIO
    minio_host: str = "localhost"
    minio_port: int = 9000
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "kosmos"

    # Authentication
    zitadel_domain: str = "localhost:8080"
    zitadel_project_id: Optional[str] = None
    zitadel_client_id: Optional[str] = None
    zitadel_client_secret: Optional[str] = None

    # LLM Providers
    openai_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_OPENAI_API_KEY", "OPENAI_API_KEY"),
    )
    anthropic_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
    )
    huggingface_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_HUGGINGFACE_API_KEY", "HUGGINGFACE_API_KEY"),
    )
    litellm_url: str = Field(
        default="http://localhost:4000",
        validation_alias=AliasChoices("KOSMOS_LITELLM_URL", "LITELLM_URL"),
    )
    litellm_master_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_LITELLM_MASTER_KEY", "LITELLM_MASTER_KEY"),
    )

    # Observability
    langfuse_public_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_LANGFUSE_PUBLIC_KEY", "LANGFUSE_PUBLIC_KEY"),
    )
    langfuse_secret_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KOSMOS_LANGFUSE_SECRET_KEY", "LANGFUSE_SECRET_KEY"),
    )
    langfuse_host: str = Field(
        default="http://langfuse:3000",
        validation_alias=AliasChoices("KOSMOS_LANGFUSE_HOST", "LANGFUSE_HOST"),
    )
    jaeger_agent_host: str = "localhost"
    jaeger_agent_port: int = 6831

    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Agent Settings
    zeus_max_iterations: int = 10
    zeus_timeout_seconds: int = 120
    pentarchy_vote_timeout_seconds: int = 30

    # Cost Governance
    cost_auto_approve_max: float = 50.0
    cost_pentarchy_vote_max: float = 100.0
    cost_daily_limit: float = 500.0
    cost_monthly_limit: float = 10000.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v):
        """Ensure SQLAlchemy async Postgres URLs use an async driver.

        Accepts common forms like:
        - postgresql://...  -> postgresql+asyncpg://...
        - postgres://...    -> postgresql+asyncpg://...
        """
        if not isinstance(v, str):
            return v
        url = v.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        return url

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
