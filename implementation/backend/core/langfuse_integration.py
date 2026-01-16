"""
Langfuse Integration for KOSMOS V2.0

LLM observability, tracing, and cost tracking via Langfuse.
"""

from typing import Any, Dict, Optional
from datetime import datetime

import structlog

logger = structlog.get_logger()

# Lazy import - only import if Langfuse is configured
_langfuse_client: Optional[Any] = None
_langfuse_enabled: bool = False


def _init_langfuse() -> Optional[Any]:
    """Initialize Langfuse client if configured."""
    global _langfuse_client, _langfuse_enabled

    if _langfuse_client is not None:
        return _langfuse_client

    try:
        from langfuse import Langfuse
        from core.config import settings

        # Check if Langfuse is configured
        langfuse_secret_key = getattr(settings, "langfuse_secret_key", None)
        langfuse_public_key = getattr(settings, "langfuse_public_key", None)
        langfuse_host = getattr(settings, "langfuse_host", "http://langfuse:3000")

        if langfuse_secret_key and langfuse_public_key:
            _langfuse_client = Langfuse(
                secret_key=langfuse_secret_key,
                public_key=langfuse_public_key,
                host=langfuse_host,
            )
            _langfuse_enabled = True
            logger.info("Langfuse client initialized", host=langfuse_host)
            return _langfuse_client
        else:
            logger.warning("Langfuse not configured - skipping initialization")
            _langfuse_enabled = False
            return None

    except ImportError:
        logger.warning("Langfuse not installed - skipping initialization")
        _langfuse_enabled = False
        return None
    except Exception as e:
        logger.error("Failed to initialize Langfuse", error=str(e), exc_info=True)
        _langfuse_enabled = False
        return None


def get_langfuse() -> Optional[Any]:
    """Get Langfuse client instance."""
    return _init_langfuse()


def is_langfuse_enabled() -> bool:
    """Check if Langfuse is enabled."""
    _init_langfuse()
    return _langfuse_enabled


class LangfuseTracer:
    """Context manager for Langfuse tracing."""

    def __init__(
        self,
        name: str,
        trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.name = name
        self.trace_id = trace_id
        self.user_id = user_id
        self.metadata = metadata or {}
        self.trace = None
        self.span = None

    def __enter__(self):
        if not is_langfuse_enabled():
            return self

        try:
            langfuse = get_langfuse()
            if langfuse:
                self.trace = langfuse.trace(
                    name=self.name,
                    id=self.trace_id,
                    user_id=self.user_id,
                    metadata=self.metadata,
                )
        except Exception as e:
            logger.warning("Failed to create Langfuse trace", error=str(e))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.trace:
            try:
                if exc_type:
                    self.trace.update(
                        level="ERROR",
                        status_message=str(exc_val),
                    )
                self.trace.update(end_time=datetime.utcnow())
            except Exception as e:
                logger.warning("Failed to update Langfuse trace", error=str(e))

    def span(self, name: str, metadata: Optional[Dict[str, Any]] = None):
        """Create a span within the trace."""
        if not self.trace:
            return self

        try:
            return self.trace.span(name=name, metadata=metadata or {})
        except Exception as e:
            logger.warning("Failed to create Langfuse span", error=str(e))
            return None

    def generation(
        self,
        name: str,
        model: str,
        input: Any,
        output: Optional[str] = None,
        usage: Optional[Dict[str, int]] = None,
        cost: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Log an LLM generation."""
        if not self.trace:
            return None

        try:
            return self.trace.generation(
                name=name,
                model=model,
                input=input,
                output=output,
                usage=usage,
                metadata={
                    **(metadata or {}),
                    "cost_usd": cost,
                },
            )
        except Exception as e:
            logger.warning("Failed to log Langfuse generation", error=str(e))
            return None


def trace_llm_call(
    name: str,
    model: str,
    input: Any,
    output: Optional[str] = None,
    usage: Optional[Dict[str, int]] = None,
    cost: Optional[float] = None,
    trace_id: Optional[str] = None,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Trace an LLM call with Langfuse.

    Args:
        name: Generation name
        model: Model name
        input: Input messages/prompt
        output: Output content
        usage: Token usage dict
        cost: Cost in USD
        trace_id: Optional trace ID
        user_id: Optional user ID
        metadata: Optional metadata
    """
    if not is_langfuse_enabled():
        return

    try:
        langfuse = get_langfuse()
        if langfuse:
            trace = langfuse.trace(
                name=f"llm_call_{name}",
                id=trace_id,
                user_id=user_id,
                metadata=metadata or {},
            )

            trace.generation(
                name=name,
                model=model,
                input=input,
                output=output,
                usage=usage,
                metadata={"cost_usd": cost} if cost else {},
            )

            trace.update(end_time=datetime.utcnow())
            langfuse.flush()

    except Exception as e:
        logger.warning("Failed to trace LLM call", error=str(e), exc_info=True)
