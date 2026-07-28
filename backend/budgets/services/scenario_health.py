"""Scenario-level health classification from budget vs. actual totals.

The single source of truth for the over-budget / watch / on-track buckets shown
as the status pill in the UI. Pure and DB-free, like the other services, so it
is trivial to test with plain values.

Buckets, using ``overspend = (actual - budget) / budget``:

    over_budget   overspend > 10%   (also: any spend against a zero total budget)
    watch         0% < overspend <= 10%
    on_track      actual <= budget
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

HealthStatus = Literal["on_track", "watch", "over_budget"]

# > 10% of budget is over; anything above plan (but within 10%) is watch.
OVER_THRESHOLD = Decimal("0.10")

LABELS: dict[HealthStatus, str] = {
    "on_track": "On track",
    "watch": "Watch",
    "over_budget": "Over budget",
}


@dataclass(frozen=True)
class ScenarioHealth:
    status: HealthStatus
    label: str


def classify_health(budget_total: Decimal, actual_total: Decimal) -> HealthStatus:
    """Return the health bucket for a scenario's budget vs. actual totals."""
    budget = Decimal(budget_total)
    actual = Decimal(actual_total)
    if budget <= 0:
        return "over_budget" if actual > 0 else "on_track"
    overspend = (actual - budget) / budget
    if overspend > OVER_THRESHOLD:
        return "over_budget"
    if overspend > 0:
        return "watch"
    return "on_track"


def scenario_health(budget_total: Decimal, actual_total: Decimal) -> ScenarioHealth:
    status = classify_health(budget_total, actual_total)
    return ScenarioHealth(status=status, label=LABELS[status])
