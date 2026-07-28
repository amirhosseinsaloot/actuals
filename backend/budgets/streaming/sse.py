"""
Plain async Django SSE view.

This is intentionally NOT a DRF view. The agent/tool workflow executes inside
this GET request's async generator; events are flushed to the client as they
occur. The run is claimed atomically (pending -> running) so a run can only be
executed once even if the stream is opened twice.
"""

from __future__ import annotations

import asyncio
import json
import logging

from asgiref.sync import sync_to_async
from django.http import StreamingHttpResponse
from django.utils import timezone

from budgets.ai.agent import generate_events
from budgets.models import AssistantRun

logger = logging.getLogger(__name__)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@sync_to_async
def _claim_run(scenario_id: int, run_id: str) -> AssistantRun | None:
    """Atomically move pending -> running. Returns the run or None if unclaimable."""
    try:
        # A single UPDATE ... WHERE status='pending' is the atomic claim: only
        # one caller can flip the row, so a run executes at most once.
        updated = AssistantRun.objects.filter(
            id=run_id,
            scenario_id=scenario_id,
            status=AssistantRun.Status.PENDING,
        ).update(status=AssistantRun.Status.RUNNING)
    except Exception:  # noqa: BLE001 - invalid uuid / missing scenario, etc.
        logger.warning("Could not claim run %r", run_id, exc_info=True)
        return None
    if not updated:
        return None
    return AssistantRun.objects.get(id=run_id)


@sync_to_async
def _set_status(run_id: str, status: str) -> None:
    # .update() bypasses auto_now, so advance updated_at explicitly.
    AssistantRun.objects.filter(id=run_id).update(
        status=status, updated_at=timezone.now()
    )


async def _event_stream(scenario_id: int, run_id: str):
    run = await _claim_run(scenario_id, run_id)
    if run is None:
        yield _sse(
            "error",
            {"message": "Run not found or already started."},
        )
        yield _sse("done", {})
        return

    saw_error = False
    try:
        async for name, data in generate_events(scenario_id, run.question, run.context):
            if name == "error":
                saw_error = True
            yield _sse(name, data)

        await _set_status(
            str(run_id),
            AssistantRun.Status.FAILED if saw_error else AssistantRun.Status.COMPLETED,
        )
        yield _sse("done", {})
    except asyncio.CancelledError:
        # Client disconnected mid-stream.
        await _set_status(str(run_id), AssistantRun.Status.FAILED)
        raise
    except Exception:  # noqa: BLE001
        logger.exception("SSE stream failed")
        await _set_status(str(run_id), AssistantRun.Status.FAILED)
        yield _sse("error", {"message": "Unable to analyze this request."})
        yield _sse("done", {})


async def assistant_stream(request, scenario_id: int):
    run_id = request.GET.get("run_id", "")
    response = StreamingHttpResponse(
        _event_stream(scenario_id, run_id),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Connection"] = "keep-alive"
    return response
