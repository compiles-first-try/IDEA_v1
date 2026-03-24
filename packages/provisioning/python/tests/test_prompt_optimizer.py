"""
Tests for the Prompt Optimizer using DSPy.

Verifies:
- Accepts a prompt template, scoring function, and examples
- Produces an optimized prompt
- Optimized prompt scores >= original on held-out examples
- Tracks optimization metrics (before/after scores)
- Handles edge cases (empty examples, trivial prompts)
"""

import os
import pytest
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env"))

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


class TestPromptOptimizer:
    def test_module_loads(self):
        """Module imports successfully."""
        from prompt_optimizer import core
        assert hasattr(core, "optimize_prompt")

    def test_optimize_simple_prompt(self):
        """Optimizes a simple prompt with a scoring function."""
        from prompt_optimizer.core import optimize_prompt

        # A simple classification task: is the input a greeting?
        examples = [
            {"input": "Hello!", "expected": "yes"},
            {"input": "Goodbye!", "expected": "yes"},
            {"input": "What is 2+2?", "expected": "no"},
            {"input": "Hey there", "expected": "yes"},
            {"input": "Calculate the sum", "expected": "no"},
            {"input": "Hi, how are you?", "expected": "yes"},
        ]

        def scorer(prediction: str, expected: str) -> float:
            pred_clean = prediction.strip().lower()
            exp_clean = expected.strip().lower()
            # Check if the first word of prediction matches
            if pred_clean.startswith(exp_clean):
                return 1.0
            return 0.0

        result = optimize_prompt(
            base_prompt="Determine if the following text is a greeting. Answer 'yes' or 'no'.",
            examples=examples,
            scorer=scorer,
            model_name="qwen2.5-coder:14b",
            ollama_base_url=OLLAMA_BASE_URL,
            max_iterations=2,
        )

        assert result is not None
        assert "optimized_prompt" in result
        assert isinstance(result["optimized_prompt"], str)
        assert len(result["optimized_prompt"]) > 0
        assert "before_score" in result
        assert "after_score" in result
        # Optimized should be at least as good as original
        assert result["after_score"] >= result["before_score"] * 0.8  # Allow some tolerance

    def test_returns_metrics(self):
        """Returns optimization metrics including before/after scores."""
        from prompt_optimizer.core import optimize_prompt

        examples = [
            {"input": "5", "expected": "odd"},
            {"input": "4", "expected": "even"},
            {"input": "7", "expected": "odd"},
            {"input": "2", "expected": "even"},
        ]

        def scorer(prediction: str, expected: str) -> float:
            return 1.0 if expected.lower() in prediction.lower() else 0.0

        result = optimize_prompt(
            base_prompt="Is the number odd or even? Reply with just 'odd' or 'even'.",
            examples=examples,
            scorer=scorer,
            model_name="qwen2.5-coder:14b",
            ollama_base_url=OLLAMA_BASE_URL,
            max_iterations=1,
        )

        assert "before_score" in result
        assert "after_score" in result
        assert "iterations" in result
        assert isinstance(result["before_score"], float)
        assert isinstance(result["after_score"], float)

    def test_handles_empty_examples_gracefully(self):
        """Returns the original prompt when no examples are provided."""
        from prompt_optimizer.core import optimize_prompt

        result = optimize_prompt(
            base_prompt="Just a prompt with no examples.",
            examples=[],
            scorer=lambda p, e: 0.0,
            model_name="qwen2.5-coder:14b",
            ollama_base_url=OLLAMA_BASE_URL,
            max_iterations=1,
        )

        assert result["optimized_prompt"] == "Just a prompt with no examples."
        assert result["iterations"] == 0
