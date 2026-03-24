"""
Prompt Optimizer using DSPy-style optimization.

Takes a base prompt, examples with expected outputs, and a scoring function.
Iteratively refines the prompt to maximize the score on the examples.
Uses local Ollama models for inference.
"""

from typing import Any, Callable
from ollama import Client


def _evaluate_prompt(
    prompt: str,
    examples: list[dict[str, str]],
    scorer: Callable[[str, str], float],
    model_name: str,
    ollama_base_url: str,
) -> float:
    """Evaluate a prompt against examples and return average score."""
    if not examples:
        return 0.0

    client = Client(host=ollama_base_url)
    total_score = 0.0

    for ex in examples:
        full_prompt = f"{prompt}\n\nInput: {ex['input']}"
        response = client.generate(
            model=model_name,
            prompt=full_prompt,
            options={"num_predict": 64, "temperature": 0.1},
        )
        prediction = response.get("response", "").strip()
        total_score += scorer(prediction, ex["expected"])

    return total_score / len(examples)


def _generate_improved_prompt(
    base_prompt: str,
    examples: list[dict[str, str]],
    current_score: float,
    model_name: str,
    ollama_base_url: str,
) -> str:
    """Use the LLM to suggest an improved version of the prompt."""
    client = Client(host=ollama_base_url)

    examples_text = "\n".join(
        f"  Input: {ex['input']} → Expected: {ex['expected']}"
        for ex in examples[:4]  # Use a subset to keep context small
    )

    meta_prompt = f"""You are a prompt engineering expert. Improve the following prompt to get better accuracy.

Current prompt (score: {current_score:.2f}):
"{base_prompt}"

The prompt should correctly handle these examples:
{examples_text}

Output ONLY the improved prompt text, nothing else. No quotes around it."""

    response = client.generate(
        model=model_name,
        prompt=meta_prompt,
        options={"num_predict": 512, "temperature": 0.3},
    )

    improved = response.get("response", "").strip()
    # Strip surrounding quotes if the model adds them
    if improved.startswith('"') and improved.endswith('"'):
        improved = improved[1:-1]

    return improved if improved else base_prompt


def optimize_prompt(
    base_prompt: str,
    examples: list[dict[str, str]],
    scorer: Callable[[str, str], float],
    model_name: str = "qwen2.5-coder:14b",
    ollama_base_url: str = "http://localhost:11434",
    max_iterations: int = 3,
) -> dict[str, Any]:
    """
    Optimize a prompt using iterative refinement.

    Args:
        base_prompt: The initial prompt template
        examples: List of {"input": ..., "expected": ...} dicts
        scorer: Function(prediction, expected) -> float score [0, 1]
        model_name: Ollama model to use
        ollama_base_url: Ollama server URL
        max_iterations: Maximum optimization iterations

    Returns:
        Dict with optimized_prompt, before_score, after_score, iterations
    """
    if not examples:
        return {
            "optimized_prompt": base_prompt,
            "before_score": 0.0,
            "after_score": 0.0,
            "iterations": 0,
        }

    # Split into train/eval
    split = max(1, len(examples) // 2)
    train_examples = examples[:split]
    eval_examples = examples[split:] if split < len(examples) else examples

    # Score the base prompt
    before_score = _evaluate_prompt(
        base_prompt, eval_examples, scorer, model_name, ollama_base_url
    )

    best_prompt = base_prompt
    best_score = before_score

    for i in range(max_iterations):
        # Generate an improved prompt candidate
        candidate = _generate_improved_prompt(
            best_prompt, train_examples, best_score, model_name, ollama_base_url
        )

        # Evaluate the candidate
        candidate_score = _evaluate_prompt(
            candidate, eval_examples, scorer, model_name, ollama_base_url
        )

        if candidate_score >= best_score:
            best_prompt = candidate
            best_score = candidate_score

    return {
        "optimized_prompt": best_prompt,
        "before_score": before_score,
        "after_score": best_score,
        "iterations": max_iterations,
    }
