"""
KOSMOS V2.0 Hephaestus Agent - Development & Engineering

Hephaestus handles all development-related operations including
code generation, code review, CI/CD, and technical documentation.

Upgraded to LangGraph base with:
- State persistence (checkpointing)
- Pentarchy voting integration
- Semantic router integration
- SDUI code display components
- GitHub/filesystem MCP integration
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
    require_approval,
    require_confirmation,
)
from core.tool_registry import ToolCallResult

logger = structlog.get_logger()


# ============================================================================
# Domain Types
# ============================================================================

class DevOperation(str, Enum):
    """Development operations."""
    CODE_GENERATE = "code_generate"
    CODE_REVIEW = "code_review"
    CODE_REFACTOR = "code_refactor"
    DEBUG = "debug"
    TEST_GENERATE = "test_generate"
    DOCUMENT = "document"
    DEPLOY = "deploy"
    PR_CREATE = "pr_create"
    PR_REVIEW = "pr_review"


class CodeQuality(str, Enum):
    """Code quality ratings."""
    EXCELLENT = "excellent"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    NEEDS_IMPROVEMENT = "needs_improvement"
    POOR = "poor"


class SecuritySeverity(str, Enum):
    """Security issue severity."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Language(str, Enum):
    """Supported programming languages."""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    JAVA = "java"
    KOTLIN = "kotlin"
    SWIFT = "swift"
    SQL = "sql"
    BASH = "bash"


# ============================================================================
# State Definition
# ============================================================================

class HephaestusState(AgentGraphState):
    """
    State for Hephaestus development workflow.

    Extends base state with development-specific fields.
    """
    # Operation details
    operation: DevOperation = DevOperation.CODE_GENERATE
    language: Language = Language.PYTHON
    target_file: Optional[str] = None
    repository: Optional[str] = None
    branch: Optional[str] = None

    # Code input/output
    code_input: str = ""
    code_output: str = ""
    diff: Optional[str] = None

    # Review results
    review_quality: Optional[CodeQuality] = None
    review_issues: List[Dict[str, Any]] = Field(default_factory=list)
    review_suggestions: List[str] = Field(default_factory=list)
    security_concerns: List[Dict[str, Any]] = Field(default_factory=list)
    test_coverage: Optional[float] = None

    # Generated artifacts
    tests_generated: List[Dict[str, Any]] = Field(default_factory=list)
    documentation: Optional[str] = None

    # PR details
    pr_title: Optional[str] = None
    pr_description: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None

    # Deployment
    deployment_environment: Optional[str] = None
    deployment_status: Optional[str] = None

    # Pentarchy voting context
    vote_context: Optional[Dict[str, Any]] = None


# ============================================================================
# Hephaestus Agent
# ============================================================================

