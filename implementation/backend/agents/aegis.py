"""
KOSMOS V2.0 AEGIS Agent - Security & Compliance (LangGraph Enhanced)

AEGIS (Automated Enterprise Guardian for Information Security) handles
all security-related operations including authentication, authorization,
threat detection, and security policy enforcement.
"""

from typing import Any, Dict, List, Optional
from enum import Enum
from datetime import datetime

import structlog
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    require_approval,
)
from core.config import settings
from core.tool_registry import ToolCategory

logger = structlog.get_logger()


class ThreatLevel(str, Enum):
    """Threat severity levels."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityAction(str, Enum):
    """Types of security actions."""
    AUDIT = "audit"
    VERIFY = "verify"
    SCAN = "scan"
    VETO = "veto"
    APPROVE = "approve"
    ALLOW = "allow"
    DENY = "deny"
    QUARANTINE = "quarantine"
    ESCALATE = "escalate"


class AEGISState(AgentGraphState):
    """State for AEGIS security workflow."""
    # Security context
    action_type: SecurityAction = SecurityAction.VERIFY
    threat_level: ThreatLevel = ThreatLevel.NONE

    # Request context
    resource: str = ""
    action: str = ""
    request_type: str = ""

    # Analysis results
    security_findings: List[Dict[str, Any]] = Field(default_factory=list)
    vulnerabilities: List[Dict[str, Any]] = Field(default_factory=list)
    permissions_checked: List[str] = Field(default_factory=list)
    threat_indicators: List[str] = Field(default_factory=list)

    # Veto decision
    should_veto: bool = False
    veto_reason: Optional[str] = None
    veto_risks: List[str] = Field(default_factory=list)

    # Decision
    security_decision: SecurityAction = SecurityAction.DENY

    # Audit trail
    audit_log: List[Dict[str, Any]] = Field(default_factory=list)


class AEGISAgent(LangGraphAgent[AEGISState]):
    """
    AEGIS - Security & Compliance Agent (LangGraph Enhanced)

    Capabilities:
    - Threat detection and analysis using STRIDE model
    - Permission and access verification (RBAC/ABAC)
    - Security veto for Pentarchy governance
    - Vulnerability scanning
    - Compliance audit logging
    - Security policy enforcement
    """

    # STRIDE threat categories
    STRIDE_THREATS = {
        "spoofing": ["invalid_token", "session_hijack", "impersonation"],
        "tampering": ["data_modification", "parameter_manipulation"],
        "repudiation": ["missing_audit", "log_tampering"],
        "information_disclosure": ["data_leak", "verbose_errors"],
        "denial_of_service": ["rate_limit_exceeded", "resource_exhaustion"],
        "elevation_of_privilege": ["role_escalation", "permission_bypass"],
    }

    # Security keywords
    SECURITY_KEYWORDS = {
        "high": ["delete", "drop", "truncate", "production", "admin", "root", "sudo", "rm -rf"],
        "medium": ["update", "insert", "modify", "change", "permission", "access", "grant"],
        "low": ["read", "select", "query", "view", "list", "get"]
    }

    def __init__(self):
        super().__init__(
            agent_id="aegis",
            name="AEGIS",
            domain="security",
            description="Security operations, threat detection, and compliance",
            tool_categories=[
                ToolCategory.SECURITY,
                ToolCategory.SYSTEM,
            ],
            mcp_servers=[
                "mcp-vault",
                "mcp-trivy",
                "mcp-opa",
            ],
            pentarchy_voter=False,
            security_veto=True,  # AEGIS has veto power
            max_iterations=10,
            timeout_seconds=60,
        )

    def create_state_class(self) -> type:
        return AEGISState

    async def _build_workflow(self) -> Any:
        workflow = StateGraph(AEGISState)

        workflow.add_node("analyze_request", self._analyze_security_request)
        workflow.add_node("authenticate", self._authenticate)
        workflow.add_node("authorize", self._authorize)
        workflow.add_node("threat_assessment", self._threat_assessment)
        workflow.add_node("vulnerability_scan", self._vulnerability_scan)
        workflow.add_node("make_decision", self._make_security_decision)
        workflow.add_node("log_audit", self._log_audit)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("handle_error", self._handle_error_node)

        workflow.set_entry_point("analyze_request")

        workflow.add_edge("analyze_request", "authenticate")
        workflow.add_edge("authenticate", "authorize")
        workflow.add_edge("authorize", "threat_assessment")

        workflow.add_conditional_edges(
            "threat_assessment",
            lambda s: "scan" if s.action_type == SecurityAction.SCAN else "decide",
            {"scan": "vulnerability_scan", "decide": "make_decision"}
        )

        workflow.add_edge("vulnerability_scan", "make_decision")
        workflow.add_edge("make_decision", "log_audit")
        workflow.add_edge("log_audit", "synthesize")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("handle_error", END)

        return workflow.compile(checkpointer=self._checkpointer)

    async def _analyze_security_request(self, state: AEGISState) -> Dict[str, Any]:
        """Analyze the security request type."""
        self.logger.info("Analyzing security request...")

        task = state.current_task or ""
        task_lower = task.lower()

        # Determine action type
        if any(kw in task_lower for kw in ["audit", "log", "trail", "history"]):
            action = SecurityAction.AUDIT
        elif any(kw in task_lower for kw in ["scan", "vulnerability", "security check", "pentest"]):
            action = SecurityAction.SCAN
        elif any(kw in task_lower for kw in ["veto", "block", "deny", "reject"]):
            action = SecurityAction.VETO
        elif any(kw in task_lower for kw in ["approve", "allow", "permit", "grant"]):
            action = SecurityAction.APPROVE
        else:
            action = SecurityAction.VERIFY

        await self._emit_progress(state, "Request analyzed", 0.1)

        return {"action_type": action}

    async def _authenticate(self, state: AEGISState) -> Dict[str, Any]:
        """Authenticate the request."""
        self.logger.info("Authenticating request...")

        indicators = list(state.threat_indicators)

        if not state.user_id:
            indicators.append("anonymous_request")

        if not state.session_id:
            indicators.append("no_session")

        await self._emit_progress(state, "Authentication complete", 0.25)

        return {"threat_indicators": indicators}

    async def _authorize(self, state: AEGISState) -> Dict[str, Any]:
        """Authorize the request based on RBAC/ABAC."""
        self.logger.info("Authorizing request...")

        permissions_checked = []
        indicators = list(state.threat_indicators)

        if state.user_id:
            permissions_checked.append(f"user:{state.user_id}")
        if state.tenant_id:
            permissions_checked.append(f"tenant:{state.tenant_id}")

        # In production would use OPA/Zitadel for actual authorization
        # result = await self._execute_mcp_tool("mcp-opa.evaluate", {...})

        await self._emit_progress(state, "Authorization complete", 0.4)

        return {
            "permissions_checked": permissions_checked,
            "threat_indicators": indicators
        }

    async def _threat_assessment(self, state: AEGISState) -> Dict[str, Any]:
        """Assess threat level of the request using STRIDE model."""
        self.logger.info("Assessing threat level...")

        task = state.current_task or ""
        task_lower = task.lower()

        threat_level = ThreatLevel.NONE
        findings = []
        indicators = list(state.threat_indicators)

        # Check security keywords
        for level, keywords in self.SECURITY_KEYWORDS.items():
            for kw in keywords:
                if kw in task_lower:
                    findings.append({
                        "keyword": kw,
                        "level": level,
                        "context": task[:100]
                    })
                    indicators.append(f"keyword:{kw}")

                    if level == "high" and threat_level.value in ["none", "low", "medium"]:
                        threat_level = ThreatLevel.HIGH
                    elif level == "medium" and threat_level.value in ["none", "low"]:
                        threat_level = ThreatLevel.MEDIUM
                    elif level == "low" and threat_level.value == "none":
                        threat_level = ThreatLevel.LOW

        # Check for critical patterns
        critical_patterns = [
            "drop database", "rm -rf /", "delete all", "production credentials",
            "bypass security", "disable auth", "root access"
        ]

        for pattern in critical_patterns:
            if pattern in task_lower:
                threat_level = ThreatLevel.CRITICAL
                findings.append({
                    "pattern": pattern,
                    "level": "critical",
                    "action": "veto_recommended"
                })
                indicators.append(f"critical_pattern:{pattern}")

        # Check STRIDE threats
        for category, threat_indicators in self.STRIDE_THREATS.items():
            for indicator in threat_indicators:
                if indicator in indicators:
                    findings.append({
                        "stride_category": category,
                        "indicator": indicator,
                        "severity": "high"
                    })

        await self._emit_progress(state, f"Threat level: {threat_level.value}", 0.6)

        return {
            "threat_level": threat_level,
            "security_findings": findings,
            "threat_indicators": indicators
        }

    async def _vulnerability_scan(self, state: AEGISState) -> Dict[str, Any]:
        """Scan for vulnerabilities if requested."""
        self.logger.info("Running vulnerability scan...")

        vulnerabilities = []

        # Would use Trivy MCP server for actual scanning
        # result = await self._execute_mcp_tool("mcp-trivy.scan", {...})

        await self._emit_progress(state, "Scan complete", 0.75)

        return {"vulnerabilities": vulnerabilities}

    async def _make_security_decision(self, state: AEGISState) -> Dict[str, Any]:
        """Make security decision - veto or approve."""
        self.logger.info("Making security decision...")

        should_veto = False
        veto_reason = None
        veto_risks = []
        decision = SecurityAction.ALLOW

        # Veto if critical threat level
        if state.threat_level == ThreatLevel.CRITICAL:
            should_veto = True
            decision = SecurityAction.DENY
            veto_reason = "Critical security threat detected"
            veto_risks = [f.get("keyword", f.get("pattern", "unknown"))
                         for f in state.security_findings]

        # Veto if high threat and no explicit approval
        elif state.threat_level == ThreatLevel.HIGH:
            if state.action_type != SecurityAction.APPROVE:
                should_veto = True
                decision = SecurityAction.ESCALATE
                veto_reason = "High-risk operation requires explicit approval"
                veto_risks = [f.get("keyword") for f in state.security_findings
                             if f.get("level") == "high"]

        # Veto if critical vulnerabilities found
        elif state.vulnerabilities:
            critical_vulns = [v for v in state.vulnerabilities
                             if v.get("severity") == "critical"]
            if critical_vulns:
                should_veto = True
                decision = SecurityAction.DENY
                veto_reason = f"Critical vulnerabilities detected: {len(critical_vulns)}"
                veto_risks = [v.get("id", "unknown") for v in critical_vulns]

        # Medium threat - audit only
        elif state.threat_level == ThreatLevel.MEDIUM:
            decision = SecurityAction.AUDIT

        return {
            "should_veto": should_veto,
            "veto_reason": veto_reason,
            "veto_risks": veto_risks,
            "security_decision": decision
        }

    async def _log_audit(self, state: AEGISState) -> Dict[str, Any]:
        """Log the security audit trail."""
        self.logger.info("Logging audit trail...")

        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": state.session_id,
            "action_type": state.action_type.value,
            "threat_level": state.threat_level.value,
            "findings_count": len(state.security_findings),
            "decision": state.security_decision.value,
            "veto": state.should_veto,
            "veto_reason": state.veto_reason,
            "user_id": state.user_id,
            "tenant_id": state.tenant_id,
            "indicators": state.threat_indicators
        }

        await self._emit_progress(state, "Audit logged", 0.9)

        return {"audit_log": [audit_entry]}

    async def _synthesize_node(self, state: AEGISState) -> Dict[str, Any]:
        """Synthesize security analysis response."""
        self.logger.info("Synthesizing response...")

        state.phase = WorkflowPhase.COMPLETED

        # Build response
        if state.should_veto:
            response = f"## Security Veto\n\n**Reason**: {state.veto_reason}\n\n"
            response += "### Risks Identified\n"
            response += "\n".join(f"- {risk}" for risk in state.veto_risks)
        else:
            response = f"## Security Analysis Complete\n\n"
            response += f"**Threat Level**: {state.threat_level.value.upper()}\n"
            response += f"**Decision**: {state.security_decision.value.upper()}\n"
            if state.security_findings:
                response += f"\n**Findings**: {len(state.security_findings)}"

        # Generate SDUI components
        components = [
            {
                "type": "metric",
                "props": {
                    "label": "Threat Level",
                    "value": state.threat_level.value.upper(),
                    "trend": "down" if state.threat_level == ThreatLevel.NONE else "up",
                    "trendLabel": "Security status"
                }
            }
        ]

        if state.security_findings:
            components.append({
                "type": "data_table",
                "props": {
                    "title": "Security Findings",
                    "data": state.security_findings
                }
            })

        if state.should_veto:
            components.append({
                "type": "alert",
                "props": {
                    "variant": "error",
                    "title": "Security Veto",
                    "message": state.veto_reason
                }
            })
        elif state.security_decision == SecurityAction.ALLOW:
            components.append({
                "type": "alert",
                "props": {
                    "variant": "success",
                    "title": "Security Approved",
                    "message": "Request passed security checks"
                }
            })

        await self._emit_progress(state, "Complete", 1.0)

        return {
            "final_response": response,
            "final_result": {
                "threat_level": state.threat_level.value,
                "decision": state.security_decision.value,
                "should_veto": state.should_veto,
                "veto_reason": state.veto_reason,
                "findings": state.security_findings,
                "audit": state.audit_log
            },
            "ui_components": components,
            "suggested_layout": "dashboard",
            "phase": state.phase
        }

    # =========================================================================
    # Security Veto API (for Pentarchy)
    # =========================================================================

    async def evaluate_for_veto(
        self,
        proposal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate a proposal for security veto.

        Called by Pentarchy governance system.
        AEGIS can veto any proposal that poses security risks.
        """
        result = await self.process(
            task=str(proposal.get("task", proposal)),
            context={"proposal": proposal}
        )

        final_result = result.get("final_result", {})

        return {
            "veto": final_result.get("should_veto", False),
            "reason": final_result.get("veto_reason"),
            "risks": [f.get("keyword", f.get("pattern", "unknown"))
                     for f in final_result.get("findings", [])],
            "threat_level": final_result.get("threat_level", "none")
        }

    async def security_veto(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """Alias for evaluate_for_veto for backward compatibility."""
        return await self.evaluate_for_veto(proposal)


# Factory
_aegis_instance: Optional[AEGISAgent] = None


async def get_aegis() -> AEGISAgent:
    global _aegis_instance
    if _aegis_instance is None:
        _aegis_instance = AEGISAgent()
        await _aegis_instance.initialize()
    return _aegis_instance


async def close_aegis() -> None:
    global _aegis_instance
    if _aegis_instance:
        await _aegis_instance.shutdown()
        _aegis_instance = None
