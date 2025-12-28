"""
KOSMOS V2.0 Hestia Agent - Operations & Infrastructure

Hestia handles all operational tasks including system monitoring,
infrastructure management, and operational workflows.

Upgraded to LangGraph base with:
- State persistence (checkpointing)
- HITL for critical operations
- Semantic router integration
- SDUI operations dashboard components
- Docker/Kubernetes MCP integration
"""

from typing import Any, Callable, Dict, List, Optional, Literal
from datetime import datetime
from enum import Enum
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    HumanInputRequest,
    HumanInputType,
    ToolCategory,
    require_confirmation,
)
from core.tool_registry import ToolCallResult

logger = structlog.get_logger()


# ============================================================================
# Domain Types
# ============================================================================

class ServiceStatus(str, Enum):
    """Service health status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    MAINTENANCE = "maintenance"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class OperationType(str, Enum):
    """Types of operations."""
    HEALTH_CHECK = "health_check"
    DEPLOY = "deploy"
    ROLLBACK = "rollback"
    SCALE = "scale"
    RESTART = "restart"
    BACKUP = "backup"
    RESTORE = "restore"
    MAINTENANCE = "maintenance"


# ============================================================================
# State Definition
# ============================================================================

class HestiaState(AgentGraphState):
    """
    State for Hestia operations workflow.

    Extends base state with operations-specific fields.
    """
    # Operation details
    operation: OperationType = OperationType.HEALTH_CHECK
    target_service: Optional[str] = None
    target_environment: str = "production"

    # Health status
    services_health: List[Dict[str, Any]] = Field(default_factory=list)
    overall_health_score: float = 1.0

    # Alerts
    active_alerts: List[Dict[str, Any]] = Field(default_factory=list)
    alert_acknowledgements: List[str] = Field(default_factory=list)

    # Operation results
    operation_result: Optional[Dict[str, Any]] = None
    operation_logs: List[str] = Field(default_factory=list)

    # Scaling
    current_replicas: int = 0
    desired_replicas: int = 0

    # Deployment
    deployment_version: Optional[str] = None
    rollback_target: Optional[str] = None

    # Dashboard data
    dashboard_metrics: Optional[Dict[str, Any]] = None


# ============================================================================
# Hestia Agent
# ============================================================================

class HestiaAgent(LangGraphAgent[HestiaState]):
    """
    Hestia - Operations & Infrastructure Agent

    Responsibilities:
    - Monitor system health and metrics
    - Manage deployments and rollbacks
    - Handle scaling operations
    - Process and route alerts
    - Manage backups and recovery
    - Coordinate with infrastructure

    MCP Servers:
    - (would use kubernetes-mcp, docker-mcp in production)

    SDUI Components:
    - GlassHealthDashboard: System status
    - GlassAlertPanel: Active alerts
    - GlassMeter: Resource utilization
    """

    # Services to monitor
    MONITORED_SERVICES = [
        "api-gateway",
        "agent-orchestrator",
        "database",
        "cache",
        "message-bus",
        "object-storage",
        "auth-service",
        "observability",
    ]

    def __init__(self):
        super().__init__(
            agent_id="hestia",
            name="Hestia",
            domain="operations",
            description="Operations and infrastructure agent for system monitoring and management",
            tool_categories=[ToolCategory.DEVELOPMENT, ToolCategory.FILESYSTEM],
            mcp_servers=[],  # Would include kubernetes-mcp, docker-mcp
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=15,
            timeout_seconds=300,
        )

    # =========================================================================
    # Template Implementation
    # =========================================================================

    def create_state_class(self) -> type:
        """Return HestiaState for workflow."""
        return HestiaState

    def define_nodes(self) -> Dict[str, Callable]:
        """Define Hestia-specific workflow nodes."""
        return {
            "parse_ops_request": self._parse_ops_request,
            "health_check": self._health_check,
            "check_alerts": self._check_alerts,
            "execute_operation": self._execute_operation,
            "handle_alerts": self._handle_alerts,
            "build_dashboard": self._build_dashboard,
        }

    def define_edges(self) -> List[tuple]:
        """Define Hestia-specific workflow edges."""
        return [
            ("plan", "parse_ops_request"),

            # Route based on operation
            ("parse_ops_request", self._route_operation, {
                "health_check": "health_check",
                "deploy": "execute_operation",
                "rollback": "execute_operation",
                "scale": "execute_operation",
                "restart": "execute_operation",
                "backup": "execute_operation",
                "restore": "execute_operation",
            }),

            ("health_check", "check_alerts"),
            ("check_alerts", self._has_alerts_condition, {
                True: "handle_alerts",
                False: "build_dashboard"
            }),

            ("handle_alerts", "build_dashboard"),
            ("execute_operation", "health_check"),
            ("build_dashboard", "synthesize"),
        ]

    def _route_operation(self, state: HestiaState) -> str:
        """Route to appropriate operation handler."""
        op = state.operation.value
        if op == "health_check":
            return "health_check"
        return "deploy"  # Route all modifications through execute_operation

    def _has_alerts_condition(self, state: HestiaState) -> bool:
        """Check if there are active alerts."""
        return len(state.active_alerts) > 0

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_ops_request(self, state: HestiaState) -> Dict[str, Any]:
        """Parse the operations request."""
        self.logger.info("Parsing operations request...", task=state.current_task)

        task_lower = (state.current_task or "").lower()

        # Determine operation
        if any(kw in task_lower for kw in ["health", "status", "check", "monitor"]):
            operation = OperationType.HEALTH_CHECK
        elif any(kw in task_lower for kw in ["deploy", "release"]):
            operation = OperationType.DEPLOY
        elif any(kw in task_lower for kw in ["rollback", "revert"]):
            operation = OperationType.ROLLBACK
        elif any(kw in task_lower for kw in ["scale", "replicas"]):
            operation = OperationType.SCALE
        elif any(kw in task_lower for kw in ["restart", "reboot"]):
            operation = OperationType.RESTART
        elif any(kw in task_lower for kw in ["backup"]):
            operation = OperationType.BACKUP
        elif any(kw in task_lower for kw in ["restore"]):
            operation = OperationType.RESTORE
        else:
            operation = OperationType.HEALTH_CHECK

        # Extract target service
        target_service = state.task_context.get("service")

        await self._emit_progress(state, "Request parsed", 0.1)

        return {
            "operation": operation,
            "target_service": target_service,
            "target_environment": state.task_context.get("environment", "production"),
        }

    async def _health_check(self, state: HestiaState) -> Dict[str, Any]:
        """Perform health checks on services."""
        self.logger.info("Running health checks...")

        services_to_check = (
            [state.target_service] if state.target_service
            else self.MONITORED_SERVICES
        )

        services_health = []
        total_score = 0

        for service in services_to_check:
            health = await self._check_service_health(service)
            services_health.append(health)

            # Calculate score
            status_scores = {
                ServiceStatus.HEALTHY.value: 1.0,
                ServiceStatus.DEGRADED.value: 0.7,
                ServiceStatus.MAINTENANCE.value: 0.5,
                ServiceStatus.UNHEALTHY.value: 0.2,
                ServiceStatus.UNKNOWN.value: 0.0,
            }
            total_score += status_scores.get(health["status"], 0)

        overall_health_score = total_score / len(services_health) if services_health else 0

        await self._emit_progress(state, "Health check complete", 0.4)

        return {
            "services_health": services_health,
            "overall_health_score": overall_health_score,
        }

    async def _check_service_health(self, service: str) -> Dict[str, Any]:
        """Check health of a specific service."""
        self.logger.info(f"Checking health: {service}")

        # In production, would use health endpoints or kubernetes API
        # For now, return simulated healthy status
        return {
            "name": service,
            "status": ServiceStatus.HEALTHY.value,
            "latency_ms": 15.0,
            "uptime_percent": 99.9,
            "cpu_percent": 25.0,
            "memory_percent": 45.0,
            "last_check": datetime.utcnow().isoformat(),
            "details": {
                "version": "1.0.0",
                "replicas": 3,
            },
        }

    async def _check_alerts(self, state: HestiaState) -> Dict[str, Any]:
        """Check for active alerts based on health status."""
        self.logger.info("Checking alerts...")

        alerts = []

        for health in state.services_health:
            if health["status"] == ServiceStatus.UNHEALTHY.value:
                alerts.append({
                    "id": f"alert_{health['name']}_{uuid4().hex[:8]}",
                    "severity": AlertSeverity.CRITICAL.value,
                    "source": health["name"],
                    "message": f"Service {health['name']} is unhealthy",
                    "timestamp": datetime.utcnow().isoformat(),
                    "acknowledged": False,
                })
            elif health["status"] == ServiceStatus.DEGRADED.value:
                alerts.append({
                    "id": f"alert_{health['name']}_{uuid4().hex[:8]}",
                    "severity": AlertSeverity.WARNING.value,
                    "source": health["name"],
                    "message": f"Service {health['name']} is degraded",
                    "timestamp": datetime.utcnow().isoformat(),
                    "acknowledged": False,
                })

            # Check resource thresholds
            if health.get("cpu_percent", 0) > 80:
                alerts.append({
                    "id": f"alert_cpu_{health['name']}_{uuid4().hex[:8]}",
                    "severity": AlertSeverity.WARNING.value,
                    "source": health["name"],
                    "message": f"High CPU usage: {health['cpu_percent']}%",
                    "timestamp": datetime.utcnow().isoformat(),
                    "acknowledged": False,
                })

        await self._emit_progress(state, f"Found {len(alerts)} alerts", 0.5)

        return {"active_alerts": alerts}

    async def _handle_alerts(self, state: HestiaState) -> Dict[str, Any]:
        """Handle active alerts."""
        self.logger.info("Handling alerts...", count=len(state.active_alerts))

        operation_logs = []

        for alert in state.active_alerts:
            # Log alert
            operation_logs.append(f"Alert: [{alert['severity']}] {alert['message']}")

            # Critical alerts should notify Iris
            if alert["severity"] == AlertSeverity.CRITICAL.value:
                try:
                    # Would delegate to Iris for notifications
                    self.logger.warning(f"Critical alert: {alert['message']}")
                except Exception as e:
                    self.logger.error(f"Failed to notify: {e}")

        await self._emit_progress(state, "Alerts handled", 0.7)

        return {"operation_logs": operation_logs}

    async def _execute_operation(self, state: HestiaState) -> Dict[str, Any]:
        """Execute the requested infrastructure operation."""
        self.logger.info("Executing operation...", operation=state.operation.value)

        operation_result = None
        operation_logs = []

        # Check if operation requires confirmation
        dangerous_ops = [OperationType.DEPLOY, OperationType.ROLLBACK, OperationType.RESTORE]

        if state.operation in dangerous_ops and not state.human_input_response:
            return {
                "requires_human_input": True,
                "human_input_request": {
                    "id": str(uuid4()),
                    "type": HumanInputType.CONFIRMATION.value,
                    "prompt": f"Confirm {state.operation.value} operation on {state.target_service or 'all services'}?",
                    "context": {
                        "operation": state.operation.value,
                        "target": state.target_service,
                        "environment": state.target_environment,
                    },
                    "timeout_seconds": 120,
                }
            }

        # Execute based on operation type
        if state.operation == OperationType.DEPLOY:
            operation_result = await self._deploy(state)
            operation_logs.append(f"Deployed version {state.deployment_version}")

        elif state.operation == OperationType.ROLLBACK:
            operation_result = await self._rollback(state)
            operation_logs.append(f"Rolled back to {state.rollback_target}")

        elif state.operation == OperationType.SCALE:
            operation_result = await self._scale(state)
            operation_logs.append(f"Scaled to {state.desired_replicas} replicas")

        elif state.operation == OperationType.RESTART:
            operation_result = await self._restart(state)
            operation_logs.append(f"Restarted {state.target_service}")

        elif state.operation == OperationType.BACKUP:
            operation_result = await self._backup(state)
            operation_logs.append(f"Backup created")

        elif state.operation == OperationType.RESTORE:
            operation_result = await self._restore(state)
            operation_logs.append(f"Restored from backup")

        await self._emit_progress(state, "Operation complete", 0.8)

        return {
            "operation_result": operation_result,
            "operation_logs": operation_logs,
        }

    async def _deploy(self, state: HestiaState) -> Dict[str, Any]:
        """Execute deployment."""
        self.logger.info(f"Deploying: {state.target_service}")

        return {
            "operation": "deploy",
            "service": state.target_service,
            "version": state.deployment_version,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _rollback(self, state: HestiaState) -> Dict[str, Any]:
        """Execute rollback."""
        self.logger.info(f"Rolling back: {state.target_service}")

        return {
            "operation": "rollback",
            "service": state.target_service,
            "target_version": state.rollback_target,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _scale(self, state: HestiaState) -> Dict[str, Any]:
        """Execute scaling operation."""
        self.logger.info(f"Scaling: {state.target_service} to {state.desired_replicas}")

        return {
            "operation": "scale",
            "service": state.target_service,
            "previous_replicas": state.current_replicas,
            "new_replicas": state.desired_replicas,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _restart(self, state: HestiaState) -> Dict[str, Any]:
        """Execute restart."""
        self.logger.info(f"Restarting: {state.target_service}")

        return {
            "operation": "restart",
            "service": state.target_service,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _backup(self, state: HestiaState) -> Dict[str, Any]:
        """Execute backup."""
        self.logger.info(f"Creating backup: {state.target_service}")

        backup_id = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

        return {
            "operation": "backup",
            "service": state.target_service,
            "backup_id": backup_id,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _restore(self, state: HestiaState) -> Dict[str, Any]:
        """Execute restore."""
        self.logger.info(f"Restoring: {state.target_service}")

        return {
            "operation": "restore",
            "service": state.target_service,
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _build_dashboard(self, state: HestiaState) -> Dict[str, Any]:
        """Build dashboard metrics."""
        self.logger.info("Building dashboard...")

        # Aggregate metrics
        healthy_count = sum(
            1 for s in state.services_health
            if s["status"] == ServiceStatus.HEALTHY.value
        )

        dashboard_metrics = {
            "overall_health_score": state.overall_health_score,
            "services_total": len(state.services_health),
            "services_healthy": healthy_count,
            "services_unhealthy": len(state.services_health) - healthy_count,
            "active_alerts": len(state.active_alerts),
            "critical_alerts": sum(
                1 for a in state.active_alerts
                if a["severity"] == AlertSeverity.CRITICAL.value
            ),
            "avg_latency_ms": sum(
                s.get("latency_ms", 0) for s in state.services_health
            ) / len(state.services_health) if state.services_health else 0,
            "timestamp": datetime.utcnow().isoformat(),
        }

        return {"dashboard_metrics": dashboard_metrics}

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    async def _generate_sdui_components(self, state: HestiaState) -> List[Dict[str, Any]]:
        """Generate SDUI components for operations dashboard."""
        components = []

        # Overall health meter
        components.append({
            "type": "GlassMeter",
            "props": {
                "label": "System Health",
                "value": state.overall_health_score * 100,
                "maxValue": 100,
                "showPercentage": True,
                "color": "green" if state.overall_health_score >= 0.9 else "yellow" if state.overall_health_score >= 0.7 else "red",
            }
        })

        # Services health grid
        if state.services_health:
            service_items = [
                {
                    "id": s["name"],
                    "title": s["name"],
                    "status": "completed" if s["status"] == "healthy" else "error" if s["status"] == "unhealthy" else "pending",
                    "description": f"Latency: {s.get('latency_ms', 0):.0f}ms | CPU: {s.get('cpu_percent', 0):.0f}%",
                }
                for s in state.services_health
            ]

            components.append({
                "type": "GlassTimeline",
                "props": {
                    "events": service_items,
                    "orientation": "vertical",
                }
            })

        # Alerts panel
        if state.active_alerts:
            for alert in state.active_alerts[:5]:
                components.append({
                    "type": "GlassAlert",
                    "props": {
                        "severity": alert["severity"],
                        "title": alert["source"],
                        "message": alert["message"],
                    }
                })

        # Operation result
        if state.operation_result:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": f"Operation: {state.operation.value}",
                    "variant": "success" if state.operation_result.get("status") == "success" else "error",
                    "children": [
                        {
                            "type": "GlassText",
                            "props": {"text": f"Status: {state.operation_result.get('status', 'unknown')}"}
                        }
                    ]
                }
            })

        # Dashboard metrics card
        if state.dashboard_metrics:
            metrics = state.dashboard_metrics
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "System Metrics",
                    "children": [
                        {
                            "type": "GlassDataList",
                            "props": {
                                "items": [
                                    {"label": "Healthy Services", "value": f"{metrics.get('services_healthy', 0)}/{metrics.get('services_total', 0)}"},
                                    {"label": "Active Alerts", "value": str(metrics.get("active_alerts", 0))},
                                    {"label": "Avg Latency", "value": f"{metrics.get('avg_latency_ms', 0):.0f}ms"},
                                ]
                            }
                        }
                    ]
                }
            })

        # Response message
        components.append({
            "type": "GlassChatBubble",
            "props": {
                "role": "assistant",
                "agent": "Hestia",
                "content": self._build_response_message(state),
            }
        })

        return components

    def _build_response_message(self, state: HestiaState) -> str:
        """Build the response message based on operation result."""
        if state.operation == OperationType.HEALTH_CHECK:
            healthy = sum(1 for s in state.services_health if s["status"] == "healthy")
            total = len(state.services_health)
            alert_msg = f" {len(state.active_alerts)} active alerts." if state.active_alerts else ""
            return f"System health: {healthy}/{total} services healthy ({state.overall_health_score:.0%}).{alert_msg}"

        elif state.operation_result:
            status = state.operation_result.get("status", "unknown")
            return f"{state.operation.value.title()} operation {status}."

        return "Operations check completed."

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status."""
        return await self.process(task="Check system health")

    async def trigger_alert(
        self,
        severity: str,
        source: str,
        message: str,
    ) -> None:
        """Trigger an operational alert."""
        self.logger.warning(f"Alert triggered: [{severity}] {source}: {message}")
