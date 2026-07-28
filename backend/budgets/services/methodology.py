"""Plain-language definitions of the workspace's metrics.

Built from the same constants the calculations use, so the explanations the
assistant gives can never drift from the real thresholds. Pure and DB-free.
"""

from __future__ import annotations

from decimal import Decimal

from budgets.services.budget_analysis import HIGH_THRESHOLD, MEDIUM_THRESHOLD
from budgets.services.scenario_health import OVER_THRESHOLD


def _pct(ratio: Decimal) -> str:
    """Format a ratio as a percentage without trailing zeros (0.10 -> "10%")."""
    text = f"{ratio * 100:.2f}".rstrip("0").rstrip(".")
    return f"{text}%"


def metric_definitions() -> dict[str, str]:
    """Return {metric: plain-language definition}, keyed by topic."""
    high = _pct(HIGH_THRESHOLD)
    medium = _pct(MEDIUM_THRESHOLD)
    over = _pct(OVER_THRESHOLD)
    return {
        "variance": (
            "Variance = actual - budget. Positive is over budget (unfavorable); "
            "negative is under budget (favorable). Variance % = variance / budget, "
            "and is undefined when the budget is 0."
        ),
        "severity": (
            "Severity applies to over-budget line items, based on the overspend as "
            f"a share of the scenario's total budget: High is at least {high}, "
            f"Medium is at least {medium}, and Low is anything above 0%. A line item "
            "with spend against a zero budget is always High; under-budget items "
            "have no severity."
        ),
        "risk": (
            "Risks are the over-budget line items with the largest unfavorable "
            "variances, ranked biggest first, each carrying the same "
            f"High ({high}) / Medium ({medium}) / Low severity."
        ),
        "health": (
            "Scenario health compares total actual to total budget: Over budget is "
            f"more than {over} over, Watch is 0-{over} over, and On track is at or "
            "under budget."
        ),
        "data_quality": (
            "Data-quality checks flag two problems in the raw rows: spend recorded "
            "against a zero budget, and line items missing a description."
        ),
    }


def explain_metrics() -> str:
    """A single reference block covering every metric, for the assistant to quote."""
    return "\n".join(f"- {text}" for text in metric_definitions().values())
