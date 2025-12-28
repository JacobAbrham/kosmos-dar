"""
KOSMOS V2.0 Logging Configuration
"""

import logging
import sys
from typing import Any

import structlog

from .config import settings


def setup_logging() -> None:
    """Configure structured logging for KOSMOS."""

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level.upper()),
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            _add_service_info,
            _format_output,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def _add_service_info(
    logger: Any,
    method_name: str,
    event_dict: dict
) -> dict:
    """Add service information to log events."""
    event_dict["service"] = "kosmos-backend"
    event_dict["environment"] = settings.env
    return event_dict


def _format_output(
    logger: Any,
    method_name: str,
    event_dict: dict
) -> str:
    """Format log output based on environment."""
    if settings.env == "development":
        # Pretty print for development
        return structlog.dev.ConsoleRenderer()(logger, method_name, event_dict)
    else:
        # JSON for production
        return structlog.processors.JSONRenderer()(logger, method_name, event_dict)
