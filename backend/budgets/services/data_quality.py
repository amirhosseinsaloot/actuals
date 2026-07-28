"""Data-quality checks over the raw stored line items.

These inspect the *inputs* (budget, actual, description) rather than any computed
variance, so they operate directly on the raw model rows — not
:class:`ComputedLineItem` — and stay independent of the variance math.

Checks
------
    zero_budget_actual   budget == 0 but actual > 0 (spend against no budget)
    missing_description  description is blank / whitespace only
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from .money import money_str

IssueType = Literal["zero_budget_actual", "missing_description"]


@dataclass
class DataQualityIssue:
    issue: IssueType
    line_item_id: int
    department: str
    category: str
    detail: str


def check_data_quality(line_items) -> list[DataQualityIssue]:
    """Return every data-quality issue found, in stable line-item order.

    ``line_items`` are raw model rows (or any object exposing ``id``,
    ``department``, ``category``, ``budget_amount``, ``actual_amount`` and
    ``description``).
    """
    issues: list[DataQualityIssue] = []
    for item in line_items:
        budget = Decimal(item.budget_amount)
        actual = Decimal(item.actual_amount)

        if budget == 0 and actual > 0:
            issues.append(
                DataQualityIssue(
                    issue="zero_budget_actual",
                    line_item_id=item.id,
                    department=item.department,
                    category=item.category,
                    detail=f"Spent {money_str(actual)} against a zero budget.",
                )
            )

        description = (getattr(item, "description", "") or "").strip()
        if not description:
            issues.append(
                DataQualityIssue(
                    issue="missing_description",
                    line_item_id=item.id,
                    department=item.department,
                    category=item.category,
                    detail="Line item has no description.",
                )
            )
    return issues
