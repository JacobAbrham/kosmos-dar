"""
KOSMOS DAR Model Router with Complexity-Based Cascading

Routes LLM requests to appropriate models based on complexity:
- Simple: Classification, extraction, simple Q&A → Claude Haiku / GPT-4o-mini
- Standard: Analysis, reasoning, multi-step → Claude Sonnet / GPT-4o-mini  
- Complex: Deep reasoning, code generation, planning → Claude Opus / GPT-4

Implements fallback chains for resilience and cost optimization.
"""

import re
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import structlog
from pydantic import BaseModel, Field

from services.llm_service import LLMRequest, LLMResponse, get_llm_service

logger = structlog.get_logger()


# ============================================================================
# TYPES
# ============================================================================

class QueryComplexity(str, Enum):
    """Query complexity levels for model routing."""
    SIMPLE = "simple"      # Classification, extraction, simple Q&A
    STANDARD = "standard"  # Analysis, reasoning, multi-step
    COMPLEX = "complex"    # Deep reasoning, code generation, planning


class ModelTier(str, Enum):
    """Model tiers for routing."""
    TIER_1 = "tier_1"  # Fastest, cheapest (Haiku, GPT-4o-mini)
    TIER_2 = "tier_2"  # Balanced (Sonnet, GPT-4o-mini)
    TIER_3 = "tier_3"  # Most capable (Opus, GPT-4)


class RoutingDecision(BaseModel):
    """Model routing decision."""
    complexity: QueryComplexity
    primary_model: str
    fallback_models: List[str] = Field(default_factory=list)
    reason: str
    estimated_cost_usd: float = 0.0


# ============================================================================
# COMPLEXITY CLASSIFIER
# ============================================================================

