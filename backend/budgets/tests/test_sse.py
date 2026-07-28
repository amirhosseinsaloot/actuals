"""The SSE stream: claims the run, relays events, and records the outcome.

``transaction=True`` because the stream's ORM access runs in a worker thread
(via sync_to_async) on a separate connection, which only sees committed data.
"""

import pytest
from asgiref.sync import sync_to_async
from django.db import connections

from budgets.models import AssistantRun
from budgets.streaming import sse as sse_mod

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
async def _close_worker_thread_connections():
    """sync_to_async runs ORM calls on a worker thread whose connection would
    otherwise linger and block Postgres test-database teardown."""
    yield
    await sync_to_async(connections.close_all)()


async def _collect_stream(scenario_id: int, run_id: str) -> str:
    frames = [chunk async for chunk in sse_mod._event_stream(scenario_id, run_id)]
    return "".join(frames)


async def test_stream_relays_events_and_completes_run(example_scenario, monkeypatch):
    run = await sync_to_async(AssistantRun.objects.create)(
        scenario=example_scenario, question="Which areas are over budget?"
    )

    async def fake_events(scenario_id, question, context=None):
        yield ("status", {"message": "working"})
        yield ("result", {"type": "refusal", "message": "nope"})

    monkeypatch.setattr(sse_mod, "generate_events", fake_events)

    body = await _collect_stream(example_scenario.id, str(run.id))
    assert "event: status" in body
    assert "event: result" in body
    assert body.rstrip().endswith("data: {}")  # terminal done frame

    status = await sync_to_async(lambda: AssistantRun.objects.get(id=run.id).status)()
    assert status == AssistantRun.Status.COMPLETED


async def test_stream_error_event_marks_run_failed(example_scenario, monkeypatch):
    run = await sync_to_async(AssistantRun.objects.create)(
        scenario=example_scenario, question="q"
    )

    async def fake_events(scenario_id, question, context=None):
        yield ("error", {"message": "boom"})

    monkeypatch.setattr(sse_mod, "generate_events", fake_events)

    body = await _collect_stream(example_scenario.id, str(run.id))
    assert "event: error" in body
    assert "event: done" in body

    status = await sync_to_async(lambda: AssistantRun.objects.get(id=run.id).status)()
    assert status == AssistantRun.Status.FAILED


async def test_stream_unknown_run_yields_error_and_done(example_scenario):
    body = await _collect_stream(example_scenario.id, "not-a-uuid")
    assert "Run not found or already started." in body
    assert "event: done" in body


async def test_stream_cannot_claim_run_twice(example_scenario, monkeypatch):
    run = await sync_to_async(AssistantRun.objects.create)(
        scenario=example_scenario, question="q"
    )

    async def fake_events(scenario_id, question, context=None):
        yield ("status", {"message": "working"})

    monkeypatch.setattr(sse_mod, "generate_events", fake_events)

    await _collect_stream(example_scenario.id, str(run.id))
    second = await _collect_stream(example_scenario.id, str(run.id))
    assert "Run not found or already started." in second
