"""
KOSMOS V2.0 MEMORIX Agent - Memory & Knowledge Management

MEMORIX handles all memory and knowledge operations including
episodic, semantic, procedural, and working memory management.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import math

import structlog
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage

from .base import BaseAgent, AgentConfig, AgentMessage

logger = structlog.get_logger()


class MemoryType(str, Enum):
    """Types of memory."""
    EPISODIC = "episodic"      # What happened (events, conversations)
    SEMANTIC = "semantic"      # Facts and knowledge
    PROCEDURAL = "procedural"  # How to do things
    WORKING = "working"        # Short-term active context


class DecayAlgorithm(str, Enum):
    """Memory decay algorithms."""
    EXPONENTIAL = "exponential"  # Fast initial decay
    POWER_LAW = "power_law"      # Slow decay, long tail
    NONE = "none"                # No decay (permanent)


@dataclass
class MemoryEntry:
    """A memory entry."""
    id: str = ""
    type: MemoryType = MemoryType.EPISODIC
    content: str = ""
    embedding: Optional[List[float]] = None
    importance: float = 0.5  # 0-1 scale
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    decay_algorithm: DecayAlgorithm = DecayAlgorithm.EXPONENTIAL
    associations: List[str] = field(default_factory=list)  # Related memory IDs


@dataclass
class MemoryQuery:
    """Query for memory retrieval."""
    query: str = ""
    memory_types: List[MemoryType] = field(default_factory=list)
    limit: int = 10
    min_relevance: float = 0.5
    include_decayed: bool = False
    time_window: Optional[timedelta] = None


@dataclass
class MemorixState:
    """State for MEMORIX memory workflow."""
    messages: List[BaseMessage] = field(default_factory=list)
    operation: str = ""  # store, retrieve, forget, consolidate
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    memory_entry: Optional[MemoryEntry] = None
    query: Optional[MemoryQuery] = None
    retrieved_memories: List[MemoryEntry] = field(default_factory=list)
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class MemorixAgent(BaseAgent):
    """
    MEMORIX - Memory & Knowledge Management Agent

    Responsibilities:
    - Store and retrieve memories across 4 types
    - Manage memory decay and consolidation
    - Handle Amnesia Protocol (GDPR compliance)
    - Create and maintain knowledge graphs
    - Support RAG operations
    - Manage conversation context
    """

    # Memory decay parameters
    DECAY_PARAMS = {
        DecayAlgorithm.EXPONENTIAL: {"half_life_days": 7},
        DecayAlgorithm.POWER_LAW: {"exponent": 0.5},
        DecayAlgorithm.NONE: {},
    }

    def __init__(self):
        config = AgentConfig(
            id="memorix",
            name="MEMORIX",
            domain="memory",
            description="Memory and knowledge management agent for all memory operations",
            tools=["store_memory", "retrieve_memory", "forget_memory", "consolidate"],
            mcp_servers=["memory-server", "mcp-postgres"],
            pentarchy_voter=False,
            security_veto=False,
            max_iterations=10,
            timeout_seconds=60,
        )
        super().__init__(config)

    async def _build_graph(self) -> StateGraph:
        """Build MEMORIX memory workflow."""
        workflow = StateGraph(MemorixState)

        # Add nodes
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("store_memory", self._store_memory)
        workflow.add_node("retrieve_memory", self._retrieve_memory)
        workflow.add_node("forget_memory", self._forget_memory)
        workflow.add_node("consolidate_memory", self._consolidate_memory)
        workflow.add_node("apply_decay", self._apply_decay)
        workflow.add_node("prepare_output", self._prepare_output)

        # Set entry point
        workflow.set_entry_point("parse_request")

        # Add conditional routing
        workflow.add_conditional_edges(
            "parse_request",
            self._route_operation,
            {
                "store": "store_memory",
                "retrieve": "retrieve_memory",
                "forget": "forget_memory",
                "consolidate": "consolidate_memory",
            }
        )

        workflow.add_edge("store_memory", "prepare_output")
        workflow.add_edge("retrieve_memory", "apply_decay")
        workflow.add_edge("apply_decay", "prepare_output")
        workflow.add_edge("forget_memory", "prepare_output")
        workflow.add_edge("consolidate_memory", "prepare_output")
        workflow.add_edge("prepare_output", END)

        return workflow.compile()

    def _route_operation(self, state: MemorixState) -> str:
        """Route to appropriate operation handler."""
        return state.operation if state.operation in ["store", "retrieve", "forget", "consolidate"] else "retrieve"

    async def process(self, message: AgentMessage) -> Dict[str, Any]:
        """Process memory request."""
        self.logger.info("Processing memory request", trace_id=message.trace_id)

        state = MemorixState(
            operation=message.payload.get("operation", "retrieve"),
            user_id=message.context.get("user_id"),
            conversation_id=message.context.get("conversation_id"),
        )

        # Parse memory entry if storing
        if state.operation == "store":
            entry_data = message.payload.get("memory", {})
            state.memory_entry = MemoryEntry(
                id=entry_data.get("id", f"mem_{datetime.utcnow().timestamp()}"),
                type=MemoryType(entry_data.get("type", "episodic")),
                content=entry_data.get("content", ""),
                importance=entry_data.get("importance", 0.5),
                metadata=entry_data.get("metadata", {}),
            )

        # Parse query if retrieving
        if state.operation == "retrieve":
            query_data = message.payload.get("query", {})
            state.query = MemoryQuery(
                query=query_data.get("query", ""),
                memory_types=[MemoryType(t) for t in query_data.get("types", [])],
                limit=query_data.get("limit", 10),
                min_relevance=query_data.get("min_relevance", 0.5),
            )

        try:
            if self._graph:
                final_state = await self._graph.ainvoke(state)
                return {
                    "success": final_state.error is None,
                    "result": final_state.output,
                    "summary": self._create_summary(final_state),
                    "error": final_state.error,
                }
        except Exception as e:
            self.logger.error("Memory operation failed", error=str(e))
            return {"success": False, "error": str(e)}

        return {"success": False, "error": "Workflow not initialized"}

    def _create_summary(self, state: MemorixState) -> str:
        """Create summary of memory operation."""
        if state.operation == "store":
            return f"Stored memory: {state.memory_entry.id if state.memory_entry else 'unknown'}"
        elif state.operation == "retrieve":
            return f"Retrieved {len(state.retrieved_memories)} memories"
        elif state.operation == "forget":
            return "Memory forgotten (Amnesia Protocol)"
        return "Memory operation completed"

    # =========================================================================
    # Workflow Nodes
    # =========================================================================

    async def _parse_request(self, state: MemorixState) -> MemorixState:
        """Parse the memory request."""
        self.logger.info("Parsing request...", operation=state.operation)
        return state

    async def _store_memory(self, state: MemorixState) -> MemorixState:
        """Store a memory entry."""
        self.logger.info("Storing memory...")

        if not state.memory_entry:
            state.error = "No memory entry provided"
            return state

        # Generate embedding for semantic search
        state.memory_entry.embedding = await self._generate_embedding(
            state.memory_entry.content
        )

        # Find associations with existing memories
        state.memory_entry.associations = await self._find_associations(
            state.memory_entry
        )

        # Store in memory server via MCP
        try:
            if "memory-server" in self.mcp_clients:
                await self.call_mcp(
                    server="memory-server",
                    tool="store",
                    params={
                        "id": state.memory_entry.id,
                        "type": state.memory_entry.type.value,
                        "content": state.memory_entry.content,
                        "embedding": state.memory_entry.embedding,
                        "importance": state.memory_entry.importance,
                        "metadata": state.memory_entry.metadata,
                    }
                )
        except Exception as e:
            self.logger.warning("MCP store failed, using fallback", error=str(e))

        # Emit storage event
        await self.emit_event("memorix.memory_stored", {
            "memory_id": state.memory_entry.id,
            "type": state.memory_entry.type.value,
            "user_id": state.user_id,
        })

        return state

    async def _retrieve_memory(self, state: MemorixState) -> MemorixState:
        """Retrieve memories based on query."""
        self.logger.info("Retrieving memories...")

        if not state.query:
            state.error = "No query provided"
            return state

        # Generate query embedding
        query_embedding = await self._generate_embedding(state.query.query)

        # Retrieve from memory server via MCP
        try:
            if "memory-server" in self.mcp_clients:
                results = await self.call_mcp(
                    server="memory-server",
                    tool="retrieve",
                    params={
                        "query_embedding": query_embedding,
                        "types": [t.value for t in state.query.memory_types],
                        "limit": state.query.limit,
                        "min_relevance": state.query.min_relevance,
                    }
                )

                for result in results:
                    state.retrieved_memories.append(MemoryEntry(
                        id=result.get("id", ""),
                        type=MemoryType(result.get("type", "episodic")),
                        content=result.get("content", ""),
                        importance=result.get("importance", 0.5),
                        access_count=result.get("access_count", 0) + 1,
                        last_accessed=datetime.utcnow(),
                        metadata=result.get("metadata", {}),
                    ))
        except Exception as e:
            self.logger.warning("MCP retrieve failed", error=str(e))

        return state

    async def _apply_decay(self, state: MemorixState) -> MemorixState:
        """Apply memory decay to retrieved memories."""
        self.logger.info("Applying memory decay...")

        now = datetime.utcnow()

        for memory in state.retrieved_memories:
            age_days = (now - memory.created_at).days
            decay_factor = self._calculate_decay(
                memory.decay_algorithm,
                age_days,
                memory.access_count
            )

            # Adjust importance based on decay
            memory.importance *= decay_factor

        # Sort by adjusted importance
        state.retrieved_memories.sort(key=lambda m: m.importance, reverse=True)

        return state

    def _calculate_decay(
        self,
        algorithm: DecayAlgorithm,
        age_days: int,
        access_count: int,
    ) -> float:
        """Calculate decay factor for a memory."""
        if algorithm == DecayAlgorithm.NONE:
            return 1.0

        # Access boost (more access = slower decay)
        access_boost = min(1.0 + (access_count * 0.1), 2.0)

        if algorithm == DecayAlgorithm.EXPONENTIAL:
            half_life = self.DECAY_PARAMS[algorithm]["half_life_days"]
            decay = math.exp(-0.693 * age_days / half_life) * access_boost
        elif algorithm == DecayAlgorithm.POWER_LAW:
            exponent = self.DECAY_PARAMS[algorithm]["exponent"]
            decay = (1 + age_days) ** (-exponent) * access_boost
        else:
            decay = 1.0

        return min(decay, 1.0)

    async def _forget_memory(self, state: MemorixState) -> MemorixState:
        """Forget a memory (Amnesia Protocol / GDPR)."""
        self.logger.info("Executing Amnesia Protocol...")

        if not state.memory_entry:
            state.error = "No memory specified for deletion"
            return state

        # Delete from memory server
        try:
            if "memory-server" in self.mcp_clients:
                await self.call_mcp(
                    server="memory-server",
                    tool="delete",
                    params={"id": state.memory_entry.id}
                )
        except Exception as e:
            self.logger.warning("MCP delete failed", error=str(e))

        # Emit deletion event for audit
        await self.emit_event("memorix.memory_forgotten", {
            "memory_id": state.memory_entry.id,
            "user_id": state.user_id,
            "reason": "amnesia_protocol",
            "timestamp": datetime.utcnow().isoformat(),
        })

        return state

    async def _consolidate_memory(self, state: MemorixState) -> MemorixState:
        """Consolidate memories (episodic -> semantic)."""
        self.logger.info("Consolidating memories...")

        # Retrieve episodic memories for consolidation
        state.query = MemoryQuery(
            query="",
            memory_types=[MemoryType.EPISODIC],
            limit=100,
            include_decayed=False,
        )

        await self._retrieve_memory(state)

        # Group related memories
        clusters = await self._cluster_memories(state.retrieved_memories)

        # Create semantic memories from clusters
        for cluster in clusters:
            if len(cluster) >= 3:  # Minimum cluster size
                semantic_content = await self._synthesize_semantic(cluster)

                semantic_memory = MemoryEntry(
                    id=f"sem_{datetime.utcnow().timestamp()}",
                    type=MemoryType.SEMANTIC,
                    content=semantic_content,
                    importance=0.7,
                    decay_algorithm=DecayAlgorithm.POWER_LAW,
                    associations=[m.id for m in cluster],
                )

                # Store semantic memory
                state.memory_entry = semantic_memory
                await self._store_memory(state)

        return state

    async def _prepare_output(self, state: MemorixState) -> MemorixState:
        """Prepare final output."""
        self.logger.info("Preparing output...")

        output = {
            "operation": state.operation,
            "user_id": state.user_id,
        }

        if state.memory_entry:
            output["memory"] = {
                "id": state.memory_entry.id,
                "type": state.memory_entry.type.value,
                "content": state.memory_entry.content,
                "importance": state.memory_entry.importance,
            }

        if state.retrieved_memories:
            output["memories"] = [
                {
                    "id": m.id,
                    "type": m.type.value,
                    "content": m.content,
                    "importance": m.importance,
                    "access_count": m.access_count,
                }
                for m in state.retrieved_memories
            ]

        state.output = output
        return state

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text."""
        # Would use embedding model (e.g., via LiteLLM)
        # Returning placeholder
        return [0.0] * 1536

    async def _find_associations(self, memory: MemoryEntry) -> List[str]:
        """Find associated memories."""
        # Would use vector similarity search
        return []

    async def _cluster_memories(
        self,
        memories: List[MemoryEntry]
    ) -> List[List[MemoryEntry]]:
        """Cluster related memories."""
        # Would use clustering algorithm
        return [memories]

    async def _synthesize_semantic(
        self,
        memories: List[MemoryEntry]
    ) -> str:
        """Synthesize semantic knowledge from episodic memories."""
        # Would use LLM to extract facts
        contents = [m.content for m in memories]
        return f"Synthesized from {len(memories)} memories: " + " | ".join(contents[:3])
