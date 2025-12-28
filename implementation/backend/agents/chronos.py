"""
KOSMOS V2.0 Chronos Agent - Time & Scheduling Master

Chronos handles all time-related operations including scheduling,
calendar management, reminders, and temporal analytics.

Upgraded to LangGraph base with:
- State persistence (checkpointing)
- Human-in-the-loop for scheduling conflicts
- Semantic router integration
- SDUI timeline/calendar components
- MCP calendar server integration
"""

from typing import Any, Callable, Dict, List, Optional, Literal
from datetime import datetime, timedelta
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
    require_selection,
)
from core.tool_registry import ToolCallResult

logger = structlog.get_logger()


# ============================================================================
# Domain Types
# ============================================================================

class ScheduleType(str, Enum):
    """Types of scheduled items."""
    MEETING = "meeting"
    TASK = "task"
    REMINDER = "reminder"
    DEADLINE = "deadline"
    RECURRING = "recurring"
    MILESTONE = "milestone"
    BLOCKED_TIME = "blocked_time"


class SchedulePriority(str, Enum):
    """Priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ScheduleOperation(str, Enum):
    """Scheduling operations."""
    CREATE = "create"
    UPDATE = "update"
    CANCEL = "cancel"
    RESCHEDULE = "reschedule"
    QUERY = "query"
    OPTIMIZE = "optimize"
    CHECK_AVAILABILITY = "check_availability"
    FIND_SLOT = "find_slot"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies."""
    MOVE_FIRST = "move_first"
    MOVE_SECOND = "move_second"
    SHORTEN = "shorten"
    CANCEL_LOWER_PRIORITY = "cancel_lower_priority"
    ASK_USER = "ask_user"


# ============================================================================
# State Definition
# ============================================================================

class ChronosState(AgentGraphState):
    """
    State for Chronos time/scheduling workflow.

    Extends base state with scheduling-specific fields.
    """
    # Operation details
    operation: ScheduleOperation = ScheduleOperation.CREATE
    calendar_id: Optional[str] = None

    # Schedule items
    schedule_items: List[Dict[str, Any]] = Field(default_factory=list)
    new_item: Optional[Dict[str, Any]] = None

    # Time constraints
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    duration_minutes: int = 60

    # Participants
    participants: List[str] = Field(default_factory=list)
    participant_availability: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)

    # Conflict handling
    conflicts_detected: List[Dict[str, Any]] = Field(default_factory=list)
    conflict_resolution: Optional[ConflictResolution] = None
    resolution_options: List[Dict[str, Any]] = Field(default_factory=list)

    # Optimization
    optimization_suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    productivity_score: Optional[float] = None

    # Results
    scheduled_event_id: Optional[str] = None
    available_slots: List[Dict[str, Any]] = Field(default_factory=list)
    timeline_view: Optional[Dict[str, Any]] = None


# ============================================================================
# Chronos Agent
# ============================================================================

