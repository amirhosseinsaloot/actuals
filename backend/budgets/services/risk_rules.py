"""Risk identification derived from computed variances.

Risks are simply the largest unfavorable (over-budget) variances, ranked. The
top risk also produces a deterministic recommendation-card payload.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .budget_analysis import ComputedLineItem, Severity


@dataclass
class RiskItem:
    rank: int
    line_item_id: int
    department: str
    category: str
    variance: Decimal
    variance_percent: Decimal | None
    severity: Severity | None
    reason: str


@dataclass
class Recommendation:
    title: str
    severity: Severity | None
    body: str
    related_line_item_ids: list[int]


def identify_risks(computed: list[ComputedLineItem], limit: int = 3) -> list[RiskItem]:
    over_budget = [r for r in computed if r.is_over_budget]
    ranked = sorted(over_budget, key=lambda r: (-r.variance, r.line_item_id))
    risks: list[RiskItem] = []
    for idx, row in enumerate(ranked[:limit], start=1):
        if idx == 1:
            reason = "Largest unfavorable variance in the scenario."
        else:
            reason = f"Ranked #{idx} unfavorable variance in the scenario."
        risks.append(
            RiskItem(
                rank=idx,
                line_item_id=row.line_item_id,
                department=row.department,
                category=row.category,
                variance=row.variance,
                variance_percent=row.variance_percent,
                severity=row.severity,
                reason=reason,
            )
        )
    return risks


def recommendation_from_risks(risks: list[RiskItem]) -> Recommendation | None:
    if not risks:
        return None
    top = risks[0]
    return Recommendation(
        title=f"Review {top.department} {top.category}",
        severity=top.severity,
        body=(
            f"{top.department} {top.category} has the largest unfavorable "
            f"variance in this scenario. Review pacing and reduce discretionary "
            f"spend before the period closes."
        ),
        related_line_item_ids=[top.line_item_id],
    )
