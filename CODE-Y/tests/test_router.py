"""Tests for ProviderRouter and failover engine."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from codey.config.schema import CodeYConfig, ProviderConfig, RoutingConfig
from codey.agent.message_types import Message
from codey.providers.router import ProviderRouter, AllProvidersExhaustedError
from codey.telemetry.event_bus import EventBus, Events


@pytest.fixture
def mock_config():
    return CodeYConfig(
        providers={
            "p1": ProviderConfig(base_url="http://p1", models={"m1": "model-1"}),
            "p2": ProviderConfig(base_url="http://p2", models={"m2": "model-2"}),
        },
        routing=RoutingConfig(
            default_chain=["m1", "m2"],
            timeout_seconds=5,
            max_retries_per_provider=0,
        ),
    )


@pytest.mark.asyncio
async def test_router_failover(mock_config):
    event_bus = EventBus()
    failovers = []

    def on_failover(from_provider: str, to_provider: str, **_):
        failovers.append((from_provider, to_provider))

    event_bus.subscribe(Events.PROVIDER_FAILOVER, on_failover)

    router = ProviderRouter(mock_config, event_bus)
    assert len(router.chain) == 2

    # Mock first provider failing and second succeeding
    router.chain[0].complete = AsyncMock(side_effect=TimeoutError("Timed out"))
    router.chain[1].complete = AsyncMock(return_value=Message(role="assistant", content="Success from P2"))

    messages = [Message(role="user", content="Hello")]
    response = await router.complete(messages)

    assert response.content == "Success from P2"
    assert len(failovers) == 1
    assert "M1" in failovers[0][0].upper()
    assert "M2" in failovers[0][1].upper()
