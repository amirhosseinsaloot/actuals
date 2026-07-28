"""Thin data-access helpers. The only place that touches the ORM for reads.

Keeping queries here means the calculation layer stays pure and easy to test
with plain objects.
"""

from decimal import Decimal

from budgets.models import BudgetLineItem


def get_line_items(scenario_id: int) -> list[BudgetLineItem]:
    """Return all line items for a scenario, ordered deterministically by id."""
    return list(BudgetLineItem.objects.filter(scenario_id=scenario_id).order_by("id"))


def scenario_total_budget(line_items) -> Decimal:
    total = Decimal("0")
    for item in line_items:
        total += Decimal(item.budget_amount)
    return total
