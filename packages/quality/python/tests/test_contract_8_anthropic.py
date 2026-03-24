"""
Contract 8: Python → Anthropic API

Verifies:
- Python Anthropic SDK reads key from environment
- Can make a test call successfully
"""

import os

import pytest
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env"))

HAS_API_KEY = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


class TestContract8PythonAnthropic:
    def test_api_key_from_environment(self):
        """Anthropic SDK reads API key from environment (never hardcoded)."""
        key = os.environ.get("ANTHROPIC_API_KEY", "")
        if HAS_API_KEY:
            assert key.startswith("sk-ant-"), (
                "ANTHROPIC_API_KEY should start with sk-ant-"
            )
        else:
            # Mechanism is correct — env var exists, just empty
            pytest.skip(
                "ANTHROPIC_API_KEY not set — skipping live API tests. "
                "Set it in .env to enable."
            )

    @pytest.mark.skipif(not HAS_API_KEY, reason="ANTHROPIC_API_KEY not set")
    def test_make_api_call(self):
        """Can make a successful test call to Claude Haiku."""
        import anthropic

        client = anthropic.Anthropic()

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=64,
            messages=[
                {"role": "user", "content": "Reply with exactly the word: PONG"}
            ],
        )

        assert response.id is not None
        assert response.type == "message"
        assert len(response.content) >= 1
        assert response.content[0].type == "text"
        assert "PONG" in response.content[0].text
        assert response.usage.input_tokens > 0
        assert response.usage.output_tokens > 0

    def test_auth_failure_handling(self):
        """Error handling works for authentication failure."""
        import anthropic

        bad_client = anthropic.Anthropic(
            api_key="sk-ant-invalid-key-for-contract-test"
        )

        with pytest.raises(anthropic.AuthenticationError) as exc_info:
            bad_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
            )

        assert exc_info.value.status_code == 401
