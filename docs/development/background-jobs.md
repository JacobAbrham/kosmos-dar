# Background Job Processing Guide

**Last Updated:** January 2026  
**Status:** ✅ Complete

---

## Overview

KOSMOS V2.0 uses **ARQ** (Async RQ) for background job processing. ARQ is an async-native job queue built on Redis/Dragonfly, perfect for FastAPI applications.

**Key Features:**
- ✅ Async-native (works seamlessly with FastAPI)
- ✅ Redis/Dragonfly backend (high performance)
- ✅ Cron job support (scheduled tasks)
- ✅ Job prioritization (default, priority queues)
- ✅ Retry logic (configurable max tries)
- ✅ Job monitoring (status, results, cancellation)

---

## Architecture

```
┌─────────────────┐
│   FastAPI API   │
│   (Backend)     │
└────────┬────────┘
         │ Enqueue Jobs
         ▼
┌─────────────────┐
│  ARQ Job Queue  │
│  (Redis/Dragonfly)│
└────────┬────────┘
         │ Process Jobs
         ▼
┌─────────────────┐
│  ARQ Worker     │
│  (Background)   │
└─────────────────┘
```

---

## Quick Start

### 1. Start Worker

```bash
# Using Docker Compose (recommended)
docker compose up -d worker

# Or directly
cd implementation/backend
arq workers.worker.WorkerConfig
```

### 2. Enqueue a Job

```python
from workers.queue import get_job_queue

# Get job queue
job_queue = await get_job_queue()

# Enqueue agent workflow
job = await job_queue.enqueue_agent_workflow(
    agent_id="athena",
    task="Analyze this document",
    context={"document_id": "123"},
    tenant_id="tenant-1",
    user_id="user-1",
    priority="default"
)

print(f"Job ID: {job.job_id}")
```

### 3. Check Job Status

```python
# Get job status
status = await job_queue.get_job_status(job.job_id)
print(f"Status: {status}")

# Get job result (waits if not complete)
result = await job_queue.get_job_result(job.job_id, timeout=60)
print(f"Result: {result}")
```

---

## Job Types

### Agent Workflow Jobs

Execute agent workflows asynchronously:

```python
job = await job_queue.enqueue_agent_workflow(
    agent_id="zeus",
    task="Coordinate multi-agent task",
    context={"complexity": "high"},
    priority="priority",  # Use priority queue
    delay=timedelta(seconds=10)  # Delay execution
)
```

### Workflow Step Jobs

Process individual workflow steps:

```python
job = await job_queue.enqueue_workflow_step(
    workflow_id="wf-123",
    step_id="step-1",
    execution_id="exec-456"
)
```

### Notification Jobs

Send notifications asynchronously:

```python
job = await job_queue.enqueue_notification(
    user_id="user-1",
    notification_type="task_completed",
    title="Task Complete",
    message="Your analysis task has finished",
    metadata={"task_id": "task-123"}
)
```

---

## API Endpoints

### Enqueue Agent Workflow

```http
POST /api/v1/jobs/agent-workflow
Content-Type: application/json

{
  "agent_id": "athena",
  "task": "Analyze document",
  "context": {"document_id": "123"},
  "priority": "default",
  "delay_seconds": 10
}
```

**Response:**
```json
{
  "job_id": "abc123",
  "status": "queued",
  "created_at": "2026-01-15T10:00:00Z"
}
```

### Get Job Status

```http
GET /api/v1/jobs/{job_id}
```

**Response:**
```json
{
  "job_id": "abc123",
  "status": "complete",
  "result": {
    "success": true,
    "agent_id": "athena",
    "result": {...}
  }
}
```

### Cancel Job

```http
DELETE /api/v1/jobs/{job_id}
```

---

## Cron Jobs

Scheduled tasks run automatically:

- **Daily Metrics Aggregation** - Runs at midnight UTC
- **Cleanup Old Jobs** - Runs at 2 AM UTC
- **Agent Health Checks** - Runs every 5 minutes