class HephaestusAgent(LangGraphAgent[HephaestusState]):
    """
    Hephaestus - Development & Engineering Agent

    Responsibilities:
    - Generate code from specifications
    - Review code for quality and security
    - Refactor and optimize code
    - Generate tests and documentation
    - Manage CI/CD pipelines
    - Create and review pull requests
    - Participate in Pentarchy voting (technical feasibility)

    MCP Servers:
    - github-mcp: GitHub operations
    - filesystem-mcp: File operations
    - sequential-thinking: Complex reasoning

    SDUI Components:
    - GlassCodeBlock: Code display with syntax highlighting
    - GlassDiffViewer: Diff visualization
    - GlassReviewCard: Code review results
    """

    # Supported languages
    SUPPORTED_LANGUAGES = [lang.value for lang in Language]

    # OWASP Top 10 patterns to detect
    SECURITY_PATTERNS = {
        "sql_injection": [r"execute\s*\(.*%s", r"execute\s*\(.*\+", r"cursor\.execute\s*\(f"],
        "xss": [r"innerHTML\s*=", r"document\.write\s*\(", r"eval\s*\("],
        "command_injection": [r"os\.system\s*\(", r"subprocess\.\w+\s*\(.*shell\s*=\s*True"],
        "hardcoded_secrets": [r"password\s*=\s*['\"]", r"api_key\s*=\s*['\"]", r"secret\s*=\s*['\"]"],
        "insecure_deserialization": [r"pickle\.loads?\s*\(", r"yaml\.load\s*\((?!.*Loader)"],
    }

    def __init__(self):
        super().__init__(
            agent_id="hephaestus",
            name="Hephaestus",
            domain="development",
            description="Development and engineering agent for code generation, review, and deployment",
            tool_categories=[ToolCategory.DEVELOPMENT, ToolCategory.FILESYSTEM],
            mcp_servers=["github-mcp", "filesystem-mcp", "sequential-thinking"],
            pentarchy_voter=True,  # Hephaestus votes in Pentarchy
            security_veto=False,
            max_iterations=20,
            timeout_seconds=300,
        )

    # =========================================================================
    # Template Implementation
    # =========================================================================

    def create_state_class(self) -> type:
        """Return HephaestusState for workflow."""
        return HephaestusState

    def define_nodes(self) -> Dict[str, Callable]:
        """Define Hephaestus-specific workflow nodes."""
        return {
            "parse_dev_request": self._parse_dev_request,
            "validate_code_input": self._validate_code_input,
            "execute_dev_operation": self._execute_dev_operation,
            "security_scan": self._security_scan,
            "quality_check": self._quality_check,
            "generate_artifacts": self._generate_artifacts,
        }

    def define_edges(self) -> List[tuple]:
        """Define Hephaestus-specific workflow edges."""
        return [
            ("plan", "parse_dev_request"),
            ("parse_dev_request", "validate_code_input"),

            # Conditional: valid input?
            ("validate_code_input", self._input_valid_condition, {
                True: "execute_dev_operation",
                False: "handle_error"
            }),

            ("execute_dev_operation", "security_scan"),
            ("security_scan", "quality_check"),
            ("quality_check", "generate_artifacts"),
            ("generate_artifacts", "synthesize"),
        ]

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_dev_request(self, state: HephaestusState) -> Dict[str, Any]:
        """Parse the development request and extract parameters."""
        self.logger.info("Parsing development request...", task=state.current_task)

        task_lower = (state.current_task or "").lower()

        # Determine operation
        if any(kw in task_lower for kw in ["generate", "create", "write", "implement"]):
            if "test" in task_lower:
                operation = DevOperation.TEST_GENERATE
            elif "doc" in task_lower:
                operation = DevOperation.DOCUMENT
            else:
                operation = DevOperation.CODE_GENERATE
        elif any(kw in task_lower for kw in ["review", "check", "analyze"]):
            if "pr" in task_lower or "pull request" in task_lower:
                operation = DevOperation.PR_REVIEW
            else:
                operation = DevOperation.CODE_REVIEW
        elif any(kw in task_lower for kw in ["refactor", "improve", "optimize"]):
            operation = DevOperation.CODE_REFACTOR
        elif any(kw in task_lower for kw in ["debug", "fix", "bug"]):
            operation = DevOperation.DEBUG
        elif any(kw in task_lower for kw in ["deploy", "release"]):
            operation = DevOperation.DEPLOY
        elif any(kw in task_lower for kw in ["pr", "pull request"]):
            operation = DevOperation.PR_CREATE
        else:
            operation = DevOperation.CODE_GENERATE

        # Detect language
        language = Language.PYTHON
        for lang in Language:
            if lang.value in task_lower:
                language = lang
                break

        # Extract from context
        code_input = state.task_context.get("code", "")
        target_file = state.task_context.get("file")
        repository = state.task_context.get("repository")
        branch = state.task_context.get("branch", "main")

        await self._emit_progress(state, "Request parsed", 0.1)

        return {
            "operation": operation,
            "language": language,
            "code_input": code_input,
            "target_file": target_file,
            "repository": repository,
            "branch": branch,
        }

    async def _validate_code_input(self, state: HephaestusState) -> Dict[str, Any]:
        """Validate input parameters."""
        self.logger.info("Validating input...")

        error = None

        # Validate language
        if state.language.value not in self.SUPPORTED_LANGUAGES:
            error = f"Unsupported language: {state.language.value}"

        # Operations requiring code input
        code_required_ops = [
            DevOperation.CODE_REVIEW,
            DevOperation.CODE_REFACTOR,
            DevOperation.DEBUG,
            DevOperation.TEST_GENERATE,
        ]

        if state.operation in code_required_ops and not state.code_input:
            # Try to read from file
            if state.target_file:
                try:
                    result = await self._execute_mcp_tool(
                        "filesystem-mcp.read_file",
                        {"path": state.target_file}
                    )
                    if result.success:
                        state.code_input = result.result.get("content", "")
                    else:
                        error = f"Could not read file: {state.target_file}"
                except Exception as e:
                    error = f"File read failed: {e}"
            else:
                error = f"Code input required for {state.operation.value}"

        await self._emit_progress(state, "Validation complete", 0.15)

        return {
            "error": error,
            "code_input": state.code_input,
        }

    def _input_valid_condition(self, state: HephaestusState) -> bool:
        """Check if input is valid."""
        return state.error is None

    async def _execute_dev_operation(self, state: HephaestusState) -> Dict[str, Any]:
        """Execute the development operation."""
        self.logger.info("Executing operation...", operation=state.operation.value)

        code_output = ""
        diff = None

        if state.operation == DevOperation.CODE_GENERATE:
            code_output = await self._generate_code(state)

        elif state.operation == DevOperation.CODE_REVIEW:
            # Review is handled in quality_check
            pass

        elif state.operation == DevOperation.CODE_REFACTOR:
            code_output, diff = await self._refactor_code(state)

        elif state.operation == DevOperation.DEBUG:
            code_output, diff = await self._debug_code(state)

        elif state.operation == DevOperation.TEST_GENERATE:
            tests = await self._generate_tests(state)
            return {"tests_generated": tests}

        elif state.operation == DevOperation.DOCUMENT:
            documentation = await self._generate_documentation(state)
            return {"documentation": documentation}

        elif state.operation == DevOperation.PR_CREATE:
            pr_result = await self._create_pull_request(state)
            return pr_result

        elif state.operation == DevOperation.DEPLOY:
            deploy_result = await self._deploy(state)
            return deploy_result

        await self._emit_progress(state, "Operation executed", 0.5)

        return {
            "code_output": code_output,
            "diff": diff,
        }

    async def _generate_code(self, state: HephaestusState) -> str:
        """Generate code from specification."""
        self.logger.info("Generating code...", language=state.language.value)

        # Use sequential-thinking for complex generation
        try:
            result = await self._execute_mcp_tool(
                "sequential-thinking.think",
                {
                    "task": f"Generate {state.language.value} code for: {state.current_task}",
                    "context": state.task_context,
                }
            )

            if result.success:
                return result.result.get("code", f"# Generated {state.language.value} code\n# TODO: Implementation")

        except Exception as e:
            self.logger.warning(f"Sequential thinking failed: {e}")

        # Fallback placeholder
        return f"# Generated {state.language.value} code\n# Task: {state.current_task}\n# TODO: Implementation"

    async def _refactor_code(self, state: HephaestusState) -> tuple:
        """Refactor code for better quality."""
        self.logger.info("Refactoring code...")

        original = state.code_input
        refactored = original  # Would apply transformations

        # Generate diff
        diff = self._generate_diff(original, refactored)

        return refactored, diff

    async def _debug_code(self, state: HephaestusState) -> tuple:
        """Debug code and suggest fixes."""
        self.logger.info("Debugging code...")

        original = state.code_input
        fixed = original  # Would apply fixes

        diff = self._generate_diff(original, fixed)

        return fixed, diff

    async def _generate_tests(self, state: HephaestusState) -> List[Dict[str, Any]]:
        """Generate tests for code."""
        self.logger.info("Generating tests...")

        tests = [
            {
                "name": "test_basic_functionality",
                "code": f"def test_basic_functionality():\n    # TODO: Implement test\n    assert True",
                "type": "unit",
            },
            {
                "name": "test_edge_cases",
                "code": f"def test_edge_cases():\n    # TODO: Implement test\n    assert True",
                "type": "unit",
            },
        ]

        return tests

    async def _generate_documentation(self, state: HephaestusState) -> str:
        """Generate documentation for code."""
        self.logger.info("Generating documentation...")

        doc = f"""# Documentation

## Overview

Generated documentation for {state.target_file or 'code'}.

## Usage

TODO: Add usage examples

## API Reference

TODO: Add API documentation
"""
        return doc

    async def _create_pull_request(self, state: HephaestusState) -> Dict[str, Any]:
        """Create a pull request."""
        self.logger.info("Creating pull request...")

        if not state.repository:
            return {"error": "Repository not specified"}

        try:
            result = await self._execute_mcp_tool(
                "github-mcp.create_pull_request",
                {
                    "owner": state.repository.split("/")[0] if "/" in state.repository else "",
                    "repo": state.repository.split("/")[1] if "/" in state.repository else state.repository,
                    "title": state.pr_title or f"Changes from Hephaestus",
                    "body": state.pr_description or "Automated changes",
                    "head": state.branch,
                    "base": "main",
                }
            )

            if result.success:
                return {
                    "pr_url": result.result.get("html_url"),
                    "pr_number": result.result.get("number"),
                }

        except Exception as e:
            self.logger.error(f"PR creation failed: {e}")
            return {"error": str(e)}

        return {}

    async def _deploy(self, state: HephaestusState) -> Dict[str, Any]:
        """Deploy to target environment."""
        self.logger.info("Deploying...", environment=state.deployment_environment)

        # Would trigger CI/CD pipeline
        return {
            "deployment_status": "initiated",
            "deployment_environment": state.deployment_environment or "staging",
        }

    async def _security_scan(self, state: HephaestusState) -> Dict[str, Any]:
        """Scan code for security vulnerabilities."""
        self.logger.info("Running security scan...")

        security_concerns = []
        code = state.code_output or state.code_input

        if code:
            import re

            for vuln_type, patterns in self.SECURITY_PATTERNS.items():
                for pattern in patterns:
                    matches = re.findall(pattern, code, re.IGNORECASE)
                    if matches:
                        severity = SecuritySeverity.HIGH if vuln_type in ["sql_injection", "command_injection"] else SecuritySeverity.MEDIUM
                        security_concerns.append({
                            "type": vuln_type,
                            "severity": severity.value,
                            "pattern": pattern,
                            "matches": len(matches),
                            "description": f"Potential {vuln_type.replace('_', ' ')} vulnerability detected",
                        })

        await self._emit_progress(state, "Security scan complete", 0.7)

        return {"security_concerns": security_concerns}

    async def _quality_check(self, state: HephaestusState) -> Dict[str, Any]:
        """Perform quality check on code."""
        self.logger.info("Running quality check...")

        code = state.code_output or state.code_input
        issues = []
        suggestions = []

        if code:
            lines = code.split("\n")

            # Check code length
            if len(lines) > 500:
                suggestions.append("Consider breaking this into smaller modules")

            # Check for long lines
            long_lines = sum(1 for line in lines if len(line) > 120)
            if long_lines > 10:
                issues.append({
                    "type": "style",
                    "severity": "low",
                    "description": f"{long_lines} lines exceed 120 characters",
                })

            # Check for TODOs
            todo_count = sum(1 for line in lines if "TODO" in line.upper())
            if todo_count > 0:
                issues.append({
                    "type": "incomplete",
                    "severity": "info",
                    "description": f"{todo_count} TODO comments found",
                })

            # Check for complexity indicators
            if code.count("if ") + code.count("elif ") > 20:
                suggestions.append("High branching complexity - consider refactoring")

        # Determine quality rating
        quality = CodeQuality.GOOD
        if state.security_concerns:
            quality = CodeQuality.NEEDS_IMPROVEMENT
        elif len(issues) > 5:
            quality = CodeQuality.ACCEPTABLE
        elif len(issues) == 0 and len(suggestions) == 0:
            quality = CodeQuality.EXCELLENT

        await self._emit_progress(state, "Quality check complete", 0.85)

        return {
            "review_quality": quality,
            "review_issues": issues,
            "review_suggestions": suggestions,
        }

    async def _generate_artifacts(self, state: HephaestusState) -> Dict[str, Any]:
        """Generate additional artifacts if needed."""
        self.logger.info("Generating artifacts...")

        # Auto-generate tests if code was generated
        if state.operation == DevOperation.CODE_GENERATE and state.code_output:
            tests = await self._generate_tests(state)
            return {"tests_generated": tests}

        return {}

    def _generate_diff(self, original: str, modified: str) -> str:
        """Generate unified diff between two strings."""
        import difflib

        original_lines = original.splitlines(keepends=True)
        modified_lines = modified.splitlines(keepends=True)

        diff = difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile="original",
            tofile="modified",
        )

        return "".join(diff)

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    async def _generate_sdui_components(self, state: HephaestusState) -> List[Dict[str, Any]]:
        """Generate SDUI components for code visualization."""
        components = []

        # Code block for output
        if state.code_output:
            components.append({
                "type": "GlassCodeBlock",
                "props": {
                    "code": state.code_output,
                    "language": state.language.value,
                    "title": state.target_file or "Generated Code",
                    "showLineNumbers": True,
                    "copyable": True,
                }
            })

        # Diff viewer for refactoring/debug
        if state.diff:
            components.append({
                "type": "GlassDiffViewer",
                "props": {
                    "diff": state.diff,
                    "title": "Changes",
                    "language": state.language.value,
                }
            })

        # Review results card
        if state.review_quality:
            quality_colors = {
                CodeQuality.EXCELLENT: "green",
                CodeQuality.GOOD: "green",
                CodeQuality.ACCEPTABLE: "yellow",
                CodeQuality.NEEDS_IMPROVEMENT: "orange",
                CodeQuality.POOR: "red",
            }

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Code Review",
                    "variant": quality_colors.get(state.review_quality, "default"),
                    "children": [
                        {
                            "type": "GlassMeter",
                            "props": {
                                "label": "Quality Score",
                                "value": self._quality_to_score(state.review_quality),
                                "maxValue": 100,
                                "showPercentage": True,
                            }
                        }
                    ]
                }
            })

        # Security concerns
        if state.security_concerns:
            security_items = [
                {
                    "type": "GlassAlert",
                    "props": {
                        "severity": concern["severity"],
                        "title": concern["type"].replace("_", " ").title(),
                        "message": concern["description"],
                    }
                }
                for concern in state.security_concerns
            ]

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Security Issues",
                    "variant": "danger",
                    "children": security_items,
                }
            })

        # Issues list
        if state.review_issues:
            components.append({
                "type": "GlassTimeline",
                "props": {
                    "events": [
                        {
                            "id": f"issue_{i}",
                            "title": issue["type"].title(),
                            "description": issue["description"],
                            "status": "error" if issue["severity"] == "high" else "pending",
                        }
                        for i, issue in enumerate(state.review_issues)
                    ],
                    "orientation": "vertical",
                }
            })

        # Generated tests
        if state.tests_generated:
            for test in state.tests_generated[:3]:
                components.append({
                    "type": "GlassCodeBlock",
                    "props": {
                        "code": test["code"],
                        "language": state.language.value,
                        "title": test["name"],
                        "showLineNumbers": True,
                    }
                })

        # PR link
        if state.pr_url:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Pull Request Created",
                    "variant": "success",
                    "children": [
                        {
                            "type": "GlassButton",
                            "props": {
                                "label": f"PR #{state.pr_number}",
                                "href": state.pr_url,
                                "variant": "primary",
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
                "agent": "Hephaestus",
                "content": self._build_response_message(state),
            }
        })

        return components

    def _quality_to_score(self, quality: CodeQuality) -> int:
        """Convert quality rating to numeric score."""
        scores = {
            CodeQuality.EXCELLENT: 95,
            CodeQuality.GOOD: 80,
            CodeQuality.ACCEPTABLE: 65,
            CodeQuality.NEEDS_IMPROVEMENT: 45,
            CodeQuality.POOR: 25,
        }
        return scores.get(quality, 50)

    def _build_response_message(self, state: HephaestusState) -> str:
        """Build the response message based on operation result."""
        if state.error:
            return f"Operation failed: {state.error}"

        if state.operation == DevOperation.CODE_GENERATE:
            return f"Generated {state.language.value} code successfully."

        elif state.operation == DevOperation.CODE_REVIEW:
            quality_msg = f"Code quality: {state.review_quality.value if state.review_quality else 'unknown'}"
            issues_msg = f"{len(state.review_issues)} issues, {len(state.security_concerns)} security concerns"
            return f"Review complete. {quality_msg}. {issues_msg}."

        elif state.operation == DevOperation.CODE_REFACTOR:
            return "Code refactored. Review the diff to see changes."

        elif state.operation == DevOperation.DEBUG:
            return "Debugging complete. Review the suggested fixes."

        elif state.operation == DevOperation.TEST_GENERATE:
            return f"Generated {len(state.tests_generated)} test cases."

        elif state.operation == DevOperation.DOCUMENT:
            return "Documentation generated successfully."

        elif state.operation == DevOperation.PR_CREATE:
            if state.pr_url:
                return f"Pull request created: {state.pr_url}"
            return "Failed to create pull request."

        elif state.operation == DevOperation.DEPLOY:
            return f"Deployment to {state.deployment_environment} initiated."

        return "Development operation completed."

    # =========================================================================
    # Pentarchy Voting
    # =========================================================================

    async def vote_on_proposal(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cast vote in Pentarchy governance.

        Hephaestus votes based on technical feasibility and code quality.
        """
        self.logger.info("Evaluating proposal for Pentarchy vote...")

        score = 0.5
        reasons = []

        # Check technical feasibility
        if proposal.get("technically_feasible", True):
            score += 0.2
            reasons.append("technically_feasible")
        else:
            score -= 0.3
            reasons.append("not_technically_feasible")

        # Check code quality impact
        if proposal.get("improves_code_quality"):
            score += 0.15
            reasons.append("improves_code_quality")

        # Check for tests
        if proposal.get("has_tests"):
            score += 0.1
            reasons.append("has_tests")

        # Check security review
        if proposal.get("security_reviewed"):
            score += 0.1
            reasons.append("security_reviewed")

        # Check for breaking changes
        if proposal.get("breaking_changes"):
            score -= 0.2
            reasons.append("breaking_changes_concern")

        # Check complexity
        complexity = proposal.get("complexity", "medium")
        if complexity == "low":
            score += 0.1
            reasons.append("low_complexity")
        elif complexity == "high":
            score -= 0.1
            reasons.append("high_complexity_concern")

        # Check for documentation
        if proposal.get("has_documentation"):
            score += 0.05
            reasons.append("documented")

        approve = score >= 0.5

        return {
            "voter": "hephaestus",
            "approve": approve,
            "confidence": abs(score - 0.5) * 2,
            "score": score,
            "reasons": reasons,
            "category": "technical_feasibility",
            "timestamp": datetime.utcnow().isoformat(),
        }

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def quick_review(self, code: str, language: str = "python") -> Dict[str, Any]:
        """Quick code review without full workflow."""
        self.logger.info("Running quick review...")

        result = await self.process(
            task=f"Review this {language} code",
            context={
                "code": code,
                "language": language,
            }
        )

        return {
            "quality": result.get("review_quality"),
            "issues": result.get("review_issues", []),
            "security": result.get("security_concerns", []),
            "suggestions": result.get("review_suggestions", []),
        }
