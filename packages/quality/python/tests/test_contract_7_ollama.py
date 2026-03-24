"""
Contract 7: Python → Ollama

Verifies:
- Python Ollama SDK can reach the same local server
- Can generate embeddings using nomic-embed-text
"""

import os
import time

import pytest
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env"))

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


@pytest.fixture(scope="module")
def ollama_client():
    from ollama import Client

    return Client(host=OLLAMA_BASE_URL)


class TestContract7PythonOllama:
    def test_ollama_reachable(self, ollama_client):
        """Python Ollama SDK can reach the local server."""
        models = ollama_client.list()
        assert "models" in models

    def test_nomic_embed_text_available(self, ollama_client):
        """nomic-embed-text model is available."""
        models = ollama_client.list()
        model_names = [m.get("model", m.get("name", "")) for m in models["models"]]
        has_model = any("nomic-embed-text" in name for name in model_names)
        assert has_model, (
            f"nomic-embed-text not found. Available models: {model_names}"
        )

    def test_generate_embeddings(self, ollama_client):
        """Can generate embeddings using nomic-embed-text."""
        response = ollama_client.embed(
            model="nomic-embed-text",
            input="The Recursive Software Foundry builds itself.",
        )

        embeddings = response.get("embeddings", [])
        assert len(embeddings) > 0, "No embeddings returned"

        # nomic-embed-text produces 768-dim vectors
        embedding = embeddings[0]
        assert len(embedding) == 768, (
            f"Expected 768 dimensions, got {len(embedding)}"
        )

        # Values should be floating point numbers
        assert all(isinstance(v, float) for v in embedding[:10])

    def test_embeddings_different_for_different_inputs(self, ollama_client):
        """Different inputs produce different embedding vectors."""
        resp1 = ollama_client.embed(
            model="nomic-embed-text",
            input="Hello world",
        )
        resp2 = ollama_client.embed(
            model="nomic-embed-text",
            input="Quantum chromodynamics explains strong nuclear force",
        )

        emb1 = resp1["embeddings"][0]
        emb2 = resp2["embeddings"][0]

        # Vectors should not be identical
        assert emb1 != emb2, "Different inputs produced identical embeddings"
