"""
KOSMOS V2.0 Self-Improvement System

Autonomous performance monitoring, prompt tuning, tool optimization,
and error pattern learning for continuous system improvement.
"""

from typing import Any, Dict, List, Optional, Tuple, TypeVar, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import asyncio
import hashlib
import json
import logging
import math
import re

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================================
# Enums and Types
# ============================================================================

class MetricType(str, Enum):
    """Types of metrics tracked."""
    LATENCY = "latency"
    SUCCESS_RATE = "success_rate"
    TOKEN_USAGE = "token_usage"
    COST = "cost"
    USER_SATISFACTION = "user_satisfaction"
    TOOL_EFFECTIVENESS = "tool_effectiveness"
    INTENT_ACCURACY = "intent_accuracy"
    ERROR_RATE = "error_rate"


class ImprovementType(str, Enum):
    """Types of improvements."""
    PROMPT_TUNING = "prompt_tuning"
    TOOL_SELECTION = "tool_selection"
    ROUTING_OPTIMIZATION = "routing_optimization"
    CACHING = "caching"
    RETRY_STRATEGY = "retry_strategy"
    MODEL_SELECTION = "model_selection"


class OptimizationStatus(str, Enum):
    """Status of optimization experiments."""
    PROPOSED = "proposed"
    TESTING = "testing"
    VALIDATED = "validated"
    DEPLOYED = "deployed"
    REVERTED = "reverted"


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class PerformanceMetric:
    """A single performance metric observation."""
    metric_type: MetricType
    value: float
    timestamp: datetime
    context: Dict[str, Any] = field(default_factory=dict)
    agent_id: Optional[str] = None
    tool_id: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class PerformanceWindow:
    """Aggregated metrics over a time window."""
    metric_type: MetricType
    window_start: datetime
    window_end: datetime
    count: int
    mean: float
    median: float
    p95: float
    p99: float
    min_value: float
    max_value: float
    std_dev: float


@dataclass
class ErrorPattern:
    """A detected error pattern."""
    pattern_id: str
    error_type: str
    message_pattern: str
    frequency: int
    first_seen: datetime
    last_seen: datetime
    affected_agents: List[str]
    affected_tools: List[str]
    context_patterns: Dict[str, Any]
    suggested_fix: Optional[str] = None
    auto_fixable: bool = False


@dataclass
class PromptVariant:
    """A prompt variant for A/B testing."""
    variant_id: str
    original_prompt: str
    modified_prompt: str
    modification_type: str
    hypothesis: str
    success_rate: float = 0.0
    sample_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class OptimizationExperiment:
    """An optimization experiment."""
    experiment_id: str
    improvement_type: ImprovementType
    description: str
    status: OptimizationStatus
    control_metrics: Dict[str, float]
    treatment_metrics: Dict[str, float]
    confidence: float
    start_time: datetime
    end_time: Optional[datetime] = None
    conclusion: Optional[str] = None


# ============================================================================
# Performance Monitor
# ============================================================================

