"""
KOSMOS V2.0 Hermes Agent - Data Integration (LangGraph Enhanced)

Hermes handles all data integration tasks:
- Data pipeline orchestration
- Schema inference and validation
- ETL/ELT operations
- API data synchronization
- Database queries and transformations
"""

from typing import Any, Dict, List, Optional
from enum import Enum

import structlog
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END

from .langgraph_base import (
    LangGraphAgent,
    AgentGraphState,
    WorkflowPhase,
    require_confirmation,
)
from core.config import settings
from core.tool_registry import ToolCategory

logger = structlog.get_logger()


class DataOperationType(str, Enum):
    """Types of data operations."""
    QUERY = "query"
    TRANSFORM = "transform"
    SYNC = "sync"
    VALIDATE = "validate"
    EXPORT = "export"
    IMPORT = "import"


class HermesState(AgentGraphState):
    """State for Hermes data integration workflow."""
    # Operation type
    operation_type: DataOperationType = DataOperationType.QUERY

    # Data context
    source_system: Optional[str] = None
    target_system: Optional[str] = None
    data_schema: Optional[Dict[str, Any]] = None
    inferred_schema: Optional[Dict[str, Any]] = None

    # Query/Transform
    query_text: Optional[str] = None
    transform_steps: List[Dict[str, Any]] = Field(default_factory=list)

    # Results
    row_count: int = 0
    data_sample: List[Dict[str, Any]] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)


