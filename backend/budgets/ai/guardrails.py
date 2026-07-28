"""
Blocking input guardrail.

Runs BEFORE any assistant text is streamed so an off-topic request produces a
clean refusal instead of a partial irrelevant answer. Implemented as a tiny
classification agent with structured (Pydantic) output — cheap and easy to mock
in tests.
"""

from __future__ import annotations

from agents import Agent, ModelSettings, Runner
from django.conf import settings
from pydantic import BaseModel

from .prompts import GUARDRAIL_INSTRUCTIONS


class ScopeCheck(BaseModel):
    in_scope: bool


def _build_guardrail_agent() -> Agent:
    return Agent(
        name="Budget scope guardrail",
        instructions=GUARDRAIL_INSTRUCTIONS,
        model=settings.OPENAI_MODEL,
        model_settings=ModelSettings(temperature=0),
        output_type=ScopeCheck,
    )


async def check_in_scope(question: str, context: dict | None = None) -> bool:
    """Return True if the question is in scope for budget analysis."""
    prompt = question
    if context and isinstance(context, dict) and context.get("type"):
        prompt = (
            f"Previous result type: {context.get('type')}\n"
            f"Follow-up question: {question}"
        )
    result = await Runner.run(_build_guardrail_agent(), prompt)
    return bool(result.final_output.in_scope)
