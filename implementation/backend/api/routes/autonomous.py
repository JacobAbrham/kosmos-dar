"""
KOSMOS V2.0 Autonomous Evolution API

Endpoints for self-improvement, workflow automation,
multi-tenancy, and enterprise features.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Depends, Request, Header
from pydantic import BaseModel, Field

from core.self_improvement import (
    get_self_improvement_coordinator,
    SelfImprovementCoordinator,
    MetricType,
    ImprovementType
)
from core.workflow_automation import (
    get_workflow_automation_coordinator,
    WorkflowAutomationCoordinator,
    WorkflowStatus,
    TriggerType
)
from core.multitenancy import (
    get_multitenancy_coordinator,
    MultiTenantCoordinator,
    TenantTier,
    ResourceType,
    TenantContext
)
from core.enterprise import (
    get_enterprise_coordinator,
    EnterpriseCoordinator,
    SSOProvider,
    PermissionAction,
    ResourceCategory,
    AuditEventType,
    DataRegion,
    ComplianceFramework
)

router = APIRouter(prefix="/api/v1/autonomous", tags=["autonomous"])


# ============================================================================
# Request/Response Models
# ============================================================================

# Self-Improvement Models
class MetricRecordRequest(BaseModel):
    metric_type: str
    value: float
    agent_id: Optional[str] = None
    tool_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class PromptVariantRequest(BaseModel):
    prompt_id: str
    original_prompt: str
    strategy: Optional[str] = None


class ImprovementSuggestionResponse(BaseModel):
    type: str
    priority: str
    description: str
    recommendation: str
    pattern_id: Optional[str] = None


# Workflow Models
class WorkflowCreateRequest(BaseModel):
    name: str
    description: str = ""
    steps: List[Dict[str, Any]]
    triggers: List[Dict[str, Any]] = []


class WorkflowExecuteRequest(BaseModel):
    workflow_id: str
    context: Optional[Dict[str, Any]] = None


# Tenant Models
class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    tier: str = "free"
    branding: Optional[Dict[str, Any]] = None


class TenantUserRequest(BaseModel):
    user_id: str
    role: str = "member"
    permissions: Optional[List[str]] = None


# Enterprise Models
class SSOConfigRequest(BaseModel):
    provider: str
    client_id: str
    client_secret: str
    issuer_url: str
    redirect_uri: str
    scopes: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class RoleCreateRequest(BaseModel):
    name: str
    description: str
    permissions: List[Dict[str, str]]


class RoleAssignRequest(BaseModel):
    user_id: str
    role_id: str
    expires_at: Optional[str] = None
    scope: Optional[Dict[str, Any]] = None


class DataResidencyRequest(BaseModel):
    primary_region: str
    allowed_regions: List[str]
    compliance_frameworks: Optional[List[str]] = None
    data_retention_days: int = 365
    encryption_required: bool = True


# ============================================================================
# Dependencies
# ============================================================================

async def get_self_improvement() -> SelfImprovementCoordinator:
    return await get_self_improvement_coordinator()


async def get_workflow() -> WorkflowAutomationCoordinator:
    return await get_workflow_automation_coordinator()


async def get_multitenancy() -> MultiTenantCoordinator:
    return await get_multitenancy_coordinator()


async def get_enterprise() -> EnterpriseCoordinator:
    return await get_enterprise_coordinator()


def get_tenant_id(x_tenant_id: Optional[str] = Header(None)) -> str:
    """Get tenant ID from header or default."""
    return x_tenant_id or "default"


def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """Get user ID from header or default."""
    return x_user_id or "anonymous"


# ============================================================================
# Self-Improvement Endpoints
# ============================================================================

@router.post("/self-improvement/metrics")
async def record_metric(
    request: MetricRecordRequest,
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Record a performance metric."""
    try:
        metric_type = MetricType(request.metric_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid metric type: {request.metric_type}")

    await coordinator.performance_monitor.record_metric(
        metric_type=metric_type,
        value=request.value,
        agent_id=request.agent_id,
        tool_id=request.tool_id,
        context=request.context
    )

    return {"status": "recorded", "metric_type": request.metric_type}


@router.get("/self-improvement/health")
async def get_health_report(
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get system health report."""
    return await coordinator.get_health_report()


@router.get("/self-improvement/suggestions")
async def get_improvement_suggestions(
    agent_id: Optional[str] = Query(None),
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get improvement suggestions."""
    suggestions = await coordinator.get_improvement_suggestions(agent_id)
    return {"suggestions": suggestions}


@router.get("/self-improvement/agent/{agent_id}/performance")
async def get_agent_performance(
    agent_id: str,
    hours: int = Query(24, ge=1, le=168),
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get performance metrics for an agent."""
    return await coordinator.performance_monitor.get_agent_performance(agent_id, hours)


@router.get("/self-improvement/tool/{tool_id}/performance")
async def get_tool_performance(
    tool_id: str,
    hours: int = Query(24, ge=1, le=168),
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get performance metrics for a tool."""
    return await coordinator.performance_monitor.get_tool_performance(tool_id, hours)


@router.get("/self-improvement/alerts")
async def get_performance_alerts(
    hours: int = Query(24, ge=1, le=168),
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get recent performance alerts."""
    alerts = coordinator.performance_monitor.get_recent_alerts(hours)
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/self-improvement/errors/patterns")
async def get_error_patterns(
    min_frequency: int = Query(1, ge=1),
    agent_id: Optional[str] = None,
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get detected error patterns."""
    patterns = coordinator.error_learner.get_patterns(min_frequency, agent_id)
    return {
        "patterns": [
            {
                "pattern_id": p.pattern_id,
                "error_type": p.error_type,
                "message_pattern": p.message_pattern,
                "frequency": p.frequency,
                "suggested_fix": p.suggested_fix,
                "auto_fixable": p.auto_fixable
            }
            for p in patterns
        ]
    }


@router.get("/self-improvement/errors/trends")
async def get_error_trends(
    hours: int = Query(24, ge=1, le=168),
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get error trends."""
    return coordinator.error_learner.get_error_trends(hours)


@router.get("/self-improvement/tools/rankings")
async def get_tool_rankings(
    coordinator: SelfImprovementCoordinator = Depends(get_self_improvement)
):
    """Get tool performance rankings."""
    return coordinator.tool_optimizer.get_tool_rankings()


# ============================================================================
# Workflow Automation Endpoints
# ============================================================================

@router.post("/workflows/recording/start")
async def start_recording(
    session_id: str = Query(...),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Start recording actions for workflow creation."""
    return await coordinator.recorder.start_recording(session_id)


@router.post("/workflows/recording/stop")
async def stop_recording(
    session_id: str = Query(...),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Stop recording and get recorded actions."""
    return await coordinator.recorder.stop_recording(session_id)


@router.post("/workflows/recording/action")
async def record_action(
    session_id: str = Query(...),
    action_type: str = Query(...),
    agent_id: Optional[str] = None,
    tool_id: Optional[str] = None,
    input_data: Optional[Dict[str, Any]] = None,
    output_data: Optional[Dict[str, Any]] = None,
    success: bool = True,
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Record a single action."""
    action = await coordinator.record_action(
        session_id=session_id,
        action_type=action_type,
        agent_id=agent_id,
        tool_id=tool_id,
        input_data=input_data,
        output_data=output_data,
        success=success
    )
    return {"recorded": action is not None}


@router.post("/workflows/from-recording")
async def create_workflow_from_recording(
    session_id: str = Query(...),
    name: str = Query(...),
    description: str = "",
    user_id: str = Depends(get_user_id),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Create a workflow from recorded actions."""
    workflow = await coordinator.create_workflow_from_recording(
        session_id=session_id,
        name=name,
        description=description,
        owner_id=user_id
    )

    if not workflow:
        raise HTTPException(status_code=400, detail="No recorded actions found")

    return {
        "workflow_id": workflow.workflow_id,
        "name": workflow.name,
        "steps_count": len(workflow.steps)
    }


@router.get("/workflows")
async def list_workflows(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """List workflows."""
    status_enum = WorkflowStatus(status) if status else None
    workflows = await coordinator.workflow_engine.list_workflows(status=status_enum)

    return {
        "workflows": [
            {
                "workflow_id": w.workflow_id,
                "name": w.name,
                "status": w.status.value,
                "steps_count": len(w.steps),
                "created_at": w.created_at.isoformat()
            }
            for w in workflows[:limit]
        ]
    }


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Get workflow details."""
    workflow = await coordinator.workflow_engine.get_workflow(workflow_id)

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {
        "workflow_id": workflow.workflow_id,
        "name": workflow.name,
        "description": workflow.description,
        "status": workflow.status.value,
        "steps": [
            {
                "step_id": s.step_id,
                "step_type": s.step_type.value,
                "name": s.name,
                "config": s.config
            }
            for s in workflow.steps
        ],
        "triggers": [
            {
                "trigger_id": t.trigger_id,
                "trigger_type": t.trigger_type.value,
                "name": t.name
            }
            for t in workflow.triggers
        ],
        "created_at": workflow.created_at.isoformat()
    }


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    context: Optional[Dict[str, Any]] = None,
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Execute a workflow."""
    try:
        execution = await coordinator.execute_workflow(workflow_id, context)
        return {
            "execution_id": execution.execution_id,
            "status": execution.status,
            "started_at": execution.started_at.isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/workflows/executions")
async def list_executions(
    workflow_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """List workflow executions."""
    executions = await coordinator.workflow_engine.list_executions(
        workflow_id=workflow_id,
        status=status,
        limit=limit
    )

    return {
        "executions": [
            {
                "execution_id": e.execution_id,
                "workflow_id": e.workflow_id,
                "status": e.status,
                "started_at": e.started_at.isoformat(),
                "completed_at": e.completed_at.isoformat() if e.completed_at else None
            }
            for e in executions
        ]
    }


@router.get("/workflows/suggestions")
async def get_automation_suggestions(
    session_id: str = Query(...),
    user_id: str = Depends(get_user_id),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Get automation suggestions based on recorded actions."""
    suggestions = await coordinator.get_suggestions(user_id, session_id)
    return {"suggestions": suggestions}


@router.get("/workflows/patterns")
async def get_detected_patterns(
    min_frequency: int = Query(2, ge=1),
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Get detected action patterns."""
    patterns = coordinator.pattern_recognizer.get_patterns(min_frequency)
    return {
        "patterns": [
            {
                "pattern_id": p.pattern_id,
                "name": p.name,
                "description": p.description,
                "frequency": p.frequency,
                "confidence": p.confidence,
                "actions": p.actions
            }
            for p in patterns
        ]
    }


@router.get("/workflows/dashboard")
async def get_workflow_dashboard(
    coordinator: WorkflowAutomationCoordinator = Depends(get_workflow)
):
    """Get workflow automation dashboard data."""
    return await coordinator.get_dashboard_data()


# ============================================================================
# Multi-Tenancy Endpoints
# ============================================================================

@router.post("/tenants")
async def create_tenant(
    request: TenantCreateRequest,
    user_id: str = Depends(get_user_id),
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Create a new tenant."""
    try:
        tier = TenantTier(request.tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {request.tier}")

    try:
        tenant = await coordinator.create_tenant(
            name=request.name,
            slug=request.slug,
            owner_user_id=user_id,
            tier=tier,
            branding=request.branding
        )
        return {
            "tenant_id": tenant.tenant_id,
            "name": tenant.name,
            "slug": tenant.slug,
            "tier": tenant.tier.value
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tenants")
async def list_tenants(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """List tenants."""
    from core.multitenancy import TenantStatus

    status_enum = TenantStatus(status) if status else None
    tier_enum = TenantTier(tier) if tier else None

    tenants = await coordinator.registry.list_tenants(
        status=status_enum,
        tier=tier_enum,
        limit=limit
    )

    return {
        "tenants": [
            {
                "tenant_id": t.tenant_id,
                "name": t.name,
                "slug": t.slug,
                "tier": t.tier.value,
                "status": t.status.value
            }
            for t in tenants
        ]
    }


@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Get tenant details."""
    tenant = await coordinator.registry.get_tenant(tenant_id)

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": tenant.tenant_id,
        "name": tenant.name,
        "slug": tenant.slug,
        "tier": tenant.tier.value,
        "status": tenant.status.value,
        "branding": {
            "primary_color": tenant.branding.primary_color,
            "company_name": tenant.branding.company_name,
            "logo_url": tenant.branding.logo_url
        },
        "created_at": tenant.created_at.isoformat()
    }


@router.get("/tenants/{tenant_id}/dashboard")
async def get_tenant_dashboard(
    tenant_id: str,
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Get tenant dashboard data."""
    return await coordinator.get_tenant_dashboard(tenant_id)


@router.post("/tenants/{tenant_id}/users")
async def add_user_to_tenant(
    tenant_id: str,
    request: TenantUserRequest,
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Add a user to a tenant."""
    tenant_user = await coordinator.add_user_to_tenant(
        tenant_id=tenant_id,
        user_id=request.user_id,
        role=request.role,
        permissions=request.permissions
    )

    return {
        "user_id": tenant_user.user_id,
        "tenant_id": tenant_user.tenant_id,
        "role": tenant_user.role
    }


@router.get("/tenants/{tenant_id}/usage")
async def get_tenant_usage(
    tenant_id: str,
    period: str = Query("monthly", regex="^(daily|monthly|lifetime)$"),
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Get tenant usage summary."""
    return await coordinator.usage_tracker.get_usage_summary(tenant_id, period)


@router.get("/tenants/{tenant_id}/billing")
async def get_tenant_billing(
    tenant_id: str,
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Get tenant billing information."""
    tenant = await coordinator.registry.get_tenant(tenant_id)

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    estimate = await coordinator.billing_manager.get_current_bill_estimate(tenant)
    history = await coordinator.billing_manager.get_billing_history(tenant_id)

    return {
        "current_estimate": estimate,
        "history": [
            {
                "record_id": r.record_id,
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "total_amount": r.total_amount,
                "status": r.status
            }
            for r in history
        ]
    }


@router.post("/tenants/{tenant_id}/upgrade")
async def upgrade_tenant(
    tenant_id: str,
    new_tier: str = Query(...),
    coordinator: MultiTenantCoordinator = Depends(get_multitenancy)
):
    """Upgrade tenant tier."""
    try:
        tier = TenantTier(new_tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier}")

    tenant = await coordinator.registry.upgrade_tier(tenant_id, tier)

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": tenant.tenant_id,
        "tier": tenant.tier.value,
        "message": f"Upgraded to {tier.value}"
    }


# ============================================================================
# Enterprise Feature Endpoints
# ============================================================================

# SSO Endpoints
@router.post("/enterprise/{tenant_id}/sso/configure")
async def configure_sso(
    tenant_id: str,
    request: SSOConfigRequest,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Configure SSO for a tenant."""
    try:
        provider = SSOProvider(request.provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid SSO provider: {request.provider}")

    config = await coordinator.sso_manager.configure_sso(
        tenant_id=tenant_id,
        provider=provider,
        client_id=request.client_id,
        client_secret=request.client_secret,
        issuer_url=request.issuer_url,
        redirect_uri=request.redirect_uri,
        scopes=request.scopes,
        metadata=request.metadata
    )

    return {
        "provider": config.provider.value,
        "enabled": config.enabled,
        "issuer_url": config.issuer_url
    }


@router.get("/enterprise/{tenant_id}/sso/login")
async def initiate_sso_login(
    tenant_id: str,
    provider: Optional[str] = None,
    redirect_after: Optional[str] = None,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Initiate SSO login flow."""
    provider_enum = SSOProvider(provider) if provider else None

    result = await coordinator.sso_manager.initiate_sso_login(
        tenant_id=tenant_id,
        provider=provider_enum,
        redirect_after=redirect_after
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/enterprise/sso/callback")
async def sso_callback(
    session_id: str = Query(...),
    code: str = Query(...),
    state: str = Query(...),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Handle SSO callback."""
    result = await coordinator.sso_manager.complete_sso_login(session_id, code, state)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# RBAC Endpoints
@router.post("/enterprise/{tenant_id}/roles")
async def create_role(
    tenant_id: str,
    request: RoleCreateRequest,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Create a custom role."""
    role = await coordinator.rbac_manager.create_role(
        name=request.name,
        description=request.description,
        permissions=request.permissions,
        tenant_id=tenant_id
    )

    return {
        "role_id": role.role_id,
        "name": role.name,
        "permissions_count": len(role.permissions)
    }


@router.get("/enterprise/{tenant_id}/roles")
async def list_roles(
    tenant_id: str,
    include_system: bool = Query(True),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """List available roles."""
    roles = await coordinator.rbac_manager.list_roles(tenant_id, include_system)

    return {
        "roles": [
            {
                "role_id": r.role_id,
                "name": r.name,
                "description": r.description,
                "is_system": r.is_system,
                "permissions_count": len(r.permissions)
            }
            for r in roles
        ]
    }


@router.post("/enterprise/{tenant_id}/roles/assign")
async def assign_role(
    tenant_id: str,
    request: RoleAssignRequest,
    assigned_by: str = Depends(get_user_id),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Assign a role to a user."""
    expires_at = None
    if request.expires_at:
        expires_at = datetime.fromisoformat(request.expires_at)

    assignment = await coordinator.rbac_manager.assign_role(
        user_id=request.user_id,
        role_id=request.role_id,
        tenant_id=tenant_id,
        assigned_by=assigned_by,
        expires_at=expires_at,
        scope=request.scope
    )

    return {
        "assignment_id": assignment.assignment_id,
        "user_id": assignment.user_id,
        "role_id": assignment.role_id
    }


@router.get("/enterprise/{tenant_id}/users/{user_id}/permissions")
async def get_user_permissions(
    tenant_id: str,
    user_id: str,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Get effective permissions for a user."""
    permissions = await coordinator.rbac_manager.get_effective_permissions(user_id, tenant_id)
    return {"user_id": user_id, "permissions": permissions}


@router.get("/enterprise/{tenant_id}/authorize")
async def check_authorization(
    tenant_id: str,
    resource: str = Query(...),
    action: str = Query(...),
    user_id: str = Depends(get_user_id),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Check if a user is authorized for an action."""
    try:
        resource_enum = ResourceCategory(resource)
        action_enum = PermissionAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resource or action")

    result = await coordinator.authorize_action(
        user_id=user_id,
        tenant_id=tenant_id,
        resource=resource_enum,
        action=action_enum
    )

    return result


# Audit Endpoints
@router.get("/enterprise/{tenant_id}/audit/events")
async def get_audit_events(
    tenant_id: str,
    event_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    min_risk_score: Optional[float] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Query audit events."""
    event_types = None
    if event_type:
        try:
            event_types = [AuditEventType(event_type)]
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid event type: {event_type}")

    start = datetime.fromisoformat(start_time) if start_time else None
    end = datetime.fromisoformat(end_time) if end_time else None

    events = await coordinator.audit_manager.query_events(
        tenant_id=tenant_id,
        event_types=event_types,
        actor_id=actor_id,
        start_time=start,
        end_time=end,
        min_risk_score=min_risk_score,
        limit=limit,
        offset=offset
    )

    return {
        "events": [
            {
                "event_id": e.event_id,
                "event_type": e.event_type.value,
                "timestamp": e.timestamp.isoformat(),
                "actor_id": e.actor_id,
                "actor_type": e.actor_type,
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "action": e.action,
                "outcome": e.outcome,
                "risk_score": e.risk_score
            }
            for e in events
        ],
        "count": len(events)
    }


@router.get("/enterprise/{tenant_id}/audit/summary")
async def get_audit_summary(
    tenant_id: str,
    days: int = Query(30, ge=1, le=365),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Get audit activity summary."""
    return await coordinator.audit_manager.get_activity_summary(tenant_id, days)


@router.get("/enterprise/{tenant_id}/audit/export")
async def export_audit_log(
    tenant_id: str,
    start_time: str = Query(...),
    end_time: str = Query(...),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Export audit log for compliance."""
    start = datetime.fromisoformat(start_time)
    end = datetime.fromisoformat(end_time)

    return await coordinator.audit_manager.export_audit_log(tenant_id, start, end)


# Data Residency Endpoints
@router.post("/enterprise/{tenant_id}/data-residency/configure")
async def configure_data_residency(
    tenant_id: str,
    request: DataResidencyRequest,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Configure data residency for a tenant."""
    try:
        primary = DataRegion(request.primary_region)
        allowed = [DataRegion(r) for r in request.allowed_regions]
        frameworks = [ComplianceFramework(f) for f in (request.compliance_frameworks or [])]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    config = await coordinator.data_residency_manager.configure_residency(
        tenant_id=tenant_id,
        primary_region=primary,
        allowed_regions=allowed,
        compliance_frameworks=frameworks,
        data_retention_days=request.data_retention_days,
        encryption_required=request.encryption_required
    )

    return {
        "tenant_id": config.tenant_id,
        "primary_region": config.primary_region.value,
        "allowed_regions": [r.value for r in config.allowed_regions]
    }


@router.get("/enterprise/{tenant_id}/data-residency")
async def get_data_residency(
    tenant_id: str,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Get data residency configuration."""
    config = await coordinator.data_residency_manager.get_residency_config(tenant_id)

    if not config:
        return {"configured": False}

    return {
        "configured": True,
        "primary_region": config.primary_region.value,
        "allowed_regions": [r.value for r in config.allowed_regions],
        "compliance_frameworks": [f.value for f in config.compliance_frameworks],
        "data_retention_days": config.data_retention_days,
        "encryption_required": config.encryption_required
    }


@router.post("/enterprise/{tenant_id}/compliance/report")
async def generate_compliance_report(
    tenant_id: str,
    framework: str = Query(...),
    start_time: str = Query(...),
    end_time: str = Query(...),
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Generate a compliance report."""
    try:
        framework_enum = ComplianceFramework(framework)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid framework: {framework}")

    start = datetime.fromisoformat(start_time)
    end = datetime.fromisoformat(end_time)

    report = await coordinator.data_residency_manager.generate_compliance_report(
        tenant_id=tenant_id,
        framework=framework_enum,
        period_start=start,
        period_end=end
    )

    return {
        "report_id": report.report_id,
        "framework": report.framework.value,
        "status": report.status,
        "findings_count": len(report.findings),
        "recommendations": report.recommendations,
        "generated_at": report.generated_at.isoformat()
    }


# Dashboard Endpoint
@router.get("/enterprise/{tenant_id}/dashboard")
async def get_enterprise_dashboard(
    tenant_id: str,
    coordinator: EnterpriseCoordinator = Depends(get_enterprise)
):
    """Get enterprise features dashboard."""
    return await coordinator.get_enterprise_dashboard(tenant_id)
