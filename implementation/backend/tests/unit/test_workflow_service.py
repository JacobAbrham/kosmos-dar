"""
Unit tests for WorkflowService.

Tests workflow service layer functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from services.workflow_service import WorkflowService
from services.base import ServiceContext


@pytest.fixture
def service_context():
    """Create service context."""
    return ServiceContext(
        tenant_id=str(uuid4()),
        user_id=str(uuid4()),
        session_id=str(uuid4())
    )


@pytest.fixture
def workflow_service():
    """Create workflow service instance."""
    service = WorkflowService()
    service._workflow_engine = AsyncMock()
    return service


@pytest.mark.asyncio
async def test_create_workflow(workflow_service, service_context):
    """Test creating a workflow."""
    workflow_id = str(uuid4())
    workflow_service._workflow_engine.create_workflow = AsyncMock(
        return_value=MagicMock(id=workflow_id, name="Test Workflow")
    )

    workflow = await workflow_service.create_workflow(
        service_context,
        name="Test Workflow",
        description="Test description",
        steps=[]
    )

    assert workflow.id == workflow_id
    assert workflow.name == "Test Workflow"


@pytest.mark.asyncio
async def test_execute_workflow(workflow_service, service_context):
    """Test executing a workflow."""
    execution_id = str(uuid4())
    workflow_id = str(uuid4())

    execution = MagicMock()
    execution.execution_id = execution_id
    execution.status = "completed"
    workflow_service._workflow_engine.execute_workflow = AsyncMock(
        return_value=execution
    )

    result = await workflow_service.execute_workflow(
        service_context,
        workflow_id,
        context={"key": "value"}
    )

    assert result.execution_id == execution_id
    assert result.status == "completed"


@pytest.mark.asyncio
async def test_get_workflow_status(workflow_service, service_context):
    """Test getting workflow execution status."""
    execution_id = str(uuid4())
    execution = MagicMock()
    execution.execution_id = execution_id
    execution.status = "running"
    workflow_service._workflow_engine.get_execution = AsyncMock(
        return_value=execution
    )

    status = await workflow_service.get_workflow_status(
        service_context,
        execution_id
    )

    assert status.execution_id == execution_id
    assert status.status == "running"
