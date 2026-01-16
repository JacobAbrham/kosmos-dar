"""
Workflow Service for KOSMOS V2.0

Service layer for workflow operations.
"""

import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from core.workflow_automation import WorkflowEngine, Workflow, WorkflowExecution
from services.base import BaseService, ServiceContext


class WorkflowService(BaseService):
    """
    Service for workflow operations.

    Responsibilities:
    - Workflow CRUD operations
    - Workflow execution
    - Workflow monitoring and status
    - Workflow scheduling
    """

    def __init__(self):
        super().__init__("WorkflowService")
        self._workflow_engine: Optional[WorkflowEngine] = None

    async def initialize(self) -> None:
        """Initialize service dependencies."""
        self._workflow_engine = WorkflowEngine()

    async def create_workflow(
        self,
        ctx: ServiceContext,
        name: str,
        description: str,
        definition: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Create a new workflow.

        Args:
            ctx: Service context
            name: Workflow name
            description: Workflow description
            definition: Workflow definition (steps, etc.)

        Returns:
            Created workflow information
        """
        start_time = time.perf_counter()

        try:
            if not self._workflow_engine:
                await self.initialize()

            workflow_id = str(uuid4())

            # Create workflow object
            workflow = Workflow(
                workflow_id=workflow_id,
                name=name,
                description=description,
                definition=definition,
                tenant_id=ctx.tenant_id,
                created_by=ctx.user_id,
            )

            # Register workflow
            await self._workflow_engine.register_workflow(workflow)

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "success": True,
                "workflow_id": workflow_id,
                "name": name,
                "status": "created",
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to create workflow",
                name=name,
                error=str(e),
                exc_info=True,
            )
            raise

    async def execute_workflow(
        self,
        ctx: ServiceContext,
        workflow_id: str,
        input_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a workflow.

        Args:
            ctx: Service context
            workflow_id: Workflow identifier
            input_data: Optional input data

        Returns:
            Execution result
        """
        start_time = time.perf_counter()

        try:
            if not self._workflow_engine:
                await self.initialize()

            # Get workflow
            workflow = await self._workflow_engine.get_workflow(workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")

            # Execute workflow
            execution = await self._workflow_engine.execute(
                workflow_id=workflow_id,
                input_data=input_data or {},
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
            )

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "success": True,
                "workflow_id": workflow_id,
                "execution_id": execution.execution_id,
                "status": execution.status.value,
                "result": execution.result,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to execute workflow",
                workflow_id=workflow_id,
                error=str(e),
                exc_info=True,
            )
            raise

    async def get_workflow_status(
        self, ctx: ServiceContext, execution_id: str
    ) -> Dict[str, Any]:
        """
        Get workflow execution status.

        Args:
            ctx: Service context
            execution_id: Execution identifier

        Returns:
            Execution status
        """
        start_time = time.perf_counter()

        try:
            if not self._workflow_engine:
                await self.initialize()

            execution = await self._workflow_engine.get_execution(execution_id)
            if not execution:
                raise ValueError(f"Execution {execution_id} not found")

            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)

            return {
                "execution_id": execution_id,
                "workflow_id": execution.workflow_id,
                "status": execution.status.value,
                "current_step": execution.current_step_id,
                "progress": execution.progress,
                "result": execution.result,
                "error": execution.error,
            }

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            self.logger.error(
                "Failed to get workflow status",
                execution_id=execution_id,
                error=str(e),
                exc_info=True,
            )
            raise


# Global service instance
_workflow_service: Optional[WorkflowService] = None


async def get_workflow_service() -> WorkflowService:
    """Get global workflow service instance."""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
        await _workflow_service.initialize()
    return _workflow_service
