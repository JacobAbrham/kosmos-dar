"""
KOSMOS V2.0 Semantic Router

Embedding-based intent classification and agent routing.
Replaces keyword-based routing with intelligent semantic understanding.
"""

import asyncio
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
import json

import structlog
import numpy as np

from core.circuit_breaker import CircuitBreaker, CircuitState, CircuitOpenError
from services.embedding_service import EmbeddingService, get_embedding_service

logger = structlog.get_logger()


class RoutingMethod(str, Enum):
    """Methods used for routing decision."""
    SEMANTIC = "semantic"      # Embedding-based similarity
    KEYWORD = "keyword"        # Regex/keyword fallback
    CONTEXT = "context"        # Context-aware override
    FALLBACK = "fallback"      # Default when all else fails


@dataclass
class IntentRoute:
    """Definition of an intent route."""
    id: str
    name: str
    description: str
    category: str
    example_utterances: List[str]
    target_agent: str
    secondary_agents: List[str] = field(default_factory=list)
    required_capabilities: List[str] = field(default_factory=list)
    confidence_threshold: float = 0.75
    priority: int = 5
    is_active: bool = True
    embedding: Optional[List[float]] = None
    utterance_embeddings: Optional[List[List[float]]] = None


@dataclass
class KeywordRule:
    """Keyword-based routing fallback rule."""
    pattern: str
    pattern_type: str  # 'regex', 'exact', 'contains'
    target_agent: str
    priority: int = 5
    confidence_boost: float = 0.0
    compiled_pattern: Optional[re.Pattern] = None


@dataclass
class ContextOverride:
    """Context-aware routing override."""
    condition: Dict[str, Any]  # e.g., {"previous_agent": "hermes", "topic": "email"}
    target_agent: str
    priority: int = 10
    valid_duration_minutes: int = 60


@dataclass
class RoutingResult:
    """Result of a routing decision."""
    selected_agent: str
    confidence: float
    method: RoutingMethod
    matched_intent_id: Optional[str] = None
    matched_intent_name: Optional[str] = None
    alternative_agents: List[Dict[str, Any]] = field(default_factory=list)
    keyword_matched: bool = False
    context_override: bool = False
    routing_latency_ms: float = 0.0
    explanation: str = ""


@dataclass
class RoutingContext:
    """Context for routing decision."""
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    previous_agent: Optional[str] = None
    previous_intent: Optional[str] = None
    active_topic: Optional[str] = None
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    session_context: Dict[str, Any] = field(default_factory=dict)


