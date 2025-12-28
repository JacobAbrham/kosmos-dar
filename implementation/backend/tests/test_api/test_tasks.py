# KOSMOS V2.0 Tasks API Tests
"""
Tests for task management endpoints including:
- Task creation and execution
- Task status monitoring
- Task history and results
- Human-in-the-loop approvals
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from fastapi import status
from datetime import datetime, timedelta
import uuid


@pytest.fixture
def mock_task_service():
    """Mock task service."""
    service = MagicMock()
    service.create_task = AsyncMock(return_value={
        "task_id": "task-123",
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    })
    service.get_task = AsyncMock(return_value={
        "task_id": "task-123",
        "status": "completed",
        "agent_id": "zeus",
        "input": {"task": "Test task"},
        "result": {"output": "Task result"},
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": datetime.utcnow().isoformat(),
    })
    service.list_tasks = AsyncMock(return_value=[
        {"task_id": "task-1", "status": "completed"},
        {"task_id": "task-2", "status": "running"},
        {"task_id": "task-3", "status": "pending"},
    ])
    return service


@pytest.fixture
def sample_task_id():
    """Generate sample task ID."""
    return str(uuid.uuid4())


class TestTaskCreation:
    """Tests for task creation endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test creating a new task."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks",
                json={
                    "description": "Analyze quarterly sales report",
                    "agent_id": "athena",
                    "priority": "high",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert "task_id" in data
            assert data["status"] == "pending"

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_task_with_context(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test creating a task with additional context."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks",
                json={
                    "description": "Send weekly report",
                    "agent_id": "hermes",
                    "context": {
                        "recipients": ["team@kosmos.io"],
                        "report_type": "weekly",
                        "include_charts": True,
                    },
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_task_with_schedule(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test creating a scheduled task."""
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat()

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks",
                json={
                    "description": "Scheduled task",
                    "agent_id": "zeus",
                    "scheduled_at": scheduled_time,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_task_invalid_agent(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test creating a task with invalid agent fails."""
        mock_task_service.create_task = AsyncMock(
            side_effect=ValueError("Agent not found")
        )

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks",
                json={
                    "description": "Test task",
                    "agent_id": "nonexistent-agent",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_create_task_unauthorized(self, async_client: AsyncClient):
        """Test creating a task without auth fails."""
        response = await async_client.post(
            "/api/v1/tasks",
            json={
                "description": "Test task",
                "agent_id": "zeus",
            }
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestTaskRetrieval:
    """Tests for task retrieval endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_by_id(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task by ID."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["task_id"] == "task-123"
            assert "status" in data
            assert "result" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_not_found(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting non-existent task."""
        mock_task_service.get_task = AsyncMock(return_value=None)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/nonexistent",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_tasks(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test listing all tasks."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "tasks" in data
            assert len(data["tasks"]) == 3

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_tasks_with_filters(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test listing tasks with filters."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks",
                params={
                    "status": "completed",
                    "agent_id": "zeus",
                    "limit": 10,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_tasks_pagination(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test task listing with pagination."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks",
                params={
                    "page": 2,
                    "per_page": 20,
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "pagination" in data or "page" in data


class TestTaskStatus:
    """Tests for task status monitoring."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_status(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task status."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/status",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "status" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_progress(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task progress."""
        mock_task_service.get_progress = AsyncMock(return_value={
            "task_id": "task-123",
            "progress_percent": 75,
            "current_step": "analyzing_data",
            "steps_completed": 3,
            "steps_total": 4,
        })

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/progress",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "progress_percent" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_logs(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task execution logs."""
        mock_task_service.get_logs = AsyncMock(return_value=[
            {"timestamp": "2024-01-01T10:00:00Z", "level": "INFO", "message": "Task started"},
            {"timestamp": "2024-01-01T10:00:05Z", "level": "INFO", "message": "Step 1 completed"},
            {"timestamp": "2024-01-01T10:00:10Z", "level": "INFO", "message": "Task completed"},
        ])

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/logs",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "logs" in data


class TestTaskControl:
    """Tests for task control operations."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_cancel_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test canceling a running task."""
        mock_task_service.cancel_task = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/cancel",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_cancel_completed_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test canceling already completed task fails."""
        mock_task_service.cancel_task = AsyncMock(
            side_effect=ValueError("Cannot cancel completed task")
        )

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/cancel",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_retry_failed_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test retrying a failed task."""
        mock_task_service.retry_task = AsyncMock(return_value={
            "task_id": "task-124",
            "status": "pending",
            "retry_of": "task-123",
        })

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/retry",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_pause_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test pausing a running task."""
        mock_task_service.pause_task = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/pause",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_resume_task(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test resuming a paused task."""
        mock_task_service.resume_task = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/resume",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK


class TestHumanInTheLoop:
    """Tests for human-in-the-loop approval endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_list_pending_approvals(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test listing tasks pending approval."""
        mock_task_service.list_pending_approvals = AsyncMock(return_value=[
            {
                "task_id": "task-123",
                "approval_type": "action",
                "action": "send_email",
                "details": {"recipients": ["team@kosmos.io"]},
            },
        ])

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/pending-approvals",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "approvals" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_approve_task_action(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test approving a task action."""
        mock_task_service.approve_action = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/approve",
                json={
                    "approval_id": "approval-1",
                    "decision": "approve",
                    "comment": "Looks good",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_reject_task_action(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test rejecting a task action."""
        mock_task_service.reject_action = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/reject",
                json={
                    "approval_id": "approval-1",
                    "reason": "Not appropriate recipients",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_provide_human_input(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test providing human input to a task."""
        mock_task_service.provide_input = AsyncMock(return_value=True)

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.post(
                "/api/v1/tasks/task-123/input",
                json={
                    "input_id": "input-1",
                    "response": "Proceed with option A",
                },
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK


class TestTaskResults:
    """Tests for task results endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_result(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task result."""
        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/result",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "result" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_get_task_artifacts(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test getting task artifacts (files, reports, etc.)."""
        mock_task_service.get_artifacts = AsyncMock(return_value=[
            {"name": "report.pdf", "type": "application/pdf", "size": 102400},
            {"name": "data.csv", "type": "text/csv", "size": 5120},
        ])

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/artifacts",
                headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "artifacts" in data

    @pytest.mark.asyncio
    @pytest.mark.api
    async def test_download_task_artifact(self, async_client: AsyncClient, mock_task_service, auth_headers):
        """Test downloading a task artifact."""
        mock_task_service.get_artifact = AsyncMock(return_value=b"file content")

        with patch("api.routes.tasks.task_service", mock_task_service):
            response = await async_client.get(
                "/api/v1/tasks/task-123/artifacts/report.pdf",
                headers=auth_headers
            )

            assert response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_404_NOT_FOUND,
            ]
