"""
AI orchestration.

Builds the single budget-analyst agent and produces a stream of high-level
assistant events (status / message / result / error) from the OpenAI Agents SDK
streaming run. The SSE layer maps these to the wire protocol.

The agent selects one approved tool, the tool computes deterministically, and
the *validated tool output* — not model JSON — is what gets emitted as result
events.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from agents import Agent, ModelSettings, Runner
from django.conf import settings
from openai.types.responses import ResponseTextDeltaEvent

from . import schemas
from .guardrails import check_in_scope
from .prompts import ASSISTANT_INSTRUCTIONS
from .tools import ALL_TOOLS, AnalysisContext

logger = logging.getLogger(__name__)

# An event is (event_name, data_dict).
Event = tuple[str, dict]


def build_agent() -> Agent:
    return Agent(
        name="Budget analyst",
        instructions=ASSISTANT_INSTRUCTIONS,
        model=settings.OPENAI_MODEL,
        model_settings=ModelSettings(temperature=0),
        tools=ALL_TOOLS,
    )


def _build_input(question: str, context: dict | None) -> str:
    if context and isinstance(context, dict) and context.get("type"):
        # Context is already size-capped at the POST boundary; the slice is a
        # defense-in-depth guard on prompt size.
        return (
            "The user is asking a follow-up. For reference only, the previous "
            "result envelope was:\n"
            f"{json.dumps(context)[: schemas.MAX_CONTEXT_BYTES]}\n\n"
            f"Follow-up question: {question}"
        )
    return question


async def generate_events(
    scenario_id: int,
    question: str,
    context: dict | None = None,
) -> AsyncIterator[Event]:
    """Yield assistant events. Raises nothing; failures surface as ("error", ...)."""
    yield ("status", {"message": "Analyzing selected budget scenario..."})

    if not settings.OPENAI_API_KEY:
        yield (
            "error",
            {
                "message": "The assistant is not configured. Set OPENAI_API_KEY "
                "to enable AI analysis. Budget data and CRUD still work."
            },
        )
        return

    try:
        in_scope = await check_in_scope(question, context)
    except Exception:  # noqa: BLE001 - degrade gracefully on provider errors
        logger.exception("Guardrail check failed")
        yield ("error", {"message": "Unable to analyze this request right now."})
        return

    if not in_scope:
        yield ("result", schemas.refusal())
        return

    ctx = AnalysisContext(scenario_id=scenario_id)
    emitted_cursor = 0
    announced_tools: set[str] = set()

    try:
        result = Runner.run_streamed(
            build_agent(),
            input=_build_input(question, context),
            context=ctx,
        )
        async for event in result.stream_events():
            # Announce a tool as it starts running.
            if event.type == "run_item_stream_event" and event.name == "tool_called":
                name = getattr(getattr(event.item, "raw_item", None), "name", None)
                if name and name not in announced_tools:
                    announced_tools.add(name)
                    yield ("status", {"message": f"Running {name}..."})

            # Flush any newly produced structured results.
            while emitted_cursor < len(ctx.emitted_results):
                yield ("result", ctx.emitted_results[emitted_cursor])
                emitted_cursor += 1

            # Stream assistant text as it is generated.
            if event.type == "raw_response_event" and isinstance(
                event.data, ResponseTextDeltaEvent
            ):
                if event.data.delta:
                    yield ("message", {"text": event.data.delta})

        # Safety: flush anything left.
        while emitted_cursor < len(ctx.emitted_results):
            yield ("result", ctx.emitted_results[emitted_cursor])
            emitted_cursor += 1

    except Exception:  # noqa: BLE001
        logger.exception("Assistant run failed")
        yield ("error", {"message": "Unable to analyze this request."})