### Adding Custom Cron Jobs

Edit `implementation/backend/workers/jobs.py`:

```python
async def my_custom_job(ctx: Dict[str, Any]) -> None:
    """Custom scheduled job."""
    logger.info("Running custom job")
    # Your logic here

# Add to WorkerConfig.cron_jobs
cron_jobs = [
    cron(my_custom_job, hour=3, minute=0),  # Daily at 3 AM
    # ... other cron jobs
]
```

---

## Configuration

### Environment Variables

```bash
# Redis/Dragonfly URL (for job queue)
REDIS_URL=redis://localhost:6379/1

# Worker settings (optional)
KOSMOS_WORKER_MAX_JOBS=10
KOSMOS_WORKER_JOB_TIMEOUT=300
KOSMOS_WORKER_MAX_TRIES=3
```

### Worker Settings

Edit `implementation/backend/workers/config.py`:

```python
class WorkerSettings(BaseSettings):
    max_jobs: int = 10  # Max concurrent jobs
    job_timeout: int = 300  # 5 minutes
    keep_result: int = 3600  # Keep results for 1 hour
    max_tries: int = 3  # Max retry attempts
```

---

## Integration with Agent Workflows

### Option 1: Direct Integration

Use the helper function to optionally execute async:

```python
from core.job_integration import execute_agent_async, should_use_async

# Check if should use async
if await should_use_async(task, estimated_duration_seconds=60):
    # Enqueue as background job
    result = await execute_agent_async(
        agent_id="athena",
        task=task,
        tenant_id=tenant_id,
        user_id=user_id
    )
    return {"job_id": result["job_id"], "status": "queued"}
else:
    # Execute synchronously
    agent = registry.get_agent("athena")
    result = await agent.process(task=task)
    return result
```

### Option 2: API Integration

The API endpoints automatically handle async execution:

```python
# POST /api/v1/jobs/agent-workflow
# Returns job_id immediately
# Client can poll for status
```

---

## Monitoring

### Job Status Values

- `queued` - Job is waiting to be processed
- `in_progress` - Job is currently running
- `complete` - Job completed successfully
- `failed` - Job failed (will retry if max_tries not reached)
- `cancelled` - Job was cancelled

### Viewing Jobs

```bash
# ARQ doesn't have built-in web UI, but you can:
# 1. Use Redis CLI to inspect queues
redis-cli
> KEYS arq:*
> GET arq:job:abc123

# 2. Use API endpoints
curl http://localhost:8000/api/v1/jobs/{job_id}
```

---

## Troubleshooting

### Worker Not Processing Jobs

1. **Check worker is running:**
   ```bash
   docker compose ps worker
   ```

2. **Check Redis connection:**
   ```bash
   redis-cli ping
   ```

3. **Check worker logs:**
   ```bash
   docker compose logs worker
   ```

### Jobs Failing

1. **Check job result:**
   ```python
   job = await job_queue.get_job(job_id)
   result = await job.result()
   print(result)  # Will show error
   ```

2. **Check worker logs** for detailed error messages

3. **Verify dependencies** - Ensure all services (DB, NATS, etc.) are accessible

---

## Best Practices

1. **Use async for long-running tasks** (> 30 seconds)
2. **Use priority queue** for time-sensitive jobs
3. **Set appropriate timeouts** based on task complexity
4. **Monitor job failures** and implement alerting
5. **Clean up old jobs** regularly (handled by cron)
6. **Use job IDs** for tracking and correlation

---

## Next Steps

- ✅ Job queue implemented
- ✅ API endpoints created
- ✅ Worker service configured
- ⬜ Add job monitoring dashboard (future)
- ⬜ Add job retry policies (configurable)
- ⬜ Add job result storage (for long-term retention)

---

**See Also:**
- [ARQ Documentation](https://arq-docs.helpmanual.io/)
- [Worker Configuration](implementation/backend/workers/config.py)
- [Job Definitions](implementation/backend/workers/jobs.py)
