"""
Deterministic budget analysis. No LLM dependency.

This module is the single source of truth for variance math, severity
classification, grouping, and chart data. Everything returns Decimals; string
serialization happens at the schema boundary.

Definitions
-----------
    variance          = actual_amount - budget_amount          (positive = over)
    variance_percent  = variance / budget_amount               (None if budget 0)

Severity (applies to over-budget items only, i.e. variance > 0) uses the
item's variance as a *share of the total scenario budget*::

    share  = variance / scenario_total_budget
    high   = share >= 10%
    medium = share >= 5%
    low    = share  > 0%

Zero guards:
    budget_amount == 0                       -> variance_percent = None
    budget_amount == 0 and actual > 0        -> severity = "high"
    scenario_total_budget == 0 and variance>0-> severity = "high"
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

# Domain vocabulary, shared with the AI result schemas.
Severity = Literal["low", "medium", "high"]
GroupBy = Literal["department", "category"]
# Which side of budget to keep: over-budget (unfavorable), under-budget
# (favorable), or everything.
Direction = Literal["over", "under", "all"]
# How to order rows: by signed variance (most over-budget first) or by absolute
# magnitude (which line item "moved the most", regardless of direction).
RankBy = Literal["unfavorable", "magnitude"]

SEVERITY_ORDER: dict[Severity, int] = {"low": 1, "medium": 2, "high": 3}

HIGH_THRESHOLD = Decimal("0.10")
MEDIUM_THRESHOLD = Decimal("0.05")


@dataclass
class ComputedLineItem:
    line_item_id: int
    department: str
    category: str
    budget_amount: Decimal
    actual_amount: Decimal
    variance: Decimal
    variance_percent: Decimal | None
    severity: Severity | None

    @property
    def is_over_budget(self) -> bool:
        return self.variance > 0

    @property
    def is_under_budget(self) -> bool:
        return self.variance < 0


@dataclass
class GroupRow:
    group: str
    budget_total: Decimal
    actual_total: Decimal
    variance_total: Decimal
    variance_percent: Decimal | None
    severity: Severity | None
    line_item_ids: list[int]


def name_eq(value: str, target: str) -> bool:
    """Case- and whitespace-insensitive match for a department/category name.

    The single normalization rule for name lookups, shared by filtering and
    simulations so ``"marketing "`` and ``"Marketing"`` always resolve alike.
    """
    return value.strip().lower() == target.strip().lower()


def variance_percent(variance: Decimal, budget_amount: Decimal) -> Decimal | None:
    if budget_amount > 0:
        return variance / budget_amount
    return None


def line_variance(
    budget_amount: Decimal, actual_amount: Decimal
) -> tuple[Decimal, Decimal | None]:
    """Single source of truth for per-line variance and its percentage.

    Used by both the analysis pipeline and the CRUD serializer so the formula
    is never duplicated.
    """
    variance = actual_amount - budget_amount
    return variance, variance_percent(variance, budget_amount)


def classify_severity(
    variance: Decimal,
    scenario_total_budget: Decimal,
    budget_amount: Decimal | None = None,
    actual_amount: Decimal | None = None,
) -> Severity | None:
    """Return "high" | "medium" | "low" for over-budget items, else None."""
    if variance <= 0:
        return None

    # Zero-budget line with real spend is always high risk.
    if budget_amount is not None and budget_amount == 0 and (actual_amount or 0) > 0:
        return "high"

    # If the whole scenario has no budget but there is spend, it is high risk.
    if scenario_total_budget <= 0:
        return "high"

    share = variance / scenario_total_budget
    if share >= HIGH_THRESHOLD:
        return "high"
    if share >= MEDIUM_THRESHOLD:
        return "medium"
    if share > 0:
        return "low"
    return None


def compute_line_items(
    line_items,
    scenario_total_budget: Decimal,
) -> list[ComputedLineItem]:
    """Map raw line items (model instances or similar) to computed rows."""
    computed: list[ComputedLineItem] = []
    for item in line_items:
        budget = Decimal(item.budget_amount)
        actual = Decimal(item.actual_amount)
        var, var_pct = line_variance(budget, actual)
        computed.append(
            ComputedLineItem(
                line_item_id=item.id,
                department=item.department,
                category=item.category,
                budget_amount=budget,
                actual_amount=actual,
                variance=var,
                variance_percent=var_pct,
                severity=classify_severity(var, scenario_total_budget, budget, actual),
            )
        )
    return computed


def meets_min_severity(
    severity: Severity | None, min_severity: Severity | None
) -> bool:
    if min_severity is None:
        return True
    if severity is None:
        return False
    return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[min_severity]


def _by_name(
    computed: list[ComputedLineItem],
    department: str | None,
    category: str | None,
) -> list[ComputedLineItem]:
    """Keep rows matching the given department and/or category names."""
    rows = computed
    if department is not None:
        rows = [r for r in rows if name_eq(r.department, department)]
    if category is not None:
        rows = [r for r in rows if name_eq(r.category, category)]
    return rows


def filter_line_items(
    computed: list[ComputedLineItem],
    direction: Direction = "all",
    min_severity: Severity | None = None,
    department: str | None = None,
    category: str | None = None,
    rank_by: RankBy = "unfavorable",
) -> list[ComputedLineItem]:
    rows = _by_name(computed, department, category)
    if direction == "over":
        rows = [r for r in rows if r.is_over_budget]
    elif direction == "under":
        rows = [r for r in rows if r.is_under_budget]
    if min_severity is not None:
        rows = [r for r in rows if meets_min_severity(r.severity, min_severity)]
    if rank_by == "magnitude":
        # Biggest absolute mover first — a large favorable swing ranks too.
        return sorted(rows, key=lambda r: (-abs(r.variance), r.line_item_id))
    # Largest unfavorable variance first, then stable by id.
    return sorted(rows, key=lambda r: (-r.variance, r.line_item_id))


def group_line_items(
    computed: list[ComputedLineItem],
    group_by: GroupBy,
    scenario_total_budget: Decimal,
    direction: Direction = "all",
    min_severity: Severity | None = None,
    department: str | None = None,
    category: str | None = None,
) -> list[GroupRow]:
    """Group computed rows by "department" or "category".

    ``department``/``category`` narrow the underlying rows before bucketing (e.g.
    "group Marketing by category"); ``direction`` and ``min_severity`` then apply
    to the aggregated group totals.
    """
    if group_by not in ("department", "category"):
        raise ValueError("group_by must be 'department' or 'category'")

    buckets: dict[str, list[ComputedLineItem]] = {}
    for row in _by_name(computed, department, category):
        key = getattr(row, group_by)
        buckets.setdefault(key, []).append(row)

    groups: list[GroupRow] = []
    for key, rows in buckets.items():
        budget_total = sum((r.budget_amount for r in rows), Decimal("0"))
        actual_total = sum((r.actual_amount for r in rows), Decimal("0"))
        var_total = actual_total - budget_total
        groups.append(
            GroupRow(
                group=key,
                budget_total=budget_total,
                actual_total=actual_total,
                variance_total=var_total,
                variance_percent=variance_percent(var_total, budget_total),
                severity=classify_severity(var_total, scenario_total_budget),
                line_item_ids=[r.line_item_id for r in rows],
            )
        )

    if direction == "over":
        groups = [g for g in groups if g.variance_total > 0]
    elif direction == "under":
        groups = [g for g in groups if g.variance_total < 0]
    if min_severity is not None:
        groups = [g for g in groups if meets_min_severity(g.severity, min_severity)]

    return sorted(groups, key=lambda g: (-g.variance_total, g.group))