class PerformanceMonitor:
    """
    Monitors system performance metrics in real-time.

    Tracks latency, success rates, token usage, costs, and user satisfaction
    to identify areas for improvement.
    """

    def __init__(
        self,
        retention_hours: int = 168,  # 1 week
        aggregation_interval_minutes: int = 5
    ):
        self.retention_hours = retention_hours
        self.aggregation_interval = timedelta(minutes=aggregation_interval_minutes)
        self._metrics: List[PerformanceMetric] = []
        self._aggregated: Dict[str, List[PerformanceWindow]] = defaultdict(list)
        self._alerts: List[Dict[str, Any]] = []
        self._thresholds: Dict[MetricType, Dict[str, float]] = {
            MetricType.LATENCY: {"warning": 2000, "critical": 5000},  # ms
            MetricType.SUCCESS_RATE: {"warning": 0.95, "critical": 0.90},
            MetricType.ERROR_RATE: {"warning": 0.05, "critical": 0.10},
            MetricType.TOKEN_USAGE: {"warning": 4000, "critical": 8000},  # per request
        }
        self._lock = asyncio.Lock()

    async def record_metric(
        self,
        metric_type: MetricType,
        value: float,
        context: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None,
        tool_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> None:
        """Record a performance metric observation."""
        async with self._lock:
            metric = PerformanceMetric(
                metric_type=metric_type,
                value=value,
                timestamp=datetime.utcnow(),
                context=context or {},
                agent_id=agent_id,
                tool_id=tool_id,
                session_id=session_id
            )
            self._metrics.append(metric)

            # Check thresholds
            await self._check_threshold(metric)

            # Cleanup old metrics
            await self._cleanup_old_metrics()

    async def _check_threshold(self, metric: PerformanceMetric) -> None:
        """Check if metric exceeds thresholds."""
        if metric.metric_type not in self._thresholds:
            return

        thresholds = self._thresholds[metric.metric_type]

        # For success rate, lower is worse
        if metric.metric_type == MetricType.SUCCESS_RATE:
            if metric.value < thresholds.get("critical", 0):
                await self._create_alert("critical", metric)
            elif metric.value < thresholds.get("warning", 0):
                await self._create_alert("warning", metric)
        # For latency/errors, higher is worse
        else:
            if metric.value > thresholds.get("critical", float('inf')):
                await self._create_alert("critical", metric)
            elif metric.value > thresholds.get("warning", float('inf')):
                await self._create_alert("warning", metric)

    async def _create_alert(self, severity: str, metric: PerformanceMetric) -> None:
        """Create a performance alert."""
        alert = {
            "severity": severity,
            "metric_type": metric.metric_type.value,
            "value": metric.value,
            "timestamp": datetime.utcnow().isoformat(),
            "agent_id": metric.agent_id,
            "tool_id": metric.tool_id,
            "context": metric.context
        }
        self._alerts.append(alert)
        logger.warning(f"Performance alert: {alert}")

    async def _cleanup_old_metrics(self) -> None:
        """Remove metrics older than retention period."""
        cutoff = datetime.utcnow() - timedelta(hours=self.retention_hours)
        self._metrics = [m for m in self._metrics if m.timestamp > cutoff]

    async def aggregate_metrics(
        self,
        metric_type: MetricType,
        window_minutes: int = 60,
        group_by: Optional[str] = None
    ) -> List[PerformanceWindow]:
        """Aggregate metrics over time windows."""
        async with self._lock:
            windows = []
            now = datetime.utcnow()
            window_delta = timedelta(minutes=window_minutes)

            # Filter metrics of this type
            type_metrics = [m for m in self._metrics if m.metric_type == metric_type]

            if not type_metrics:
                return []

            # Sort by timestamp
            type_metrics.sort(key=lambda m: m.timestamp)

            # Create windows
            window_start = type_metrics[0].timestamp
            while window_start < now:
                window_end = window_start + window_delta

                # Get metrics in this window
                window_metrics = [
                    m for m in type_metrics
                    if window_start <= m.timestamp < window_end
                ]

                if window_metrics:
                    values = [m.value for m in window_metrics]
                    values.sort()

                    n = len(values)
                    mean = sum(values) / n
                    median = values[n // 2] if n % 2 else (values[n//2 - 1] + values[n//2]) / 2
                    p95 = values[int(n * 0.95)] if n > 1 else values[0]
                    p99 = values[int(n * 0.99)] if n > 1 else values[0]

                    variance = sum((v - mean) ** 2 for v in values) / n
                    std_dev = math.sqrt(variance)

                    windows.append(PerformanceWindow(
                        metric_type=metric_type,
                        window_start=window_start,
                        window_end=window_end,
                        count=n,
                        mean=mean,
                        median=median,
                        p95=p95,
                        p99=p99,
                        min_value=min(values),
                        max_value=max(values),
                        std_dev=std_dev
                    ))

                window_start = window_end

            return windows

    async def get_agent_performance(
        self,
        agent_id: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get performance summary for a specific agent."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        agent_metrics = [
            m for m in self._metrics
            if m.agent_id == agent_id and m.timestamp > cutoff
        ]

        if not agent_metrics:
            return {"agent_id": agent_id, "no_data": True}

        # Group by metric type
        by_type: Dict[MetricType, List[float]] = defaultdict(list)
        for m in agent_metrics:
            by_type[m.metric_type].append(m.value)

        summary = {"agent_id": agent_id, "period_hours": hours, "metrics": {}}

        for metric_type, values in by_type.items():
            summary["metrics"][metric_type.value] = {
                "count": len(values),
                "mean": sum(values) / len(values),
                "min": min(values),
                "max": max(values)
            }

        return summary

    async def get_tool_performance(
        self,
        tool_id: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get performance summary for a specific tool."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        tool_metrics = [
            m for m in self._metrics
            if m.tool_id == tool_id and m.timestamp > cutoff
        ]

        if not tool_metrics:
            return {"tool_id": tool_id, "no_data": True}

        # Calculate success rate and latency
        success_metrics = [m for m in tool_metrics if m.metric_type == MetricType.SUCCESS_RATE]
        latency_metrics = [m for m in tool_metrics if m.metric_type == MetricType.LATENCY]

        return {
            "tool_id": tool_id,
            "period_hours": hours,
            "call_count": len(tool_metrics),
            "success_rate": sum(m.value for m in success_metrics) / len(success_metrics) if success_metrics else None,
            "avg_latency_ms": sum(m.value for m in latency_metrics) / len(latency_metrics) if latency_metrics else None
        }

    def get_recent_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent performance alerts."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return [
            a for a in self._alerts
            if datetime.fromisoformat(a["timestamp"]) > cutoff
        ]


# ============================================================================
# Prompt Tuner
# ============================================================================

class PromptTuner:
    """
    Automatic prompt tuning through A/B testing and optimization.

    Experiments with prompt variations to improve agent performance
    while maintaining quality and safety guardrails.
    """

    def __init__(self, min_sample_size: int = 100, confidence_threshold: float = 0.95):
        self.min_sample_size = min_sample_size
        self.confidence_threshold = confidence_threshold
        self._variants: Dict[str, List[PromptVariant]] = defaultdict(list)
        self._active_experiments: Dict[str, str] = {}  # prompt_id -> variant_id
        self._results: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        # Prompt modification strategies
        self._strategies = [
            self._add_chain_of_thought,
            self._add_examples,
            self._simplify_instructions,
            self._add_constraints,
            self._restructure_format
        ]

    async def create_variant(
        self,
        prompt_id: str,
        original_prompt: str,
        strategy: Optional[str] = None
    ) -> PromptVariant:
        """Create a new prompt variant for testing."""
        if strategy:
            modifier = getattr(self, f"_{strategy}", None)
            if modifier:
                modified_prompt, hypothesis = modifier(original_prompt)
            else:
                modified_prompt = original_prompt
                hypothesis = "No modification"
        else:
            # Auto-select strategy based on prompt analysis
            strategy_func = self._select_strategy(original_prompt)
            modified_prompt, hypothesis = strategy_func(original_prompt)

        variant = PromptVariant(
            variant_id=self._generate_variant_id(prompt_id, modified_prompt),
            original_prompt=original_prompt,
            modified_prompt=modified_prompt,
            modification_type=strategy or "auto",
            hypothesis=hypothesis
        )

        self._variants[prompt_id].append(variant)
        return variant

    def _generate_variant_id(self, prompt_id: str, prompt: str) -> str:
        """Generate a unique variant ID."""
        content_hash = hashlib.sha256(prompt.encode()).hexdigest()[:8]
        return f"{prompt_id}_{content_hash}"

    def _select_strategy(self, prompt: str) -> Callable:
        """Select the best modification strategy for a prompt."""
        # Analyze prompt characteristics
        has_examples = "example" in prompt.lower() or "e.g." in prompt.lower()
        has_cot = "step by step" in prompt.lower() or "think through" in prompt.lower()
        is_long = len(prompt) > 1000
        has_structure = bool(re.search(r'\n\s*[-*\d]', prompt))

        if not has_cot:
            return self._add_chain_of_thought
        elif not has_examples:
            return self._add_examples
        elif is_long and not has_structure:
            return self._restructure_format
        elif is_long:
            return self._simplify_instructions
        else:
            return self._add_constraints

    def _add_chain_of_thought(self, prompt: str) -> Tuple[str, str]:
        """Add chain-of-thought prompting."""
        cot_addition = "\n\nThink through this step by step before providing your final answer."
        return prompt + cot_addition, "Adding chain-of-thought should improve reasoning accuracy"

    def _add_examples(self, prompt: str) -> Tuple[str, str]:
        """Add example-based prompting."""
        example_addition = "\n\nExample input: [example]\nExample output: [example]\n"
        return prompt + example_addition, "Adding examples should improve output consistency"

    def _simplify_instructions(self, prompt: str) -> Tuple[str, str]:
        """Simplify complex instructions."""
        # Remove redundant phrases
        simplified = re.sub(r'\b(please|kindly|ensure that|make sure to)\b', '', prompt, flags=re.I)
        simplified = re.sub(r'\s+', ' ', simplified).strip()
        return simplified, "Simplifying should reduce token usage while maintaining quality"

    def _add_constraints(self, prompt: str) -> Tuple[str, str]:
        """Add output constraints."""
        constraint_addition = "\n\nConstraints:\n- Be concise\n- Provide actionable output\n- Cite sources when applicable"
        return prompt + constraint_addition, "Adding constraints should improve output quality"

    def _restructure_format(self, prompt: str) -> Tuple[str, str]:
        """Restructure prompt format."""
        # Add clear section markers
        restructured = f"## Task\n{prompt}\n\n## Guidelines\n- Follow the task description carefully\n- Ask for clarification if needed"
        return restructured, "Restructuring should improve comprehension"

    async def record_result(
        self,
        prompt_id: str,
        variant_id: str,
        success: bool,
        latency_ms: float,
        token_count: int,
        user_feedback: Optional[float] = None
    ) -> None:
        """Record the result of using a prompt variant."""
        result = {
            "variant_id": variant_id,
            "success": success,
            "latency_ms": latency_ms,
            "token_count": token_count,
            "user_feedback": user_feedback,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._results[prompt_id].append(result)

        # Update variant stats
        for variant in self._variants[prompt_id]:
            if variant.variant_id == variant_id:
                variant.sample_count += 1
                # Running average of success rate
                variant.success_rate = (
                    (variant.success_rate * (variant.sample_count - 1) + (1 if success else 0))
                    / variant.sample_count
                )
                break

    async def get_best_variant(self, prompt_id: str) -> Optional[PromptVariant]:
        """Get the best performing variant for a prompt."""
        variants = self._variants.get(prompt_id, [])

        # Filter variants with sufficient samples
        qualified = [v for v in variants if v.sample_count >= self.min_sample_size]

        if not qualified:
            return None

        # Return highest success rate
        return max(qualified, key=lambda v: v.success_rate)

    async def should_switch_variant(
        self,
        prompt_id: str,
        current_variant_id: str
    ) -> Optional[PromptVariant]:
        """Check if we should switch to a better variant."""
        best = await self.get_best_variant(prompt_id)

        if not best:
            return None

        if best.variant_id == current_variant_id:
            return None

        # Find current variant
        current = None
        for v in self._variants[prompt_id]:
            if v.variant_id == current_variant_id:
                current = v
                break

        if not current:
            return best

        # Check if improvement is statistically significant
        improvement = best.success_rate - current.success_rate
        if improvement > 0.05 and best.sample_count >= self.min_sample_size:
            return best

        return None


# ============================================================================
# Tool Optimizer
# ============================================================================

class ToolOptimizer:
    """
    Optimizes tool selection and usage patterns.

    Learns which tools work best for different contexts and
    suggests optimal tool combinations.
    """

    def __init__(self):
        self._tool_usage: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._tool_scores: Dict[str, Dict[str, float]] = defaultdict(dict)
        self._context_patterns: Dict[str, List[str]] = defaultdict(list)
        self._tool_chains: Dict[str, int] = defaultdict(int)  # tool_a->tool_b -> count

    async def record_tool_usage(
        self,
        tool_id: str,
        success: bool,
        latency_ms: float,
        context: Dict[str, Any],
        result_quality: Optional[float] = None
    ) -> None:
        """Record a tool usage event."""
        usage = {
            "success": success,
            "latency_ms": latency_ms,
            "context_hash": self._hash_context(context),
            "result_quality": result_quality,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._tool_usage[tool_id].append(usage)

        # Update tool scores
        await self._update_tool_score(tool_id)

        # Track context patterns
        context_key = self._extract_context_key(context)
        if context_key:
            self._context_patterns[context_key].append(tool_id)

    def _hash_context(self, context: Dict[str, Any]) -> str:
        """Create a hash of the context for grouping."""
        # Extract key context features
        features = {
            "intent": context.get("intent"),
            "domain": context.get("domain"),
            "complexity": context.get("complexity"),
        }
        return hashlib.sha256(json.dumps(features, sort_keys=True).encode()).hexdigest()[:16]

    def _extract_context_key(self, context: Dict[str, Any]) -> Optional[str]:
        """Extract a key for context pattern matching."""
        intent = context.get("intent")
        domain = context.get("domain")
        if intent and domain:
            return f"{domain}:{intent}"
        return None

    async def _update_tool_score(self, tool_id: str) -> None:
        """Update the overall score for a tool."""
        usages = self._tool_usage[tool_id][-1000:]  # Last 1000 usages

        if not usages:
            return

        success_rate = sum(1 for u in usages if u["success"]) / len(usages)
        avg_latency = sum(u["latency_ms"] for u in usages) / len(usages)

        # Quality score (0-1) combining success rate and latency
        latency_score = max(0, 1 - (avg_latency / 5000))  # 5s = 0 score
        quality_scores = [u.get("result_quality", 0.5) for u in usages if u.get("result_quality")]
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.5

        overall_score = (success_rate * 0.4) + (latency_score * 0.3) + (avg_quality * 0.3)

        self._tool_scores[tool_id] = {
            "overall": overall_score,
            "success_rate": success_rate,
            "avg_latency_ms": avg_latency,
            "avg_quality": avg_quality,
            "sample_count": len(usages)
        }

    async def record_tool_chain(
        self,
        tool_sequence: List[str],
        success: bool
    ) -> None:
        """Record a sequence of tool calls."""
        if len(tool_sequence) < 2:
            return

        for i in range(len(tool_sequence) - 1):
            chain_key = f"{tool_sequence[i]}->{tool_sequence[i+1]}"
            if success:
                self._tool_chains[chain_key] += 1

    async def get_recommended_tools(
        self,
        context: Dict[str, Any],
        available_tools: List[str],
        top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """Get recommended tools for a given context."""
        context_key = self._extract_context_key(context)

        # Get tools commonly used in this context
        context_tools = []
        if context_key and context_key in self._context_patterns:
            context_tools = self._context_patterns[context_key][-100:]

        # Score each available tool
        scores = []
        for tool_id in available_tools:
            score = self._tool_scores.get(tool_id, {}).get("overall", 0.5)

            # Boost score if tool is commonly used in this context
            context_frequency = context_tools.count(tool_id) / max(len(context_tools), 1)
            score = score * 0.7 + context_frequency * 0.3

            scores.append((tool_id, score))

        # Sort by score and return top-k
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    async def get_suggested_next_tool(
        self,
        current_tool: str,
        available_tools: List[str]
    ) -> Optional[str]:
        """Suggest the next tool based on common patterns."""
        candidates = []

        for tool_id in available_tools:
            chain_key = f"{current_tool}->{tool_id}"
            count = self._tool_chains.get(chain_key, 0)
            if count > 0:
                candidates.append((tool_id, count))

        if candidates:
            candidates.sort(key=lambda x: x[1], reverse=True)
            return candidates[0][0]

        return None

    def get_tool_rankings(self) -> Dict[str, Dict[str, float]]:
        """Get overall tool rankings."""
        return dict(self._tool_scores)


# ============================================================================
# Error Pattern Learner
# ============================================================================

class ErrorPatternLearner:
    """
    Learns from errors to improve system resilience.

    Detects error patterns, suggests fixes, and can automatically
    apply corrections for known issues.
    """

    def __init__(self, pattern_threshold: int = 3):
        self.pattern_threshold = pattern_threshold
        self._errors: List[Dict[str, Any]] = []
        self._patterns: Dict[str, ErrorPattern] = {}
        self._fixes: Dict[str, Callable] = {}

    async def record_error(
        self,
        error_type: str,
        error_message: str,
        agent_id: Optional[str] = None,
        tool_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        stack_trace: Optional[str] = None
    ) -> Optional[ErrorPattern]:
        """Record an error and detect patterns."""
        error = {
            "error_type": error_type,
            "error_message": error_message,
            "agent_id": agent_id,
            "tool_id": tool_id,
            "context": context or {},
            "stack_trace": stack_trace,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._errors.append(error)

        # Detect patterns
        pattern = await self._detect_pattern(error)

        return pattern

    async def _detect_pattern(self, error: Dict[str, Any]) -> Optional[ErrorPattern]:
        """Detect if this error is part of a pattern."""
        # Create pattern signature
        signature = self._create_signature(error)

        if signature in self._patterns:
            # Update existing pattern
            pattern = self._patterns[signature]
            pattern.frequency += 1
            pattern.last_seen = datetime.utcnow()
            if error.get("agent_id") and error["agent_id"] not in pattern.affected_agents:
                pattern.affected_agents.append(error["agent_id"])
            if error.get("tool_id") and error["tool_id"] not in pattern.affected_tools:
                pattern.affected_tools.append(error["tool_id"])
            return pattern

        # Check if we have enough similar errors to create a pattern
        similar_errors = await self._find_similar_errors(error)

        if len(similar_errors) >= self.pattern_threshold:
            # Create new pattern
            pattern = ErrorPattern(
                pattern_id=signature,
                error_type=error["error_type"],
                message_pattern=self._extract_message_pattern(error["error_message"]),
                frequency=len(similar_errors) + 1,
                first_seen=datetime.fromisoformat(similar_errors[0]["timestamp"]),
                last_seen=datetime.utcnow(),
                affected_agents=list(set(
                    e.get("agent_id") for e in similar_errors if e.get("agent_id")
                )),
                affected_tools=list(set(
                    e.get("tool_id") for e in similar_errors if e.get("tool_id")
                )),
                context_patterns=self._extract_context_patterns(similar_errors),
                suggested_fix=self._suggest_fix(error)
            )
            self._patterns[signature] = pattern

            logger.warning(f"New error pattern detected: {pattern.pattern_id}")
            return pattern

        return None

    def _create_signature(self, error: Dict[str, Any]) -> str:
        """Create a unique signature for an error type."""
        # Normalize error message
        message = error["error_message"]
        # Remove specific values (IDs, timestamps, etc.)
        normalized = re.sub(r'\b[a-f0-9-]{36}\b', '<UUID>', message)
        normalized = re.sub(r'\b\d+\b', '<NUM>', normalized)
        normalized = re.sub(r'\'[^\']+\'', '<STR>', normalized)

        signature_input = f"{error['error_type']}:{normalized}"
        return hashlib.sha256(signature_input.encode()).hexdigest()[:16]

    async def _find_similar_errors(self, error: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find similar errors in history."""
        signature = self._create_signature(error)

        similar = []
        for e in self._errors[-1000:]:  # Last 1000 errors
            if self._create_signature(e) == signature:
                similar.append(e)

        return similar

    def _extract_message_pattern(self, message: str) -> str:
        """Extract a pattern from an error message."""
        # Normalize the message
        pattern = re.sub(r'\b[a-f0-9-]{36}\b', '{uuid}', message)
        pattern = re.sub(r'\b\d+\b', '{number}', pattern)
        pattern = re.sub(r'\'[^\']+\'', '{string}', pattern)
        return pattern

    def _extract_context_patterns(
        self,
        errors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract common context patterns from errors."""
        patterns = {}

        # Collect all context keys
        all_contexts = [e.get("context", {}) for e in errors]

        if not all_contexts:
            return patterns

        # Find common keys
        common_keys = set(all_contexts[0].keys())
        for ctx in all_contexts[1:]:
            common_keys &= set(ctx.keys())

        # Find common values for each key
        for key in common_keys:
            values = [ctx.get(key) for ctx in all_contexts]
            if len(set(values)) == 1:  # All same value
                patterns[key] = values[0]

        return patterns

    def _suggest_fix(self, error: Dict[str, Any]) -> Optional[str]:
        """Suggest a fix for an error."""
        error_type = error["error_type"]
        message = error["error_message"]

        # Known error patterns and fixes
        fix_suggestions = {
            "ConnectionError": "Check network connectivity and retry with exponential backoff",
            "RateLimitError": "Implement rate limiting and queue requests",
            "TimeoutError": "Increase timeout or break into smaller operations",
            "AuthenticationError": "Check credentials and token expiration",
            "ValidationError": "Review input schema and add validation",
            "PermissionDenied": "Check user permissions and RBAC policies",
        }

        for pattern, fix in fix_suggestions.items():
            if pattern.lower() in error_type.lower() or pattern.lower() in message.lower():
                return fix

        return None

    def register_auto_fix(
        self,
        pattern_id: str,
        fix_function: Callable
    ) -> None:
        """Register an automatic fix for a pattern."""
        self._fixes[pattern_id] = fix_function
        if pattern_id in self._patterns:
            self._patterns[pattern_id].auto_fixable = True

    async def attempt_auto_fix(
        self,
        error: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Attempt to automatically fix an error."""
        signature = self._create_signature(error)

        if signature in self._fixes:
            fix_func = self._fixes[signature]
            try:
                result = await fix_func(error)
                return {"fixed": True, "result": result}
            except Exception as e:
                return {"fixed": False, "error": str(e)}

        return None

    def get_patterns(
        self,
        min_frequency: int = 1,
        agent_id: Optional[str] = None
    ) -> List[ErrorPattern]:
        """Get detected error patterns."""
        patterns = list(self._patterns.values())

        # Filter by frequency
        patterns = [p for p in patterns if p.frequency >= min_frequency]

        # Filter by agent
        if agent_id:
            patterns = [p for p in patterns if agent_id in p.affected_agents]

        # Sort by frequency
        patterns.sort(key=lambda p: p.frequency, reverse=True)

        return patterns

    def get_error_trends(self, hours: int = 24) -> Dict[str, Any]:
        """Get error trends over time."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        recent_errors = [
            e for e in self._errors
            if datetime.fromisoformat(e["timestamp"]) > cutoff
        ]

        # Group by hour
        hourly: Dict[str, int] = defaultdict(int)
        by_type: Dict[str, int] = defaultdict(int)

        for error in recent_errors:
            hour = error["timestamp"][:13]  # YYYY-MM-DDTHH
            hourly[hour] += 1
            by_type[error["error_type"]] += 1

        return {
            "total": len(recent_errors),
            "by_hour": dict(hourly),
            "by_type": dict(by_type),
            "patterns_detected": len(self._patterns)
        }


# ============================================================================
# Self-Improvement Coordinator
# ============================================================================

class SelfImprovementCoordinator:
    """
    Coordinates all self-improvement activities.

    Combines performance monitoring, prompt tuning, tool optimization,
    and error learning into a unified improvement system.
    """

    def __init__(self):
        self.performance_monitor = PerformanceMonitor()
        self.prompt_tuner = PromptTuner()
        self.tool_optimizer = ToolOptimizer()
        self.error_learner = ErrorPatternLearner()

        self._experiments: Dict[str, OptimizationExperiment] = {}
        self._improvement_log: List[Dict[str, Any]] = []

    async def record_interaction(
        self,
        session_id: str,
        agent_id: str,
        tool_id: Optional[str] = None,
        prompt_variant_id: Optional[str] = None,
        success: bool = True,
        latency_ms: float = 0,
        token_count: int = 0,
        error: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record a complete interaction for learning."""
        # Record performance metrics
        await self.performance_monitor.record_metric(
            MetricType.LATENCY, latency_ms,
            agent_id=agent_id, tool_id=tool_id, session_id=session_id
        )
        await self.performance_monitor.record_metric(
            MetricType.SUCCESS_RATE, 1.0 if success else 0.0,
            agent_id=agent_id, tool_id=tool_id, session_id=session_id
        )
        await self.performance_monitor.record_metric(
            MetricType.TOKEN_USAGE, token_count,
            agent_id=agent_id, session_id=session_id
        )

        # Record tool usage
        if tool_id:
            await self.tool_optimizer.record_tool_usage(
                tool_id, success, latency_ms, context or {}
            )

        # Record prompt result
        if prompt_variant_id:
            await self.prompt_tuner.record_result(
                agent_id, prompt_variant_id, success, latency_ms, token_count
            )

        # Record error
        if error and not success:
            await self.error_learner.record_error(
                error.get("type", "UnknownError"),
                error.get("message", ""),
                agent_id=agent_id,
                tool_id=tool_id,
                context=context
            )

    async def get_improvement_suggestions(
        self,
        agent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get improvement suggestions based on collected data."""
        suggestions = []

        # Check for underperforming agents
        if agent_id:
            perf = await self.performance_monitor.get_agent_performance(agent_id)
            if "metrics" in perf:
                success_rate = perf["metrics"].get(MetricType.SUCCESS_RATE.value, {}).get("mean", 1.0)
                if success_rate < 0.9:
                    suggestions.append({
                        "type": ImprovementType.PROMPT_TUNING,
                        "priority": "high",
                        "description": f"Agent {agent_id} has low success rate ({success_rate:.1%})",
                        "recommendation": "Consider prompt tuning or additional training"
                    })

        # Check for slow tools
        for tool_id, scores in self.tool_optimizer.get_tool_rankings().items():
            if scores.get("avg_latency_ms", 0) > 3000:
                suggestions.append({
                    "type": ImprovementType.CACHING,
                    "priority": "medium",
                    "description": f"Tool {tool_id} has high latency ({scores['avg_latency_ms']:.0f}ms)",
                    "recommendation": "Consider caching or async execution"
                })

        # Check for recurring errors
        patterns = self.error_learner.get_patterns(min_frequency=5)
        for pattern in patterns:
            suggestions.append({
                "type": ImprovementType.RETRY_STRATEGY,
                "priority": "high" if pattern.frequency > 10 else "medium",
                "description": f"Recurring error pattern: {pattern.error_type}",
                "recommendation": pattern.suggested_fix or "Investigate root cause",
                "pattern_id": pattern.pattern_id
            })

        return suggestions

    async def create_experiment(
        self,
        improvement_type: ImprovementType,
        description: str,
        control_config: Dict[str, Any],
        treatment_config: Dict[str, Any]
    ) -> OptimizationExperiment:
        """Create a new optimization experiment."""
        experiment = OptimizationExperiment(
            experiment_id=hashlib.sha256(
                f"{improvement_type}:{description}:{datetime.utcnow().isoformat()}".encode()
            ).hexdigest()[:16],
            improvement_type=improvement_type,
            description=description,
            status=OptimizationStatus.PROPOSED,
            control_metrics={},
            treatment_metrics={},
            confidence=0.0,
            start_time=datetime.utcnow()
        )

        self._experiments[experiment.experiment_id] = experiment
        return experiment

    async def get_health_report(self) -> Dict[str, Any]:
        """Get overall system health report."""
        alerts = self.performance_monitor.get_recent_alerts(hours=24)
        error_trends = self.error_learner.get_error_trends(hours=24)
        tool_rankings = self.tool_optimizer.get_tool_rankings()

        # Calculate overall health score
        critical_alerts = sum(1 for a in alerts if a["severity"] == "critical")
        warning_alerts = sum(1 for a in alerts if a["severity"] == "warning")

        health_score = max(0, 100 - (critical_alerts * 20) - (warning_alerts * 5))

        return {
            "health_score": health_score,
            "status": "healthy" if health_score > 80 else "degraded" if health_score > 50 else "critical",
            "alerts": {
                "critical": critical_alerts,
                "warning": warning_alerts,
                "recent": alerts[:10]
            },
            "errors": {
                "total_24h": error_trends["total"],
                "patterns_detected": error_trends["patterns_detected"],
                "by_type": error_trends["by_type"]
            },
            "tools": {
                "total_tracked": len(tool_rankings),
                "top_performers": sorted(
                    [(k, v.get("overall", 0)) for k, v in tool_rankings.items()],
                    key=lambda x: x[1],
                    reverse=True
                )[:5]
            },
            "experiments": {
                "active": sum(1 for e in self._experiments.values() if e.status == OptimizationStatus.TESTING),
                "completed": sum(1 for e in self._experiments.values() if e.status in [OptimizationStatus.DEPLOYED, OptimizationStatus.REVERTED])
            },
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================================================
# Singleton Access
# ============================================================================

_coordinator: Optional[SelfImprovementCoordinator] = None


async def get_self_improvement_coordinator() -> SelfImprovementCoordinator:
    """Get the global self-improvement coordinator."""
    global _coordinator
    if _coordinator is None:
        _coordinator = SelfImprovementCoordinator()
    return _coordinator
