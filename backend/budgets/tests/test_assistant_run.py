"""Assistant orchestration: atomic claim, refusal, graceful degradation, mocking."""

from types import SimpleNamespace

import pytest
from django.test import override_settings
from openai.types.responses import ResponseTextDeltaEvent

from budgets.ai import agent as agent_mod
from budgets.models import AssistantRun


async def _collect(agen):
    return [event async for event in agen]


@pytest.mark.django_db
def test_assistant_run_claim_is_atomic(example_scenario):
    """The pending->running claim can only succeed once (the SSE claim semantics)."""
    run = AssistantRun.objects.create(scenario=example_scenario, question="q")
    first = AssistantRun.objects.filter(
        id=run.id, status=AssistantRun.Status.PENDING
    ).update(status=AssistantRun.Status.RUNNING)
    second = AssistantRun.objects.filter(
        id=run.id, status=AssistantRun.Status.PENDING
    ).update(status=AssistantRun.Status.RUNNING)
    assert first == 1
    assert second == 0


@override_settings(OPENAI_API_KEY="")
async def test_missing_api_key_emits_error():
    events = await _collect(
        agent_mod.generate_events(1, "Which areas are over budget?")
    )
    names = [name for name, _ in events]
    assert names[0] == "status"
    assert "error" in names


@override_settings(OPENAI_API_KEY="test-key")
async def test_off_topic_returns_refusal(monkeypatch):
    async def fake_scope(question, context=None):
        return False

    monkeypatch.setattr(agent_mod, "check_in_scope", fake_scope)

    events = await _collect(
        agent_mod.generate_events(1, "What tech stock should I buy?")
    )
    results = [data for name, data in events if name == "result"]
    assert len(results) == 1
    assert results[0]["type"] == "refusal"


@override_settings(OPENAI_API_KEY="test-key")
async def test_agent_stream_flushes_tool_result(monkeypatch):
    """The agent run is mocked; a validated tool envelope must reach the stream
    as a `result` event with provenance intact."""

    async def fake_scope(question, context=None):
        return True

    static_envelope = {
        "type": "variance_table",
        "provenance": {
            "tool": "analyze_variances",
            "params": {"direction": "over"},
            "line_item_ids": [1, 2],
        },
        "rows": [],
    }

    class FakeStreamed:
        async def stream_events(self):
            return
            yield  # pragma: no cover - makes this an async generator

    def fake_run_streamed(agent, input, context):
        # Simulate a tool populating the run context.
        context.emitted_results.append(static_envelope)
        return FakeStreamed()

    monkeypatch.setattr(agent_mod, "check_in_scope", fake_scope)
    monkeypatch.setattr(agent_mod, "build_agent", lambda: object())
    monkeypatch.setattr(agent_mod.Runner, "run_streamed", fake_run_streamed)

    events = await _collect(
        agent_mod.generate_events(1, "Which areas are over budget?")
    )
    results = [data for name, data in events if name == "result"]
    assert results == [static_envelope]
    assert results[0]["provenance"]["tool"] == "analyze_variances"


@override_settings(OPENAI_API_KEY="test-key")
async def test_agent_stream_relays_tool_status_and_text(monkeypatch):
    """The in-loop relay maps SDK events to status/result/message events.

    The other mocked-agent test yields no SDK events, so only the trailing
    safety flush runs. This one feeds a `tool_called` item and a text delta so
    the per-tool status announcement and token-by-token message relay execute.
    """

    async def fake_scope(question, context=None):
        return True

    envelope = {
        "type": "variance_table",
        "provenance": {
            "tool": "analyze_variances",
            "params": {},
            "line_item_ids": [1],
        },
        "rows": [],
    }
    tool_event = SimpleNamespace(
        type="run_item_stream_event",
        name="tool_called",
        item=SimpleNamespace(raw_item=SimpleNamespace(name="analyze_variances")),
    )
    text_event = SimpleNamespace(
        type="raw_response_event",
        data=ResponseTextDeltaEvent.model_construct(delta="Marketing is over budget."),
    )

    class FakeStreamed:
        async def stream_events(self):
            yield tool_event
            yield text_event

    def fake_run_streamed(agent, input, context):
        # A tool populates the run context as it runs, before the deltas stream.
        context.emitted_results.append(envelope)
        return FakeStreamed()

    monkeypatch.setattr(agent_mod, "check_in_scope", fake_scope)
    monkeypatch.setattr(agent_mod, "build_agent", lambda: object())
    monkeypatch.setattr(agent_mod.Runner, "run_streamed", fake_run_streamed)

    events = await _collect(
        agent_mod.generate_events(1, "Which areas are over budget?")
    )

    assert ("status", {"message": "Running analyze_variances..."}) in events
    assert ("result", envelope) in events
    assert ("message", {"text": "Marketing is over budget."}) in events