class ChronosAgent(LangGraphAgent[ChronosState]):
    """
    Chronos - Time & Scheduling Agent

    Responsibilities:
    - Manage calendars and schedules across providers
    - Detect and resolve scheduling conflicts
    - Send reminders and notifications
    - Optimize schedules for productivity
    - Track deadlines and milestones
    - Coordinate meeting scheduling
    - Integrate with Google Calendar, Outlook, etc.

    MCP Servers:
    - gcal-mcp: Google Calendar operations
    - outlook-mcp: Outlook Calendar (if configured)

    SDUI Components:
    - GlassTimeline: Timeline visualization
    - GlassCalendar: Calendar grid view
    - GlassScheduleCard: Individual event cards
    """

    # Calendar MCP tools
    CALENDAR_TOOLS = {
        "gcal": ["list_events", "create_event", "update_event", "delete_event", "find_free_time"],
        "outlook": ["list_events", "create_event", "update_event", "delete_event"],
    }

    # Working hours defaults
    DEFAULT_WORKING_HOURS = {
        "start": 9,
        "end": 17,
        "days": [1, 2, 3, 4, 5],  # Mon-Fri
    }

    def __init__(self):
        super().__init__(
            agent_id="chronos",
            name="Chronos",
            domain="scheduling",
            description="Time and scheduling master handling calendars, reminders, and temporal operations",
            tool_categories=[ToolCategory.CALENDAR, ToolCategory.COMMUNICATION],
            mcp_servers=["gcal-mcp", "outlook-mcp"],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=10,
            timeout_seconds=60,
        )

    # =========================================================================
    # Template Implementation
    # =========================================================================

    def create_state_class(self) -> type:
        """Return ChronosState for workflow."""
        return ChronosState

    def define_nodes(self) -> Dict[str, Callable]:
        """Define Chronos-specific workflow nodes."""
        return {
            "parse_schedule_request": self._parse_schedule_request,
            "check_availability": self._check_availability,
            "detect_conflicts": self._detect_conflicts,
            "resolve_conflicts": self._resolve_conflicts,
            "execute_schedule_operation": self._execute_schedule_operation,
            "optimize_schedule": self._optimize_schedule,
            "generate_timeline": self._generate_timeline,
        }

    def define_edges(self) -> List[tuple]:
        """Define Chronos-specific workflow edges."""
        return [
            # Replace default planning with schedule parsing
            ("plan", "parse_schedule_request"),
            ("parse_schedule_request", "check_availability"),
            ("check_availability", "detect_conflicts"),

            # Conditional: conflicts found?
            ("detect_conflicts", self._has_conflicts_condition, {
                True: "resolve_conflicts",
                False: "execute_schedule_operation"
            }),

            ("resolve_conflicts", "execute_schedule_operation"),
            ("execute_schedule_operation", "optimize_schedule"),
            ("optimize_schedule", "generate_timeline"),
            ("generate_timeline", "synthesize"),
        ]

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_schedule_request(self, state: ChronosState) -> Dict[str, Any]:
        """Parse the scheduling request and extract parameters."""
        self.logger.info("Parsing schedule request...", task=state.current_task)

        # Determine operation from task context
        task_lower = (state.current_task or "").lower()

        if any(kw in task_lower for kw in ["schedule", "create", "add", "book"]):
            operation = ScheduleOperation.CREATE
        elif any(kw in task_lower for kw in ["reschedule", "move", "change time"]):
            operation = ScheduleOperation.RESCHEDULE
        elif any(kw in task_lower for kw in ["cancel", "delete", "remove"]):
            operation = ScheduleOperation.CANCEL
        elif any(kw in task_lower for kw in ["when", "list", "show", "what"]):
            operation = ScheduleOperation.QUERY
        elif any(kw in task_lower for kw in ["available", "free", "find slot", "find time"]):
            operation = ScheduleOperation.FIND_SLOT
        elif any(kw in task_lower for kw in ["optimize", "improve", "suggest"]):
            operation = ScheduleOperation.OPTIMIZE
        else:
            operation = ScheduleOperation.QUERY

        # Extract participants from context
        participants = state.task_context.get("participants", [])

        # Extract time range from context
        time_range_start = state.task_context.get("start_time")
        time_range_end = state.task_context.get("end_time")

        if time_range_start and isinstance(time_range_start, str):
            time_range_start = datetime.fromisoformat(time_range_start)
        if time_range_end and isinstance(time_range_end, str):
            time_range_end = datetime.fromisoformat(time_range_end)

        # Build new item if creating
        new_item = None
        if operation == ScheduleOperation.CREATE:
            new_item = {
                "id": str(uuid4()),
                "title": state.task_context.get("title", "New Event"),
                "type": state.task_context.get("type", ScheduleType.MEETING.value),
                "priority": state.task_context.get("priority", SchedulePriority.MEDIUM.value),
                "start_time": time_range_start,
                "end_time": time_range_end or (time_range_start + timedelta(hours=1) if time_range_start else None),
                "participants": participants,
                "description": state.task_context.get("description", ""),
                "location": state.task_context.get("location"),
            }

        await self._emit_progress(state, "Request parsed", 0.15)

        return {
            "operation": operation,
            "new_item": new_item,
            "participants": participants,
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "duration_minutes": state.task_context.get("duration", 60),
        }

    async def _check_availability(self, state: ChronosState) -> Dict[str, Any]:
        """Check availability for all participants."""
        self.logger.info("Checking availability...", participants=len(state.participants))

        participant_availability = {}

        if state.participants:
            for participant in state.participants:
                # Query calendar for participant's busy times
                try:
                    result = await self._execute_mcp_tool(
                        "gcal-mcp.list_events",
                        {
                            "calendar_id": participant,
                            "time_min": (state.time_range_start or datetime.utcnow()).isoformat(),
                            "time_max": (state.time_range_end or datetime.utcnow() + timedelta(days=7)).isoformat(),
                        }
                    )

                    if result.success:
                        participant_availability[participant] = result.result.get("events", [])
                    else:
                        self.logger.warning(f"Could not fetch availability for {participant}")
                        participant_availability[participant] = []

                except Exception as e:
                    self.logger.warning(f"Availability check failed for {participant}: {e}")
                    participant_availability[participant] = []

        # Find available slots if operation requires it
        available_slots = []
        if state.operation in [ScheduleOperation.FIND_SLOT, ScheduleOperation.CREATE]:
            available_slots = await self._find_common_free_slots(
                participant_availability,
                state.time_range_start or datetime.utcnow(),
                state.time_range_end or datetime.utcnow() + timedelta(days=7),
                state.duration_minutes
            )

        await self._emit_progress(state, "Availability checked", 0.3)

        return {
            "participant_availability": participant_availability,
            "available_slots": available_slots,
        }

    async def _find_common_free_slots(
        self,
        availability: Dict[str, List[Dict]],
        start: datetime,
        end: datetime,
        duration_minutes: int
    ) -> List[Dict[str, Any]]:
        """Find common free slots across all participants."""
        # Simple slot finding algorithm
        slots = []
        current = start

        working_hours = self.DEFAULT_WORKING_HOURS

        while current < end and len(slots) < 10:
            # Check if within working hours
            if current.weekday() + 1 in working_hours["days"]:
                if working_hours["start"] <= current.hour < working_hours["end"]:
                    slot_end = current + timedelta(minutes=duration_minutes)

                    # Check if slot conflicts with any participant's events
                    is_free = True
                    for participant, events in availability.items():
                        for event in events:
                            event_start = event.get("start", {}).get("dateTime")
                            event_end = event.get("end", {}).get("dateTime")

                            if event_start and event_end:
                                event_start = datetime.fromisoformat(event_start.replace("Z", "+00:00"))
                                event_end = datetime.fromisoformat(event_end.replace("Z", "+00:00"))

                                # Check overlap
                                if current < event_end and slot_end > event_start:
                                    is_free = False
                                    break

                        if not is_free:
                            break

                    if is_free:
                        slots.append({
                            "start": current.isoformat(),
                            "end": slot_end.isoformat(),
                            "score": self._calculate_slot_score(current),
                        })

            # Move to next slot
            current += timedelta(minutes=30)

        # Sort by score
        slots.sort(key=lambda x: x["score"], reverse=True)

        return slots[:5]

    def _calculate_slot_score(self, slot_time: datetime) -> float:
        """Calculate preference score for a time slot."""
        score = 1.0

        # Prefer mid-morning and early afternoon
        hour = slot_time.hour
        if 9 <= hour <= 11:
            score += 0.3
        elif 14 <= hour <= 16:
            score += 0.2
        elif hour < 9 or hour > 17:
            score -= 0.5

        # Prefer Tuesday-Thursday
        if slot_time.weekday() in [1, 2, 3]:
            score += 0.2
        elif slot_time.weekday() in [0, 4]:
            score += 0.1

        return score

    async def _detect_conflicts(self, state: ChronosState) -> Dict[str, Any]:
        """Detect scheduling conflicts."""
        self.logger.info("Detecting conflicts...")

        conflicts = []

        if state.new_item and state.new_item.get("start_time"):
            new_start = state.new_item["start_time"]
            new_end = state.new_item.get("end_time") or new_start + timedelta(hours=1)

            # Check against existing events
            for participant, events in state.participant_availability.items():
                for event in events:
                    event_start = event.get("start", {}).get("dateTime")
                    event_end = event.get("end", {}).get("dateTime")

                    if event_start and event_end:
                        event_start_dt = datetime.fromisoformat(event_start.replace("Z", "+00:00"))
                        event_end_dt = datetime.fromisoformat(event_end.replace("Z", "+00:00"))

                        # Check overlap
                        if new_start < event_end_dt and new_end > event_start_dt:
                            conflicts.append({
                                "type": "time_overlap",
                                "existing_event": event,
                                "participant": participant,
                                "overlap_minutes": self._calculate_overlap(
                                    new_start, new_end, event_start_dt, event_end_dt
                                ),
                            })

        # Generate resolution options
        resolution_options = []
        if conflicts:
            self.logger.warning("Conflicts detected", count=len(conflicts))

            # Suggest alternatives from available slots
            for slot in state.available_slots[:3]:
                resolution_options.append({
                    "strategy": ConflictResolution.MOVE_FIRST.value,
                    "description": f"Move to {slot['start']}",
                    "new_time": slot,
                })

            resolution_options.append({
                "strategy": ConflictResolution.ASK_USER.value,
                "description": "Ask user for preference",
            })

        await self._emit_progress(state, f"Found {len(conflicts)} conflicts", 0.45)

        return {
            "conflicts_detected": conflicts,
            "resolution_options": resolution_options,
            "requires_human_input": len(conflicts) > 0,
        }

    def _calculate_overlap(
        self, start1: datetime, end1: datetime, start2: datetime, end2: datetime
    ) -> int:
        """Calculate overlap in minutes between two time ranges."""
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)

        if overlap_start < overlap_end:
            return int((overlap_end - overlap_start).total_seconds() / 60)
        return 0

    def _has_conflicts_condition(self, state: ChronosState) -> bool:
        """Check if there are conflicts to resolve."""
        return len(state.conflicts_detected) > 0

    async def _resolve_conflicts(self, state: ChronosState) -> Dict[str, Any]:
        """Resolve scheduling conflicts (with HITL if needed)."""
        self.logger.info("Resolving conflicts...")

        # If user input was provided, use it
        if state.human_input_response:
            selected = state.human_input_response.get("value")

            if selected and state.resolution_options:
                # Apply the selected resolution
                for option in state.resolution_options:
                    if option["strategy"] == selected:
                        if "new_time" in option:
                            state.new_item["start_time"] = datetime.fromisoformat(option["new_time"]["start"])
                            state.new_item["end_time"] = datetime.fromisoformat(option["new_time"]["end"])
                        break

                return {
                    "conflict_resolution": ConflictResolution(selected),
                    "conflicts_detected": [],  # Clear after resolution
                }

        # Auto-resolve: pick best available slot
        if state.available_slots and state.new_item:
            best_slot = state.available_slots[0]
            state.new_item["start_time"] = datetime.fromisoformat(best_slot["start"])
            state.new_item["end_time"] = datetime.fromisoformat(best_slot["end"])

            return {
                "conflict_resolution": ConflictResolution.MOVE_FIRST,
                "conflicts_detected": [],
            }

        return {}

    async def _check_human_input_node(self, state: ChronosState) -> Dict[str, Any]:
        """Override to add HITL for conflict resolution."""
        if state.conflicts_detected and not state.human_input_response:
            # Build options for user
            options = [opt["description"] for opt in state.resolution_options]

            return {
                "requires_human_input": True,
                "human_input_request": {
                    "id": str(uuid4()),
                    "type": HumanInputType.SELECTION.value,
                    "prompt": f"Scheduling conflict detected. How would you like to resolve it?",
                    "options": options,
                    "context": {
                        "conflicts": state.conflicts_detected,
                        "resolution_options": state.resolution_options,
                    },
                    "timeout_seconds": 120,
                }
            }

        return {"requires_human_input": False}

    async def _execute_schedule_operation(self, state: ChronosState) -> Dict[str, Any]:
        """Execute the scheduling operation via MCP."""
        self.logger.info("Executing schedule operation...", operation=state.operation.value)

        scheduled_event_id = None

        if state.operation == ScheduleOperation.CREATE and state.new_item:
            # Create event via Google Calendar MCP
            try:
                result = await self._execute_mcp_tool(
                    "gcal-mcp.create_event",
                    {
                        "summary": state.new_item.get("title"),
                        "description": state.new_item.get("description", ""),
                        "start": {
                            "dateTime": state.new_item["start_time"].isoformat() if state.new_item.get("start_time") else None,
                            "timeZone": "UTC",
                        },
                        "end": {
                            "dateTime": state.new_item["end_time"].isoformat() if state.new_item.get("end_time") else None,
                            "timeZone": "UTC",
                        },
                        "attendees": [{"email": p} for p in state.participants],
                        "location": state.new_item.get("location"),
                    }
                )

                if result.success:
                    scheduled_event_id = result.result.get("id")
                    self.logger.info(f"Event created: {scheduled_event_id}")
                else:
                    self.logger.error(f"Failed to create event: {result.error}")

            except Exception as e:
                self.logger.error(f"Calendar operation failed: {e}")

        elif state.operation == ScheduleOperation.CANCEL:
            event_id = state.task_context.get("event_id")
            if event_id:
                result = await self._execute_mcp_tool(
                    "gcal-mcp.delete_event",
                    {"event_id": event_id}
                )

        elif state.operation == ScheduleOperation.QUERY:
            # List events is already done in check_availability
            pass

        await self._emit_progress(state, "Operation executed", 0.7)

        return {
            "scheduled_event_id": scheduled_event_id,
            "steps_completed": state.steps_completed + ["execute_schedule_operation"],
        }

    async def _optimize_schedule(self, state: ChronosState) -> Dict[str, Any]:
        """Analyze and suggest schedule optimizations."""
        self.logger.info("Optimizing schedule...")

        optimization_suggestions = []
        productivity_score = 0.7  # Base score

        # Analyze schedule density
        all_events = []
        for events in state.participant_availability.values():
            all_events.extend(events)

        if all_events:
            # Check for back-to-back meetings
            sorted_events = sorted(all_events, key=lambda e: e.get("start", {}).get("dateTime", ""))

            back_to_back_count = 0
            for i in range(len(sorted_events) - 1):
                end_time = sorted_events[i].get("end", {}).get("dateTime")
                start_time = sorted_events[i + 1].get("start", {}).get("dateTime")

                if end_time and start_time:
                    end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                    start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))

                    if (start_dt - end_dt).total_seconds() < 900:  # Less than 15 min gap
                        back_to_back_count += 1

            if back_to_back_count > 2:
                optimization_suggestions.append({
                    "type": "reduce_back_to_back",
                    "severity": "medium",
                    "description": f"You have {back_to_back_count} back-to-back meetings. Consider adding buffer time.",
                })
                productivity_score -= 0.1

            # Check for meeting-heavy days
            events_by_day = {}
            for event in all_events:
                start = event.get("start", {}).get("dateTime")
                if start:
                    day = start[:10]
                    events_by_day[day] = events_by_day.get(day, 0) + 1

            for day, count in events_by_day.items():
                if count > 6:
                    optimization_suggestions.append({
                        "type": "reduce_meeting_load",
                        "severity": "high",
                        "description": f"High meeting load on {day} ({count} meetings). Consider rescheduling some.",
                        "day": day,
                    })
                    productivity_score -= 0.05

        await self._emit_progress(state, "Schedule optimized", 0.85)

        return {
            "optimization_suggestions": optimization_suggestions,
            "productivity_score": min(1.0, max(0.0, productivity_score)),
        }

    async def _generate_timeline(self, state: ChronosState) -> Dict[str, Any]:
        """Generate timeline view for SDUI rendering."""
        self.logger.info("Generating timeline view...")

        # Build timeline from all events
        timeline_items = []

        for participant, events in state.participant_availability.items():
            for event in events:
                timeline_items.append({
                    "id": event.get("id", str(uuid4())),
                    "title": event.get("summary", "Event"),
                    "start": event.get("start", {}).get("dateTime"),
                    "end": event.get("end", {}).get("dateTime"),
                    "type": "meeting",
                    "participant": participant,
                })

        # Add new item if created
        if state.scheduled_event_id and state.new_item:
            timeline_items.append({
                "id": state.scheduled_event_id,
                "title": state.new_item.get("title"),
                "start": state.new_item.get("start_time").isoformat() if state.new_item.get("start_time") else None,
                "end": state.new_item.get("end_time").isoformat() if state.new_item.get("end_time") else None,
                "type": state.new_item.get("type", "meeting"),
                "is_new": True,
            })

        # Sort by start time
        timeline_items.sort(key=lambda x: x.get("start", ""))

        timeline_view = {
            "items": timeline_items,
            "available_slots": state.available_slots,
            "conflicts": state.conflicts_detected,
            "optimization_suggestions": state.optimization_suggestions,
            "productivity_score": state.productivity_score,
        }

        return {"timeline_view": timeline_view}

    # =========================================================================
    # SDUI Component Generation
    # =========================================================================

    async def _generate_sdui_components(self, state: ChronosState) -> List[Dict[str, Any]]:
        """Generate SDUI components for schedule visualization."""
        components = []

        # Timeline component for schedule view
        if state.timeline_view:
            # Convert timeline items to SDUI events
            sdui_events = []
            for item in state.timeline_view.get("items", [])[:20]:
                status = "pending"
                if item.get("is_new"):
                    status = "completed"
                elif item.get("start"):
                    start_dt = datetime.fromisoformat(item["start"].replace("Z", "+00:00"))
                    if start_dt < datetime.utcnow():
                        status = "completed"
                    elif start_dt < datetime.utcnow() + timedelta(hours=1):
                        status = "active"

                sdui_events.append({
                    "id": item.get("id", str(uuid4())),
                    "title": item.get("title", "Event"),
                    "timestamp": item.get("start"),
                    "status": status,
                    "description": f"Duration: {self._format_duration(item.get('start'), item.get('end'))}",
                })

            components.append({
                "type": "GlassTimeline",
                "props": {
                    "events": sdui_events,
                    "orientation": "vertical",
                    "blur": 12,
                }
            })

        # Available slots component
        if state.available_slots:
            slot_items = [
                {
                    "id": f"slot_{i}",
                    "title": f"Available: {slot['start'][:16]}",
                    "description": f"Score: {slot['score']:.1f}",
                    "status": "pending",
                }
                for i, slot in enumerate(state.available_slots[:5])
            ]

            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Available Slots",
                    "children": {
                        "type": "GlassTimeline",
                        "props": {
                            "events": slot_items,
                            "orientation": "vertical",
                        }
                    }
                }
            })

        # Productivity score meter
        if state.productivity_score is not None:
            components.append({
                "type": "GlassMeter",
                "props": {
                    "label": "Schedule Health",
                    "value": state.productivity_score,
                    "maxValue": 1.0,
                    "showPercentage": True,
                    "color": "green" if state.productivity_score >= 0.7 else "yellow" if state.productivity_score >= 0.4 else "red",
                }
            })

        # Optimization suggestions
        if state.optimization_suggestions:
            components.append({
                "type": "GlassCard",
                "props": {
                    "title": "Schedule Suggestions",
                    "variant": "warning",
                    "children": [
                        {
                            "type": "GlassChatBubble",
                            "props": {
                                "content": suggestion["description"],
                                "role": "system",
                            }
                        }
                        for suggestion in state.optimization_suggestions[:3]
                    ]
                }
            })

        # Response message
        components.append({
            "type": "GlassChatBubble",
            "props": {
                "role": "assistant",
                "agent": "Chronos",
                "content": self._build_response_message(state),
            }
        })

        return components

    def _format_duration(self, start: Optional[str], end: Optional[str]) -> str:
        """Format duration between two times."""
        if not start or not end:
            return "Unknown duration"

        try:
            start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
            duration = end_dt - start_dt

            hours = duration.seconds // 3600
            minutes = (duration.seconds % 3600) // 60

            if hours > 0:
                return f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
            return f"{minutes}m"
        except:
            return "Unknown duration"

    def _build_response_message(self, state: ChronosState) -> str:
        """Build the response message based on operation result."""
        if state.operation == ScheduleOperation.CREATE:
            if state.scheduled_event_id:
                return f"Event '{state.new_item.get('title', 'Event')}' has been scheduled successfully."
            elif state.conflicts_detected:
                return "There were scheduling conflicts. Please review the suggested alternatives."
            else:
                return "Unable to schedule the event. Please try again."

        elif state.operation == ScheduleOperation.FIND_SLOT:
            if state.available_slots:
                return f"Found {len(state.available_slots)} available time slots. The best option is at {state.available_slots[0]['start'][:16]}."
            else:
                return "No available slots found in the requested time range."

        elif state.operation == ScheduleOperation.QUERY:
            events_count = sum(len(events) for events in state.participant_availability.values())
            return f"Found {events_count} events in your calendar."

        elif state.operation == ScheduleOperation.OPTIMIZE:
            if state.optimization_suggestions:
                return f"Found {len(state.optimization_suggestions)} suggestions to improve your schedule."
            else:
                return "Your schedule looks well-optimized!"

        return "Schedule operation completed."

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def schedule_reminder(
        self,
        title: str,
        when: datetime,
        recipients: List[str],
        message: str,
    ) -> Dict[str, Any]:
        """Schedule a reminder notification."""
        self.logger.info(f"Scheduling reminder: {title}")

        result = await self.process(
            task=f"Create a reminder: {title}",
            context={
                "title": title,
                "type": ScheduleType.REMINDER.value,
                "start_time": when.isoformat(),
                "participants": recipients,
                "description": message,
            }
        )

        return result

    async def get_upcoming(
        self,
        user_id: str,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """Get upcoming scheduled items for a user."""
        self.logger.info(f"Getting upcoming items for {user_id}")

        result = await self.process(
            task="Show upcoming events",
            context={
                "participants": [user_id],
                "start_time": datetime.utcnow().isoformat(),
                "end_time": (datetime.utcnow() + timedelta(hours=hours)).isoformat(),
            }
        )

        if result.get("timeline_view"):
            return result["timeline_view"].get("items", [])

        return []
