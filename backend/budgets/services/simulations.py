"""Simple what-if simulations over actual spend.

A percentage change is applied to the *actual* amounts of the line items that
match a target (a department or a category). Budgets are held fixed, and the
resulting variance is recomputed. Nothing is written back to the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .budget_analysis import ComputedLineItem, GroupBy, name_eq


@dataclass
class SimulationResult:
    target_type: GroupBy
    target_name: str
    percent_change: Decimal
    current_actual_total: Decimal
    current_variance_total: Decimal
    projected_actual_total: Decimal
    projected_variance_total: Decimal
    affected_line_items: int
    line_item_ids: list[int]


def _matching(computed: list[ComputedLineItem], target_type: GroupBy, target_name: str):
    key = "department" if target_type == "department" else "category"
    return [r for r in computed if name_eq(getattr(r, key), target_name)]


def target_names(computed: list[ComputedLineItem], target_type: GroupBy) -> list[str]:
    key = "department" if target_type == "department" else "category"
    seen: list[str] = []
    for r in computed:
        value = getattr(r, key)
        if value not in seen:
            seen.append(value)
    return seen


def simulate_spend_change(
    computed: list[ComputedLineItem],
    target_type: GroupBy,
    target_name: str,
    percent_change: Decimal,
) -> SimulationResult | None:
    """Return a projection, or ``None`` if the target matches no line items."""
    if target_type not in ("department", "category"):
        raise ValueError("target_type must be 'department' or 'category'")

    rows = _matching(computed, target_type, target_name)
    if not rows:
        return None

    factor = Decimal("1") + (percent_change / Decimal("100"))

    current_actual = sum((r.actual_amount for r in rows), Decimal("0"))
    current_budget = sum((r.budget_amount for r in rows), Decimal("0"))
    current_variance = current_actual - current_budget

    projected_actual = sum((r.actual_amount * factor for r in rows), Decimal("0"))
    projected_variance = projected_actual - current_budget

    return SimulationResult(
        target_type=target_type,
        target_name=rows[0].department
        if target_type == "department"
        else rows[0].category,
        percent_change=percent_change,
        current_actual_total=current_actual,
        current_variance_total=current_variance,
        projected_actual_total=projected_actual,
        projected_variance_total=projected_variance,
        affected_line_items=len(rows),
        line_item_ids=[r.line_item_id for r in rows],
    )