class SemanticRouter:
    """
    Semantic Router for intelligent intent classification and agent routing.

    Features:
    - Embedding-based semantic similarity matching
    - Confidence scoring with thresholds
    - Keyword fallback for low-confidence matches
    - Context-aware routing overrides
    - A/B testing support
    - Analytics and logging
    - Circuit breaker for resilience
    """

    _instance: Optional['SemanticRouter'] = None

    def __new__(cls) -> 'SemanticRouter':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # Core components
        self.embedding_service: Optional[EmbeddingService] = None
        self.circuit_breaker = CircuitBreaker(
            name="semantic-router",
            failure_threshold=5,
            recovery_timeout=timedelta(seconds=30)
        )

        # Intent routes
        self._routes: Dict[str, IntentRoute] = {}
        self._route_embeddings: Dict[str, List[float]] = {}
        self._utterance_index: Dict[str, List[Tuple[str, List[float]]]] = {}  # intent_id -> [(utterance, embedding)]

        # Fallback rules
        self._keyword_rules: List[KeywordRule] = []
        self._context_overrides: List[ContextOverride] = []

        # Cache for recent embeddings
        self._embedding_cache: Dict[str, List[float]] = {}
        self._cache_ttl = timedelta(minutes=30)
        self._cache_timestamps: Dict[str, datetime] = {}

        # Configuration
        self.default_agent = "zeus"
        self.min_confidence_threshold = 0.5
        self.keyword_fallback_threshold = 0.65
        self.top_k_candidates = 5

        # Metrics
        self._total_routes = 0
        self._semantic_routes = 0
        self._keyword_routes = 0
        self._context_routes = 0
        self._fallback_routes = 0
        self._total_latency_ms = 0.0

        # Callbacks
        self._on_route_decision: Optional[Callable] = None

        self.logger = logger.bind(component="SemanticRouter")
        self._initialized = True

    async def initialize(
        self,
        embedding_service: Optional[EmbeddingService] = None
    ) -> None:
        """Initialize the semantic router."""
        self.logger.info("Initializing Semantic Router...")

        # Get or create embedding service
        self.embedding_service = embedding_service or await get_embedding_service()

        # Load built-in routes
        await self._load_default_routes()
        await self._load_default_keyword_rules()

        # Generate embeddings for all routes
        await self._generate_route_embeddings()

        self.logger.info(
            "Semantic Router initialized",
            routes=len(self._routes),
            keyword_rules=len(self._keyword_rules)
        )

    async def _load_default_routes(self) -> None:
        """Load default intent routes."""
        # Communication intents
        self._routes["email.send"] = IntentRoute(
            id="email.send",
            name="Send Email",
            description="Send a new email message",
            category="communication.email",
            example_utterances=[
                "send an email to",
                "compose email",
                "write an email",
                "email them about",
                "send a message to",
                "draft an email",
                "mail this to"
            ],
            target_agent="hermes"
        )

        self._routes["email.read"] = IntentRoute(
            id="email.read",
            name="Read Email",
            description="Check and read emails",
            category="communication.email",
            example_utterances=[
                "check my email",
                "read my inbox",
                "show me emails from",
                "any new emails",
                "what emails do I have",
                "check inbox"
            ],
            target_agent="hermes"
        )

        self._routes["email.reply"] = IntentRoute(
            id="email.reply",
            name="Reply to Email",
            description="Reply to an email",
            category="communication.email",
            example_utterances=[
                "reply to this email",
                "respond to",
                "answer this email",
                "write back to"
            ],
            target_agent="hermes"
        )

        self._routes["messaging.slack"] = IntentRoute(
            id="messaging.slack",
            name="Slack Message",
            description="Send Slack messages",
            category="communication.messaging",
            example_utterances=[
                "send slack message",
                "message on slack",
                "post in slack",
                "slack them",
                "send to slack channel"
            ],
            target_agent="hermes"
        )

        self._routes["messaging.teams"] = IntentRoute(
            id="messaging.teams",
            name="Teams Message",
            description="Send Microsoft Teams messages",
            category="communication.messaging",
            example_utterances=[
                "send teams message",
                "message on teams",
                "post in teams",
                "teams chat"
            ],
            target_agent="hermes"
        )

        # Calendar intents
        self._routes["calendar.create"] = IntentRoute(
            id="calendar.create",
            name="Create Event",
            description="Create calendar event",
            category="calendar.events",
            example_utterances=[
                "schedule a meeting",
                "create event",
                "add to calendar",
                "book a meeting",
                "set up a call",
                "schedule time for",
                "plan a meeting"
            ],
            target_agent="chronos",
            confidence_threshold=0.8
        )

        self._routes["calendar.view"] = IntentRoute(
            id="calendar.view",
            name="View Calendar",
            description="View calendar events",
            category="calendar.events",
            example_utterances=[
                "show my calendar",
                "what's on my calendar",
                "my schedule for",
                "what meetings do I have",
                "check my calendar"
            ],
            target_agent="chronos"
        )

        self._routes["calendar.availability"] = IntentRoute(
            id="calendar.availability",
            name="Check Availability",
            description="Check availability",
            category="calendar.availability",
            example_utterances=[
                "when am I free",
                "check my availability",
                "find a free slot",
                "when can we meet",
                "am I available on"
            ],
            target_agent="chronos"
        )

        self._routes["calendar.reschedule"] = IntentRoute(
            id="calendar.reschedule",
            name="Reschedule Event",
            description="Reschedule a calendar event",
            category="calendar.events",
            example_utterances=[
                "reschedule the meeting",
                "move the meeting",
                "change meeting time",
                "postpone the event"
            ],
            target_agent="chronos"
        )

        # Notification/Reminder intents
        self._routes["notify.reminder"] = IntentRoute(
            id="notify.reminder",
            name="Set Reminder",
            description="Set a reminder",
            category="communication.notifications",
            example_utterances=[
                "remind me to",
                "set a reminder",
                "don't let me forget",
                "reminder for"
            ],
            target_agent="chronos",
            secondary_agents=["iris"]
        )

        self._routes["notify.alert"] = IntentRoute(
            id="notify.alert",
            name="Send Alert",
            description="Send an alert or notification",
            category="communication.notifications",
            example_utterances=[
                "alert me when",
                "notify me about",
                "send notification",
                "let me know when"
            ],
            target_agent="iris"
        )

        # Knowledge/Search intents
        self._routes["search.general"] = IntentRoute(
            id="search.general",
            name="General Search",
            description="Search for information",
            category="knowledge.search",
            example_utterances=[
                "search for",
                "find information about",
                "look up",
                "what is",
                "tell me about",
                "explain"
            ],
            target_agent="athena",
            confidence_threshold=0.65
        )

        self._routes["search.documents"] = IntentRoute(
            id="search.documents",
            name="Search Documents",
            description="Search documents",
            category="knowledge.documents",
            example_utterances=[
                "find document",
                "search files for",
                "look in documents",
                "find the file about"
            ],
            target_agent="athena"
        )

        self._routes["documents.summarize"] = IntentRoute(
            id="documents.summarize",
            name="Summarize Document",
            description="Summarize a document",
            category="knowledge.documents",
            example_utterances=[
                "summarize this",
                "give me a summary",
                "what's the gist of",
                "TLDR",
                "brief summary of"
            ],
            target_agent="athena"
        )

        self._routes["memory.remember"] = IntentRoute(
            id="memory.remember",
            name="Remember Information",
            description="Store in memory",
            category="knowledge.memory",
            example_utterances=[
                "remember that",
                "save this",
                "note that",
                "keep in mind",
                "store this information"
            ],
            target_agent="memorix"
        )

        self._routes["memory.recall"] = IntentRoute(
            id="memory.recall",
            name="Recall Information",
            description="Retrieve from memory",
            category="knowledge.memory",
            example_utterances=[
                "what do you remember about",
                "recall",
                "what did I tell you about"
            ],
            target_agent="memorix"
        )

        # DevOps intents
        self._routes["code.review"] = IntentRoute(
            id="code.review",
            name="Code Review",
            description="Review code",
            category="devops.code",
            example_utterances=[
                "review this code",
                "code review for",
                "check this PR",
                "look at this pull request"
            ],
            target_agent="hephaestus"
        )

        self._routes["code.generate"] = IntentRoute(
            id="code.generate",
            name="Generate Code",
            description="Generate code",
            category="devops.code",
            example_utterances=[
                "write code for",
                "generate code",
                "create a function for",
                "implement",
                "code this"
            ],
            target_agent="hephaestus"
        )

        self._routes["deploy.trigger"] = IntentRoute(
            id="deploy.trigger",
            name="Trigger Deployment",
            description="Deploy application",
            category="devops.deployment",
            example_utterances=[
                "deploy to",
                "push to production",
                "release to",
                "deploy the app",
                "trigger deployment"
            ],
            target_agent="hephaestus",
            confidence_threshold=0.8,
            priority=6
        )

        self._routes["deploy.rollback"] = IntentRoute(
            id="deploy.rollback",
            name="Rollback Deployment",
            description="Rollback a deployment",
            category="devops.deployment",
            example_utterances=[
                "rollback the deployment",
                "revert to previous version",
                "undo deployment"
            ],
            target_agent="hephaestus",
            confidence_threshold=0.85,
            priority=7
        )

        self._routes["infra.status"] = IntentRoute(
            id="infra.status",
            name="Infrastructure Status",
            description="Check infra status",
            category="devops.infrastructure",
            example_utterances=[
                "server status",
                "infrastructure health",
                "check system status",
                "is everything running"
            ],
            target_agent="hephaestus"
        )

        # Analytics intents
        self._routes["analytics.report"] = IntentRoute(
            id="analytics.report",
            name="Generate Report",
            description="Generate analytics report",
            category="analytics.reports",
            example_utterances=[
                "generate a report",
                "create report for",
                "give me analytics",
                "show me the numbers"
            ],
            target_agent="nur_prometheus",
            secondary_agents=["athena"]
        )

        self._routes["analytics.metrics"] = IntentRoute(
            id="analytics.metrics",
            name="Get Metrics",
            description="Get specific metrics",
            category="analytics.reports",
            example_utterances=[
                "what are our metrics",
                "show me KPIs",
                "revenue numbers",
                "performance metrics"
            ],
            target_agent="nur_prometheus"
        )

        self._routes["analytics.chart"] = IntentRoute(
            id="analytics.chart",
            name="Create Chart",
            description="Create visualization",
            category="analytics.visualization",
            example_utterances=[
                "create a chart",
                "visualize this data",
                "make a graph",
                "plot this"
            ],
            target_agent="nur_prometheus"
        )

        self._routes["analytics.forecast"] = IntentRoute(
            id="analytics.forecast",
            name="Forecast",
            description="Generate forecast",
            category="analytics.reports",
            example_utterances=[
                "forecast for",
                "predict",
                "what will be",
                "projection for"
            ],
            target_agent="morpheus",
            secondary_agents=["nur_prometheus"]
        )

        # Finance intents
        self._routes["finance.payment"] = IntentRoute(
            id="finance.payment",
            name="Process Payment",
            description="Process a payment",
            category="finance.payments",
            example_utterances=[
                "process payment",
                "charge the customer",
                "create payment for",
                "bill them"
            ],
            target_agent="nur_prometheus",
            confidence_threshold=0.8,
            priority=6
        )

        self._routes["finance.refund"] = IntentRoute(
            id="finance.refund",
            name="Process Refund",
            description="Process a refund",
            category="finance.payments",
            example_utterances=[
                "process refund",
                "refund the payment",
                "give them a refund"
            ],
            target_agent="nur_prometheus",
            confidence_threshold=0.85,
            priority=7
        )

        # Security intents
        self._routes["security.scan"] = IntentRoute(
            id="security.scan",
            name="Security Scan",
            description="Run security scan",
            category="security.access",
            example_utterances=[
                "run security scan",
                "check for vulnerabilities",
                "security audit"
            ],
            target_agent="aegis",
            confidence_threshold=0.8,
            priority=7
        )

        self._routes["security.permissions"] = IntentRoute(
            id="security.permissions",
            name="Manage Permissions",
            description="Manage access permissions",
            category="security.access",
            example_utterances=[
                "grant access to",
                "revoke access",
                "change permissions",
                "who has access to"
            ],
            target_agent="aegis",
            priority=6
        )

        self._routes["security.incident"] = IntentRoute(
            id="security.incident",
            name="Report Incident",
            description="Report security incident",
            category="security.access",
            example_utterances=[
                "security incident",
                "report breach",
                "suspicious activity",
                "unauthorized access"
            ],
            target_agent="aegis",
            confidence_threshold=0.9,
            priority=8
        )

        # System intents
        self._routes["system.help"] = IntentRoute(
            id="system.help",
            name="Get Help",
            description="Request help",
            category="system.help",
            example_utterances=[
                "help me with",
                "how do I",
                "what can you do",
                "show me how to"
            ],
            target_agent="zeus",
            confidence_threshold=0.6,
            priority=3
        )

        self._routes["system.settings"] = IntentRoute(
            id="system.settings",
            name="Manage Settings",
            description="Manage settings",
            category="system.settings",
            example_utterances=[
                "change my settings",
                "update preferences",
                "configure"
            ],
            target_agent="hestia"
        )

        self._routes["task.create"] = IntentRoute(
            id="task.create",
            name="Create Task",
            description="Create a task",
            category="system.settings",
            example_utterances=[
                "create a task",
                "add todo",
                "new task for",
                "create ticket for"
            ],
            target_agent="zeus",
            secondary_agents=["hephaestus"]
        )

        self._routes["wellness.break"] = IntentRoute(
            id="wellness.break",
            name="Take Break",
            description="Break suggestions",
            category="system.settings",
            example_utterances=[
                "I need a break",
                "suggest a break",
                "time for a break"
            ],
            target_agent="hestia",
            priority=4
        )

    async def _load_default_keyword_rules(self) -> None:
        """Load default keyword fallback rules."""
        rules = [
            # Urgent patterns
            KeywordRule(
                pattern=r"(urgent|asap|emergency|critical)",
                pattern_type="regex",
                target_agent="iris",
                priority=10,
                confidence_boost=0.15
            ),
            # Email patterns
            KeywordRule(
                pattern=r"(email|mail|inbox|smtp|imap)",
                pattern_type="regex",
                target_agent="hermes",
                priority=5,
                confidence_boost=0.10
            ),
            KeywordRule(
                pattern=r"@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                pattern_type="regex",
                target_agent="hermes",
                priority=5,
                confidence_boost=0.10
            ),
            # Calendar patterns
            KeywordRule(
                pattern=r"(calendar|meeting|schedule|appointment|availability)",
                pattern_type="regex",
                target_agent="chronos",
                priority=5,
                confidence_boost=0.10
            ),
            KeywordRule(
                pattern=r"(tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
                pattern_type="regex",
                target_agent="chronos",
                priority=3,
                confidence_boost=0.05
            ),
            # Code patterns
            KeywordRule(
                pattern=r"(code|function|class|deploy|git|github|PR|pull request|commit)",
                pattern_type="regex",
                target_agent="hephaestus",
                priority=5,
                confidence_boost=0.10
            ),
            KeywordRule(
                pattern="```",
                pattern_type="contains",
                target_agent="hephaestus",
                priority=3,
                confidence_boost=0.05
            ),
            # Security patterns
            KeywordRule(
                pattern=r"(security|permission|access|audit|vulnerability|threat)",
                pattern_type="regex",
                target_agent="aegis",
                priority=6,
                confidence_boost=0.12
            ),
            KeywordRule(
                pattern=r"(password|credential|secret|token|api.?key)",
                pattern_type="regex",
                target_agent="aegis",
                priority=7,
                confidence_boost=0.15
            ),
            # Finance patterns
            KeywordRule(
                pattern=r"(payment|refund|invoice|billing|charge|subscription)",
                pattern_type="regex",
                target_agent="nur_prometheus",
                priority=5,
                confidence_boost=0.10
            ),
            KeywordRule(
                pattern=r"\$[0-9]+",
                pattern_type="regex",
                target_agent="nur_prometheus",
                priority=3,
                confidence_boost=0.05
            ),
            # Analytics patterns
            KeywordRule(
                pattern=r"(report|analytics|metrics|dashboard|chart|graph)",
                pattern_type="regex",
                target_agent="nur_prometheus",
                priority=5,
                confidence_boost=0.10
            ),
        ]

        # Compile regex patterns
        for rule in rules:
            if rule.pattern_type == "regex":
                try:
                    rule.compiled_pattern = re.compile(rule.pattern, re.IGNORECASE)
                except re.error as e:
                    self.logger.warning(f"Invalid regex pattern: {rule.pattern}", error=str(e))

        self._keyword_rules = rules

    async def _generate_route_embeddings(self) -> None:
        """Generate embeddings for all route definitions."""
        if not self.embedding_service:
            self.logger.warning("No embedding service available")
            return

        self.logger.info("Generating embeddings for route definitions...")

        for intent_id, route in self._routes.items():
            if not route.is_active:
                continue

            try:
                # Generate embedding for the intent description
                combined_text = f"{route.name}: {route.description}"
                result = await self.embedding_service.embed(combined_text)
                route.embedding = result.embedding
                self._route_embeddings[intent_id] = result.embedding

                # Generate embeddings for all example utterances
                if route.example_utterances:
                    batch_result = await self.embedding_service.embed_batch(
                        route.example_utterances
                    )
                    route.utterance_embeddings = batch_result.embeddings

                    # Build utterance index
                    self._utterance_index[intent_id] = list(zip(
                        route.example_utterances,
                        batch_result.embeddings
                    ))

            except Exception as e:
                self.logger.warning(
                    f"Failed to generate embedding for route {intent_id}",
                    error=str(e)
                )

        self.logger.info(
            "Route embeddings generated",
            routes=len(self._route_embeddings),
            total_utterances=sum(len(v) for v in self._utterance_index.values())
        )

    async def route(
        self,
        input_text: str,
        context: Optional[RoutingContext] = None
    ) -> RoutingResult:
        """
        Route input text to the appropriate agent.

        Args:
            input_text: User input text
            context: Optional routing context

        Returns:
            RoutingResult with selected agent and metadata
        """
        start_time = time.perf_counter()
        self._total_routes += 1

        context = context or RoutingContext()

        # Check circuit breaker
        if self.circuit_breaker.state == CircuitState.OPEN:
            self.logger.warning("Circuit breaker open, using fallback routing")
            return self._fallback_route(input_text, start_time)

        try:
            # Step 1: Check context overrides first
            context_result = self._check_context_overrides(input_text, context)
            if context_result:
                self._context_routes += 1
                context_result.routing_latency_ms = (time.perf_counter() - start_time) * 1000
                self._record_route(context_result)
                return context_result

            # Step 2: Semantic similarity matching
            semantic_result = await self._semantic_match(input_text)

            # Step 3: Apply keyword boosting
            keyword_result = self._keyword_match(input_text)

            # Step 4: Combine results and decide
            final_result = self._combine_results(
                input_text,
                semantic_result,
                keyword_result,
                context
            )

            final_result.routing_latency_ms = (time.perf_counter() - start_time) * 1000
            self._total_latency_ms += final_result.routing_latency_ms

            # Record metrics
            if final_result.method == RoutingMethod.SEMANTIC:
                self._semantic_routes += 1
            elif final_result.method == RoutingMethod.KEYWORD:
                self._keyword_routes += 1
            else:
                self._fallback_routes += 1

            self._record_route(final_result)
            self.circuit_breaker.record_success()

            return final_result

        except Exception as e:
            self.logger.error("Routing failed", error=str(e))
            self.circuit_breaker.record_failure()
            return self._fallback_route(input_text, start_time)

    async def _semantic_match(
        self,
        input_text: str
    ) -> Tuple[Optional[str], float, List[Tuple[str, float]]]:
        """
        Find best matching intent using embedding similarity.

        Returns:
            Tuple of (best_intent_id, confidence, all_candidates)
        """
        if not self.embedding_service or not self._route_embeddings:
            return None, 0.0, []

        # Generate embedding for input
        result = await self.embedding_service.embed(input_text)
        query_embedding = result.embedding

        # Find similar intents using route embeddings
        route_similarities = []
        for intent_id, route_embedding in self._route_embeddings.items():
            similarity = self.embedding_service.cosine_similarity(
                query_embedding,
                route_embedding
            )
            route_similarities.append((intent_id, similarity))

        # Also search utterance embeddings for better precision
        utterance_similarities = []
        for intent_id, utterances in self._utterance_index.items():
            for utterance_text, utterance_embedding in utterances:
                similarity = self.embedding_service.cosine_similarity(
                    query_embedding,
                    utterance_embedding
                )
                utterance_similarities.append((intent_id, similarity))

        # Combine scores (utterance match weighted higher)
        intent_scores: Dict[str, List[float]] = {}

        for intent_id, sim in route_similarities:
            intent_scores.setdefault(intent_id, []).append(sim * 0.7)  # Route weight

        for intent_id, sim in utterance_similarities:
            intent_scores.setdefault(intent_id, []).append(sim)  # Full weight

        # Calculate final scores (max of combined scores)
        final_scores = [
            (intent_id, max(scores))
            for intent_id, scores in intent_scores.items()
        ]

        # Sort by score
        final_scores.sort(key=lambda x: x[1], reverse=True)

        if not final_scores:
            return None, 0.0, []

        best_intent_id, best_score = final_scores[0]

        # Return top candidates
        return best_intent_id, best_score, final_scores[:self.top_k_candidates]

    def _keyword_match(
        self,
        input_text: str
    ) -> Optional[Tuple[str, float]]:
        """
        Apply keyword rules to boost or determine routing.

        Returns:
            Tuple of (agent, confidence_boost) if matched
        """
        matched_rules: List[Tuple[KeywordRule, float]] = []

        for rule in self._keyword_rules:
            if not rule.compiled_pattern and rule.pattern_type == "regex":
                continue

            matched = False
            if rule.pattern_type == "regex" and rule.compiled_pattern:
                matched = bool(rule.compiled_pattern.search(input_text))
            elif rule.pattern_type == "exact":
                matched = rule.pattern.lower() == input_text.lower()
            elif rule.pattern_type == "contains":
                matched = rule.pattern.lower() in input_text.lower()

            if matched:
                matched_rules.append((rule, rule.confidence_boost))

        if not matched_rules:
            return None

        # Return highest priority match
        matched_rules.sort(key=lambda x: x[0].priority, reverse=True)
        best_rule = matched_rules[0][0]

        # Calculate combined boost from all matches for this agent
        total_boost = sum(
            rule.confidence_boost
            for rule, _ in matched_rules
            if rule.target_agent == best_rule.target_agent
        )

        return (best_rule.target_agent, min(total_boost, 0.3))

    def _check_context_overrides(
        self,
        input_text: str,
        context: RoutingContext
    ) -> Optional[RoutingResult]:
        """Check for context-based routing overrides."""
        for override in self._context_overrides:
            if self._matches_context_condition(override.condition, context):
                return RoutingResult(
                    selected_agent=override.target_agent,
                    confidence=1.0,
                    method=RoutingMethod.CONTEXT,
                    context_override=True,
                    explanation=f"Context override: {override.condition}"
                )

        # Special case: continue with previous agent for follow-up
        if context.previous_agent and self._is_followup_query(input_text):
            return RoutingResult(
                selected_agent=context.previous_agent,
                confidence=0.9,
                method=RoutingMethod.CONTEXT,
                context_override=True,
                explanation=f"Follow-up to previous {context.previous_agent} interaction"
            )

        return None

    def _matches_context_condition(
        self,
        condition: Dict[str, Any],
        context: RoutingContext
    ) -> bool:
        """Check if context matches override condition."""
        for key, value in condition.items():
            if key == "previous_agent" and context.previous_agent != value:
                return False
            if key == "topic" and context.active_topic != value:
                return False
            if key == "previous_intent" and context.previous_intent != value:
                return False
        return True

    def _is_followup_query(self, input_text: str) -> bool:
        """Detect if input is a follow-up to previous context."""
        followup_indicators = [
            r"^(yes|no|ok|okay|sure|please|thanks)",
            r"^(and|also|what about|how about)",
            r"^(this|that|it|they|them|those)",
            r"^(more|another|next|continue)",
        ]

        text_lower = input_text.lower().strip()
        for pattern in followup_indicators:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return True

        # Short inputs (less than 4 words) are likely follow-ups
        if len(text_lower.split()) <= 3:
            return True

        return False

    def _combine_results(
        self,
        input_text: str,
        semantic_result: Tuple[Optional[str], float, List[Tuple[str, float]]],
        keyword_result: Optional[Tuple[str, float]],
        context: RoutingContext
    ) -> RoutingResult:
        """Combine semantic and keyword results into final routing decision."""
        best_intent_id, semantic_confidence, candidates = semantic_result

        # Get route info
        route = self._routes.get(best_intent_id) if best_intent_id else None

        # Apply keyword boost
        final_confidence = semantic_confidence
        keyword_matched = False

        if keyword_result:
            keyword_agent, keyword_boost = keyword_result
            keyword_matched = True

            # If keyword suggests same agent, boost confidence
            if route and route.target_agent == keyword_agent:
                final_confidence = min(semantic_confidence + keyword_boost, 1.0)
            # If semantic confidence is low, prefer keyword match
            elif semantic_confidence < self.keyword_fallback_threshold:
                if keyword_boost > 0:
                    return RoutingResult(
                        selected_agent=keyword_agent,
                        confidence=0.6 + keyword_boost,
                        method=RoutingMethod.KEYWORD,
                        keyword_matched=True,
                        alternative_agents=[
                            {"agent": route.target_agent, "confidence": semantic_confidence}
                            for intent_id, conf in candidates[:3]
                            if (route := self._routes.get(intent_id))
                        ],
                        explanation=f"Keyword match for '{keyword_agent}' with boost {keyword_boost}"
                    )

        # Check if we have a confident semantic match
        threshold = route.confidence_threshold if route else self.min_confidence_threshold

        if route and final_confidence >= threshold:
            return RoutingResult(
                selected_agent=route.target_agent,
                confidence=final_confidence,
                method=RoutingMethod.SEMANTIC,
                matched_intent_id=best_intent_id,
                matched_intent_name=route.name,
                keyword_matched=keyword_matched,
                alternative_agents=[
                    {"agent": self._routes[intent_id].target_agent, "confidence": conf}
                    for intent_id, conf in candidates[1:4]
                    if intent_id in self._routes
                ],
                explanation=f"Semantic match: {route.name} ({final_confidence:.2%})"
            )

        # Low confidence - fall back to default or keyword
        if keyword_result and keyword_result[1] > 0:
            return RoutingResult(
                selected_agent=keyword_result[0],
                confidence=0.5 + keyword_result[1],
                method=RoutingMethod.KEYWORD,
                keyword_matched=True,
                explanation="Low semantic confidence, using keyword fallback"
            )

        # Ultimate fallback
        return RoutingResult(
            selected_agent=self.default_agent,
            confidence=0.3,
            method=RoutingMethod.FALLBACK,
            explanation="No confident match found, routing to default agent"
        )

    def _fallback_route(
        self,
        input_text: str,
        start_time: float
    ) -> RoutingResult:
        """Fallback routing when semantic matching fails."""
        self._fallback_routes += 1

        # Try keyword matching only
        keyword_result = self._keyword_match(input_text)

        if keyword_result:
            return RoutingResult(
                selected_agent=keyword_result[0],
                confidence=0.5 + keyword_result[1],
                method=RoutingMethod.KEYWORD,
                keyword_matched=True,
                routing_latency_ms=(time.perf_counter() - start_time) * 1000,
                explanation="Semantic routing unavailable, using keyword fallback"
            )

        return RoutingResult(
            selected_agent=self.default_agent,
            confidence=0.3,
            method=RoutingMethod.FALLBACK,
            routing_latency_ms=(time.perf_counter() - start_time) * 1000,
            explanation="All routing methods failed, using default agent"
        )

    def _record_route(self, result: RoutingResult) -> None:
        """Record routing decision for analytics."""
        if self._on_route_decision:
            try:
                self._on_route_decision(result)
            except Exception as e:
                self.logger.warning("Route callback failed", error=str(e))

    # =========================================================================
    # Route Management
    # =========================================================================

    def add_route(self, route: IntentRoute) -> None:
        """Add a new intent route."""
        self._routes[route.id] = route
        self.logger.info(f"Added route: {route.id}")

    def remove_route(self, intent_id: str) -> bool:
        """Remove an intent route."""
        if intent_id in self._routes:
            del self._routes[intent_id]
            self._route_embeddings.pop(intent_id, None)
            self._utterance_index.pop(intent_id, None)
            self.logger.info(f"Removed route: {intent_id}")
            return True
        return False

    def disable_route(self, intent_id: str) -> bool:
        """Disable an intent route."""
        if intent_id in self._routes:
            self._routes[intent_id].is_active = False
            return True
        return False

    def enable_route(self, intent_id: str) -> bool:
        """Enable an intent route."""
        if intent_id in self._routes:
            self._routes[intent_id].is_active = True
            return True
        return False

    def add_keyword_rule(self, rule: KeywordRule) -> None:
        """Add a keyword fallback rule."""
        if rule.pattern_type == "regex":
            rule.compiled_pattern = re.compile(rule.pattern, re.IGNORECASE)
        self._keyword_rules.append(rule)

    def add_context_override(self, override: ContextOverride) -> None:
        """Add a context-aware routing override."""
        self._context_overrides.append(override)
        # Sort by priority
        self._context_overrides.sort(key=lambda x: x.priority, reverse=True)

    def set_route_callback(
        self,
        callback: Callable[[RoutingResult], None]
    ) -> None:
        """Set callback for route decisions."""
        self._on_route_decision = callback

    # =========================================================================
    # Metrics and Monitoring
    # =========================================================================

    def get_metrics(self) -> Dict[str, Any]:
        """Get routing metrics."""
        total = self._total_routes or 1  # Avoid division by zero

        return {
            "total_routes": self._total_routes,
            "semantic_routes": self._semantic_routes,
            "keyword_routes": self._keyword_routes,
            "context_routes": self._context_routes,
            "fallback_routes": self._fallback_routes,
            "semantic_rate": self._semantic_routes / total,
            "keyword_rate": self._keyword_routes / total,
            "fallback_rate": self._fallback_routes / total,
            "avg_latency_ms": self._total_latency_ms / total,
            "circuit_breaker": self.circuit_breaker.get_status(),
            "routes_count": len(self._routes),
            "active_routes": sum(1 for r in self._routes.values() if r.is_active),
            "keyword_rules": len(self._keyword_rules),
            "context_overrides": len(self._context_overrides)
        }

    def get_routes_by_agent(self, agent: str) -> List[IntentRoute]:
        """Get all routes for a specific agent."""
        return [
            route for route in self._routes.values()
            if route.target_agent == agent and route.is_active
        ]

    def get_all_routes(self) -> List[IntentRoute]:
        """Get all routes."""
        return list(self._routes.values())


# Singleton accessor
_router: Optional[SemanticRouter] = None


async def get_semantic_router() -> SemanticRouter:
    """Get the global semantic router instance."""
    global _router
    if _router is None:
        _router = SemanticRouter()
        await _router.initialize()
    return _router