class HermesAgent(LangGraphAgent[HermesState]):
    """
    Hermes - Data Integration Agent (LangGraph Enhanced)

    Capabilities:
    - Database querying (PostgreSQL, Redis, DuckDB)
    - Data transformation pipelines
    - Schema inference and validation
    - API data synchronization
    - ETL workflow execution
    """

    # Supported data sources
    DATA_SOURCES = {
        "postgresql": "postgres-mcp",
        "postgres": "postgres-mcp",
        "redis": "redis-mcp",
        "filesystem": "filesystem-mcp",
        "github": "github-mcp",
        "slack": "slack-mcp",
        "notion": "notion-mcp",
    }

    def __init__(self):
        super().__init__(
            agent_id="hermes",
            name="Hermes",
            domain="data",
            description="Data integration and ETL operations",
            tool_categories=[
                ToolCategory.DATABASE,
                ToolCategory.STORAGE,
                ToolCategory.DATA_PROCESSING,
            ],
            mcp_servers=[
                "postgres-mcp",
                "redis-mcp",
                "filesystem-mcp",
            ],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=15,
            timeout_seconds=180,
        )

    def create_state_class(self) -> type:
        return HermesState

    def define_nodes(self) -> Dict[str, Any]:
        return {
            "analyze_data_request": self._analyze_data_request,
            "infer_schema": self._infer_schema,
            "execute_query": self._execute_query,
            "transform_data": self._transform_data,
            "validate_results": self._validate_results,
        }

    async def _build_workflow(self) -> Any:
        workflow = StateGraph(HermesState)

        workflow.add_node("analyze_data_request", self._analyze_data_request)
        workflow.add_node("infer_schema", self._infer_schema)
        workflow.add_node("execute_query", self._execute_query)
        workflow.add_node("transform_data", self._transform_data)
        workflow.add_node("validate_results", self._validate_results)
        workflow.add_node("check_governance", self._check_governance_node)
        workflow.add_node("synthesize", self._synthesize_node)
        workflow.add_node("handle_error", self._handle_error_node)

        workflow.set_entry_point("analyze_data_request")

        workflow.add_edge("analyze_data_request", "infer_schema")
        workflow.add_edge("infer_schema", "check_governance")

        workflow.add_conditional_edges(
            "check_governance",
            lambda s: "proceed" if not s.requires_governance or s.governance_approved else "denied",
            {"proceed": "execute_query", "denied": "handle_error"}
        )

        workflow.add_edge("execute_query", "transform_data")
        workflow.add_edge("transform_data", "validate_results")
        workflow.add_edge("validate_results", "synthesize")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("handle_error", END)

        return workflow.compile(checkpointer=self._checkpointer)

    async def _analyze_data_request(self, state: HermesState) -> Dict[str, Any]:
        """Analyze the data request to determine operation type."""
        self.logger.info("Analyzing data request...")

        task = state.current_task or ""
        task_lower = task.lower()

        # Determine operation type
        if any(kw in task_lower for kw in ["query", "select", "find", "get", "fetch"]):
            op_type = DataOperationType.QUERY
        elif any(kw in task_lower for kw in ["transform", "convert", "map", "normalize"]):
            op_type = DataOperationType.TRANSFORM
        elif any(kw in task_lower for kw in ["sync", "replicate", "mirror"]):
            op_type = DataOperationType.SYNC
        elif any(kw in task_lower for kw in ["validate", "check", "verify"]):
            op_type = DataOperationType.VALIDATE
        elif any(kw in task_lower for kw in ["export", "download", "dump"]):
            op_type = DataOperationType.EXPORT
        elif any(kw in task_lower for kw in ["import", "upload", "load", "insert"]):
            op_type = DataOperationType.IMPORT
        else:
            op_type = DataOperationType.QUERY

        # Detect source/target systems
        source = None
        target = None

        for sys_name, mcp_name in self.DATA_SOURCES.items():
            if sys_name in task_lower:
                if source is None:
                    source = sys_name
                else:
                    target = sys_name

        await self._emit_progress(state, "Request analyzed", 0.15)

        return {
            "operation_type": op_type,
            "source_system": source or "postgres",
            "target_system": target
        }

    async def _infer_schema(self, state: HermesState) -> Dict[str, Any]:
        """Infer schema from data source."""
        self.logger.info("Inferring schema...", source=state.source_system)

        inferred_schema = {}

        # Use MCP tools to infer schema
        if state.source_system in ["postgres", "postgresql"]:
            try:
                result = await self._execute_mcp_tool(
                    "postgres-mcp.list_tables",
                    {}
                )
                if result.success:
                    inferred_schema["tables"] = result.result
            except Exception as e:
                self.logger.warning("Schema inference failed", error=str(e))

        await self._emit_progress(state, "Schema inferred", 0.3)

        return {"inferred_schema": inferred_schema}

    async def _execute_query(self, state: HermesState) -> Dict[str, Any]:
        """Execute the data query."""
        self.logger.info("Executing query...", operation=state.operation_type.value)

        results = []
        row_count = 0

        if state.source_system in ["postgres", "postgresql"]:
            try:
                query = self._extract_query(state.current_task or "")

                if query:
                    result = await self._execute_mcp_tool(
                        "postgres-mcp.query",
                        {"query": query}
                    )
                    if result.success:
                        results = result.result.get("rows", [])
                        row_count = len(results)
                else:
                    # Default query based on task
                    results = [{"status": "No explicit query found in task"}]

            except Exception as e:
                self.logger.error("Query execution failed", error=str(e))
                return {"error": str(e)}

        elif state.source_system == "redis":
            try:
                result = await self._execute_mcp_tool(
                    "redis-mcp.get",
                    {"key": state.current_task}
                )
                if result.success:
                    results = [{"data": result.result}]
                    row_count = 1
            except Exception as e:
                self.logger.warning("Redis query failed", error=str(e))

        await self._emit_progress(state, f"Query executed: {row_count} rows", 0.6)

        return {
            "data_sample": results[:100],
            "row_count": row_count
        }

    def _extract_query(self, task: str) -> Optional[str]:
        """Extract SQL query from natural language task."""
        if "SELECT" in task.upper():
            start = task.upper().find("SELECT")
            end = task.find(";", start)
            if end > start:
                return task[start:end + 1]
            return task[start:]
        return None

    async def _transform_data(self, state: HermesState) -> Dict[str, Any]:
        """Apply data transformations."""
        self.logger.info("Transforming data...")

        if state.operation_type != DataOperationType.TRANSFORM:
            return {}

        transformed = state.data_sample

        for step in state.transform_steps:
            step_type = step.get("type")
            if step_type == "filter":
                field = step.get("field")
                value = step.get("value")
                transformed = [r for r in transformed if r.get(field) == value]
            elif step_type == "rename":
                old_name = step.get("old")
                new_name = step.get("new")
                transformed = [{new_name if k == old_name else k: v for k, v in r.items()} for r in transformed]

        await self._emit_progress(state, "Data transformed", 0.75)

        return {"data_sample": transformed}

    async def _validate_results(self, state: HermesState) -> Dict[str, Any]:
        """Validate query results."""
        self.logger.info("Validating results...")

        errors = []

        if state.row_count == 0 and state.operation_type == DataOperationType.QUERY:
            errors.append("Query returned no results")

        if state.data_schema and state.data_sample:
            for i, row in enumerate(state.data_sample[:10]):
                for field, expected_type in state.data_schema.items():
                    if field not in row:
                        errors.append(f"Row {i}: Missing field '{field}'")

        await self._emit_progress(state, "Validation complete", 0.85)

        return {"validation_errors": errors}

    async def _synthesize_node(self, state: HermesState) -> Dict[str, Any]:
        """Synthesize data operation response."""
        self.logger.info("Synthesizing response...")

        state.phase = WorkflowPhase.COMPLETED

        if state.validation_errors:
            response = f"Data operation completed with warnings:\n" + "\n".join(f"- {e}" for e in state.validation_errors)
        else:
            response = f"Data operation completed successfully.\n"
            response += f"- Operation: {state.operation_type.value}\n"
            response += f"- Source: {state.source_system}\n"
            response += f"- Rows: {state.row_count}"

        components = []

        if state.data_sample:
            components.append({
                "type": "data_table",
                "props": {
                    "title": f"{state.operation_type.value.title()} Results",
                    "data": state.data_sample[:50],
                    "totalRows": state.row_count
                }
            })

        if state.inferred_schema and state.inferred_schema.get("tables"):
            components.append({
                "type": "card",
                "props": {
                    "title": "Schema",
                    "content": f"Tables: {', '.join(state.inferred_schema.get('tables', [])[:10])}"
                }
            })

        components.append({
            "type": "metric",
            "props": {
                "label": "Rows Retrieved",
                "value": str(state.row_count),
                "trend": "up" if state.row_count > 0 else "neutral"
            }
        })

        await self._emit_progress(state, "Complete", 1.0)

        return {
            "final_response": response,
            "final_result": {
                "operation": state.operation_type.value,
                "source": state.source_system,
                "row_count": state.row_count,
                "sample": state.data_sample[:10],
                "schema": state.inferred_schema
            },
            "ui_components": components,
            "suggested_layout": "data_table",
            "phase": state.phase
        }


# Factory
_hermes_instance: Optional[HermesAgent] = None


async def get_hermes() -> HermesAgent:
    global _hermes_instance
    if _hermes_instance is None:
        _hermes_instance = HermesAgent()
        await _hermes_instance.initialize()
    return _hermes_instance


async def close_hermes() -> None:
    global _hermes_instance
    if _hermes_instance:
        await _hermes_instance.shutdown()
        _hermes_instance = None