class ComplexityClassifier:
    """Classifies query complexity based on heuristics and patterns."""
    
    # Simple query indicators
    SIMPLE_PATTERNS = [
        r'\b(what|when|where|who|which|how many|how much)\b',
        r'\b(classify|extract|list|find|search|lookup)\b',
        r'\b(yes|no|true|false|is|are|does|do|can|could)\b',
        r'\b(simple|quick|fast|basic|easy)\b',
    ]
    
    # Complex query indicators
    COMPLEX_PATTERNS = [
        r'\b(analyze|reason|explain|plan|design|architect|refactor|optimize)\b',
        r'\b(why|how|create|generate|build|implement|develop|write code)\b',
        r'\b(multi-step|multiple|several|complex|advanced|sophisticated)\b',
        r'\b(compare|evaluate|assess|critique|review|improve)\b',
        r'\b(algorithm|architecture|system|framework|pattern)\b',
    ]
    
    # Code generation indicators (always complex)
    CODE_PATTERNS = [
        r'\b(write|create|generate|implement|code|function|class|module)\b.*\b(code|script|program|application)\b',
        r'```.*```',
        r'<code>.*</code>',
        r'\bdef |\bfunction |\bclass |\bimport |\bfrom ',
    ]
    
    def __init__(self):
        self.simple_regex = [re.compile(p, re.IGNORECASE) for p in self.SIMPLE_PATTERNS]
        self.complex_regex = [re.compile(p, re.IGNORECASE) for p in self.COMPLEX_PATTERNS]
        self.code_regex = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in self.CODE_PATTERNS]
    
    def classify(
        self,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> QueryComplexity:
        """
        Classify query complexity.
        
        Args:
            messages: Chat messages
            metadata: Optional metadata (e.g., intent, agent_id)
        
        Returns:
            Query complexity level
        """
        # Extract user message text
        user_messages = [msg.get("content", "") for msg in messages if msg.get("role") == "user"]
        text = " ".join(user_messages).lower()
        
        # Check for code generation (always complex)
        for pattern in self.code_regex:
            if pattern.search(text):
                logger.debug("Complexity: COMPLEX (code generation)", text_preview=text[:100])
                return QueryComplexity.COMPLEX
        
        # Check metadata hints
        if metadata:
            if metadata.get("complexity") == "complex":
                return QueryComplexity.COMPLEX
            if metadata.get("complexity") == "simple":
                return QueryComplexity.SIMPLE
            if metadata.get("intent") in ["code_generation", "planning", "analysis"]:
                return QueryComplexity.COMPLEX
        
        # Count pattern matches
        simple_matches = sum(1 for pattern in self.simple_regex if pattern.search(text))
        complex_matches = sum(1 for pattern in self.complex_regex if pattern.search(text))
        
        # Length heuristic
        text_length = len(text)
        if text_length > 2000:
            complex_matches += 1
        elif text_length < 50:
            simple_matches += 1
        
        # Token count heuristic (if available)
        if metadata and metadata.get("estimated_tokens"):
            tokens = metadata.get("estimated_tokens", 0)
            if tokens > 4000:
                complex_matches += 1
            elif tokens < 200:
                simple_matches += 1
        
        # Decision logic
        if complex_matches > simple_matches and complex_matches >= 2:
            logger.debug("Complexity: COMPLEX", simple=simple_matches, complex=complex_matches)
            return QueryComplexity.COMPLEX
        elif simple_matches > complex_matches and simple_matches >= 2:
            logger.debug("Complexity: SIMPLE", simple=simple_matches, complex=complex_matches)
            return QueryComplexity.SIMPLE
        else:
            logger.debug("Complexity: STANDARD", simple=simple_matches, complex=complex_matches)
            return QueryComplexity.STANDARD


# ============================================================================
# MODEL ROUTER
# ============================================================================

class ModelRouter:
    """
    Routes LLM requests to appropriate models based on complexity.
    
    Model tiers:
    - Tier 1 (Simple): Claude Haiku, GPT-4o-mini
    - Tier 2 (Standard): Claude Sonnet, GPT-4o-mini
    - Tier 3 (Complex): Claude Opus, GPT-4
    
    Fallback chains:
    - Primary: Anthropic → OpenAI → Gemini
    - Within tier: Cheaper → More expensive
    """
    
    # Model configurations by tier
    MODEL_TIERS = {
        QueryComplexity.SIMPLE: {
            "primary": [
                "claude-3-5-haiku-20241022",  # $0.0008/$0.004 per 1K tokens
                "gpt-4o-mini",                  # $0.00015/$0.0006 per 1K tokens
            ],
            "fallback": [
                "gpt-4o-mini",
                "claude-3-5-haiku-20241022",
            ],
        },
        QueryComplexity.STANDARD: {
            "primary": [
                "claude-3-5-sonnet-20241022",  # $0.003/$0.015 per 1K tokens
                "gpt-4o-mini",                  # Fallback to cheaper
            ],
            "fallback": [
                "gpt-4o-mini",
                "claude-3-5-haiku-20241022",   # Downgrade if needed
            ],
        },
        QueryComplexity.COMPLEX: {
            "primary": [
                "claude-3-opus-20240229",      # $0.015/$0.075 per 1K tokens
                "gpt-4o",                      # $0.0025/$0.01 per 1K tokens
            ],
            "fallback": [
                "gpt-4o",
                "claude-3-5-sonnet-20241022",  # Downgrade if needed
            ],
        },
    }
    
    # Model costs per 1K tokens (input/output)
    MODEL_COSTS = {
        "claude-3-5-haiku-20241022": {"input": 0.0008, "output": 0.004},
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    }
    
    # Rule-based overrides for critical paths
    CRITICAL_OVERRIDES = {
        "security": QueryComplexity.COMPLEX,  # Always use best model for security
        "governance": QueryComplexity.COMPLEX,  # Always use best model for governance
        "production_deployment": QueryComplexity.COMPLEX,
        "cost_estimation": QueryComplexity.STANDARD,  # Can use standard for cost estimates
    }
    
    def __init__(self):
        self.classifier = ComplexityClassifier()
        self.llm_service = None
    
    async def _get_llm_service(self):
        """Lazy load LLM service."""
        if self.llm_service is None:
            self.llm_service = await get_llm_service()
        return self.llm_service
    
    def _check_critical_overrides(
        self,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[QueryComplexity]:
        """Check for critical path overrides."""
        if not metadata:
            return None
        
        for key, complexity in self.CRITICAL_OVERRIDES.items():
            if metadata.get(key) or metadata.get("path") == key:
                logger.info("Critical override", path=key, complexity=complexity)
                return complexity
        
        return None
    
    def route(
        self,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None,
        force_model: Optional[str] = None
    ) -> RoutingDecision:
        """
        Route request to appropriate model.
        
        Args:
            messages: Chat messages
            metadata: Optional metadata
            force_model: Force specific model (overrides routing)
        
        Returns:
            Routing decision
        """
        # Check for forced model
        if force_model:
            logger.info("Model forced", model=force_model)
            return RoutingDecision(
                complexity=QueryComplexity.STANDARD,
                primary_model=force_model,
                fallback_models=[],
                reason="Forced by user",
                estimated_cost_usd=0.0
            )
        
        # Check critical overrides
        override_complexity = self._check_critical_overrides(metadata)
        if override_complexity:
            complexity = override_complexity
        else:
            # Classify complexity
            complexity = self.classifier.classify(messages, metadata)
        
        # Get model tier configuration
        tier_config = self.MODEL_TIERS.get(complexity, self.MODEL_TIERS[QueryComplexity.STANDARD])
        primary_model = tier_config["primary"][0]
        fallback_models = tier_config["fallback"]
        
        # Estimate cost (rough estimate based on message length)
        estimated_tokens = sum(len(msg.get("content", "")) for msg in messages) // 4  # Rough estimate
        model_costs = self.MODEL_COSTS.get(primary_model, {"input": 0.001, "output": 0.005})
        estimated_cost = (estimated_tokens / 1000) * (model_costs["input"] + model_costs["output"] * 0.5)
        
        reason = f"Complexity: {complexity.value}, Tier: {primary_model}"
        
        logger.info(
            "Model routing decision",
            complexity=complexity.value,
            primary_model=primary_model,
            fallback_count=len(fallback_models),
            estimated_cost=estimated_cost
        )
        
        return RoutingDecision(
            complexity=complexity,
            primary_model=primary_model,
            fallback_models=fallback_models,
            reason=reason,
            estimated_cost_usd=estimated_cost
        )
    
    async def generate(
        self,
        request: LLMRequest,
        use_cache: bool = True,
        force_model: Optional[str] = None
    ) -> Tuple[LLMResponse, RoutingDecision]:
        """
        Generate LLM response with automatic model routing and fallback.
        
        Args:
            request: LLM request
            use_cache: Whether to use caching
            force_model: Force specific model
        
        Returns:
            Tuple of (LLM response, routing decision)
        """
        # Route to appropriate model
        routing_decision = self.route(
            request.messages,
            metadata=request.metadata,
            force_model=force_model
        )
        
        # Try primary model
        models_to_try = [routing_decision.primary_model] + routing_decision.fallback_models
        
        last_error = None
        for model in models_to_try:
            try:
                # Create request with routed model
                routed_request = LLMRequest(
                    messages=request.messages,
                    model=model,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    stream=request.stream,
                    metadata=request.metadata
                )
                
                # Generate response
                llm_service = await self._get_llm_service()
                response = await llm_service.generate(routed_request, use_cache=use_cache)
                
                # Update routing decision with actual model used
                routing_decision.primary_model = model
                routing_decision.estimated_cost_usd = response.cost_usd
                
                logger.info(
                    "Model routing success",
                    model=model,
                    complexity=routing_decision.complexity.value,
                    cost=response.cost_usd,
                    cached=response.cached
                )
                
                return response, routing_decision
                
            except Exception as e:
                last_error = e
                logger.warning(
                    "Model routing attempt failed",
                    model=model,
                    error=str(e),
                    trying_next=len(models_to_try) > models_to_try.index(model) + 1
                )
                
                # Continue to next model in fallback chain
                continue
        
        # All models failed
        logger.error(
            "All model routing attempts failed",
            models_tried=models_to_try,
            error=str(last_error)
        )
        raise RuntimeError(f"All model routing attempts failed. Last error: {last_error}")


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_model_router: Optional[ModelRouter] = None


async def get_model_router() -> ModelRouter:
    """Get model router singleton."""
    global _model_router
    if _model_router is None:
        _model_router = ModelRouter()
    return _model_router


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def route_and_generate(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    use_cache: bool = True
) -> Tuple[LLMResponse, RoutingDecision]:
    """
    Convenience function to route and generate in one call.
    
    Args:
        messages: Chat messages
        model: Optional model override
        temperature: Temperature setting
        max_tokens: Max tokens
        metadata: Optional metadata
        use_cache: Whether to use caching
    
    Returns:
        Tuple of (LLM response, routing decision)
    """
    router = await get_model_router()
    request = LLMRequest(
        messages=messages,
        model=model or "claude-3-5-haiku-20241022",  # Default, will be overridden
        temperature=temperature,
        max_tokens=max_tokens,
        metadata=metadata
    )
    return await router.generate(request, use_cache=use_cache, force_model=model)
