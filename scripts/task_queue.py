#!/usr/bin/env python3
"""
KOSMOS DAR Task Queue System

Queues tasks for async processing, prioritizes by complexity and dependencies,
generates specifications automatically, and tracks task completion.
"""

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ============================================================================
# TYPES
# ============================================================================

class TaskPriority(str, Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    """Task status."""
    PENDING = "pending"
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskComplexity(str, Enum):
    """Task complexity."""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"


@dataclass
class Task:
    """Task model."""
    id: str
    title: str
    description: str
    priority: TaskPriority
    complexity: TaskComplexity
    status: TaskStatus
    dependencies: List[str]
    spec_path: Optional[str] = None
    assigned_agent: Optional[str] = None
    created_at: str = None
    updated_at: str = None
    completed_at: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow().isoformat()
        if self.metadata is None:
            self.metadata = {}


# ============================================================================
# TASK QUEUE
# ============================================================================

class TaskQueue:
    """Task queue manager."""
    
    def __init__(self, queue_file: Path):
        self.queue_file = queue_file
        self.tasks: Dict[str, Task] = {}
        self._load()
    
    def _load(self) -> None:
        """Load tasks from file."""
        if self.queue_file.exists():
            try:
                data = json.loads(self.queue_file.read_text())
                self.tasks = {
                    task_id: Task(**task_data)
                    for task_id, task_data in data.items()
                }
            except Exception as e:
                print(f"Warning: Failed to load queue: {e}", file=sys.stderr)
                self.tasks = {}
        else:
            self.tasks = {}
    
    def _save(self) -> None:
        """Save tasks to file."""
        data = {
            task_id: asdict(task)
            for task_id, task in self.tasks.items()
        }
        self.queue_file.parent.mkdir(parents=True, exist_ok=True)
        self.queue_file.write_text(json.dumps(data, indent=2))
    
    def add(
        self,
        title: str,
        description: str,
        priority: TaskPriority = TaskPriority.MEDIUM,
        complexity: TaskComplexity = TaskComplexity.MODERATE,
        dependencies: Optional[List[str]] = None,
        spec_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Add task to queue."""
        task_id = str(uuid4())
        task = Task(
            id=task_id,
            title=title,
            description=description,
            priority=priority,
            complexity=complexity,
            status=TaskStatus.PENDING,
            dependencies=dependencies or [],
            spec_path=spec_path,
            metadata=metadata or {}
        )
        self.tasks[task_id] = task
        self._save()
        return task_id
    
    def get_next(self) -> Optional[Task]:
        """Get next task to process (highest priority, no dependencies)."""
        # Filter tasks that are ready (no incomplete dependencies)
        ready_tasks = [
            task for task in self.tasks.values()
            if task.status == TaskStatus.PENDING
            and all(
                self.tasks.get(dep_id, Task(
                    id=dep_id, title="", description="",
                    priority=TaskPriority.LOW, complexity=TaskComplexity.SIMPLE,
                    status=TaskStatus.COMPLETED, dependencies=[]
                )).status == TaskStatus.COMPLETED
                for dep_id in task.dependencies
            )
        ]
        
        if not ready_tasks:
            return None
        
        # Sort by priority and complexity
        priority_order = {
            TaskPriority.CRITICAL: 4,
            TaskPriority.HIGH: 3,
            TaskPriority.MEDIUM: 2,
            TaskPriority.LOW: 1,
        }
        
        complexity_order = {
            TaskComplexity.COMPLEX: 3,
            TaskComplexity.MODERATE: 2,
            TaskComplexity.SIMPLE: 1,
        }
        
        ready_tasks.sort(
            key=lambda t: (
                priority_order.get(t.priority, 0),
                complexity_order.get(t.complexity, 0)
            ),
            reverse=True
        )
        
        return ready_tasks[0]
    
    def update_status(self, task_id: str, status: TaskStatus) -> None:
        """Update task status."""
        if task_id not in self.tasks:
            raise ValueError(f"Task not found: {task_id}")
        
        task = self.tasks[task_id]
        task.status = status
        task.updated_at = datetime.utcnow().isoformat()
        
        if status == TaskStatus.COMPLETED:
            task.completed_at = datetime.utcnow().isoformat()
        
        self._save()
    
    def list_tasks(self, status: Optional[TaskStatus] = None) -> List[Task]:
        """List tasks, optionally filtered by status."""
        tasks = list(self.tasks.values())
        if status:
            tasks = [t for t in tasks if t.status == status]
        return sorted(tasks, key=lambda t: t.created_at, reverse=True)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Task queue manager")
    parser.add_argument("--queue-file", type=Path, default=Path(".tasks/queue.json"), help="Queue file path")
    
    subparsers = parser.add_subparsers(dest="command", help="Command")
    
    # Add command
    add_parser = subparsers.add_parser("add", help="Add task")
    add_parser.add_argument("title", help="Task title")
    add_parser.add_argument("description", help="Task description")
    add_parser.add_argument("--priority", choices=[p.value for p in TaskPriority], default=TaskPriority.MEDIUM.value)
    add_parser.add_argument("--complexity", choices=[c.value for c in TaskComplexity], default=TaskComplexity.MODERATE.value)
    add_parser.add_argument("--dependencies", nargs="+", help="Task IDs this task depends on")
    add_parser.add_argument("--spec", help="Specification file path")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List tasks")
    list_parser.add_argument("--status", choices=[s.value for s in TaskStatus], help="Filter by status")
    
    # Next command
    subparsers.add_parser("next", help="Get next task")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Update task status")
    update_parser.add_argument("task_id", help="Task ID")
    update_parser.add_argument("status", choices=[s.value for s in TaskStatus], help="New status")
    
    args = parser.parse_args()
    
    queue = TaskQueue(args.queue_file)
    
    if args.command == "add":
        task_id = queue.add(
            title=args.title,
            description=args.description,
            priority=TaskPriority(args.priority),
            complexity=TaskComplexity(args.complexity),
            dependencies=args.dependencies or [],
            spec_path=args.spec
        )
        print(f"✅ Task added: {task_id}")
        print(f"   Title: {args.title}")
    
    elif args.command == "list":
        tasks = queue.list_tasks(status=TaskStatus(args.status) if args.status else None)
        if not tasks:
            print("No tasks found")
        else:
            print(f"\n📋 Tasks ({len(tasks)}):\n")
            for task in tasks:
                print(f"  [{task.status.value.upper()}] {task.title}")
                print(f"      ID: {task.id}")
                print(f"      Priority: {task.priority.value}, Complexity: {task.complexity.value}")
                if task.dependencies:
                    print(f"      Dependencies: {', '.join(task.dependencies)}")
                print()
    
    elif args.command == "next":
        task = queue.get_next()
        if task:
            print(f"📌 Next Task:")
            print(f"   ID: {task.id}")
            print(f"   Title: {task.title}")
            print(f"   Description: {task.description}")
            print(f"   Priority: {task.priority.value}")
            print(f"   Complexity: {task.complexity.value}")
        else:
            print("No tasks ready to process")
    
    elif args.command == "update":
        queue.update_status(args.task_id, TaskStatus(args.status))
        print(f"✅ Task {args.task_id} updated to {args.status}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
