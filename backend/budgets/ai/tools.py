"""
Tool layer.

Two things live here:

1. Deterministic *builder* functions (``build_*``) that turn persisted budget
   data into validated result envelopes. These are pure of any LLM concern and
   are what the unit tests exercise directly.
2. Thin OpenAI Agents SDK ``@function_tool`` wrappers that call the builders,
   stash the validated envelopes on the run context, and return a compact
   textual summary for the model to explain. The model never sees or produces
   the structured JSON — it only gets the summary and decides what to say.

``scenario_id`` is injected from the run context server-side; it is never
trusted from the model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import cast

from agents import RunContextWrapper, Tool, function_tool
from asgiref.sync import sync_to_async

from budgets.services import budget_analysis as ba
from budgets.services import data_quality as dq
from budgets.services import methodology, risk_rules, scenario_queries, simulations
from budgets.services.money import money_str, percent_str

from . import schemas

# Parameter bounds enforced on model-supplied tool arguments.
MIN_RISK_LIMIT = 1
MAX_RISK_LIMIT = 20
PERCENT_CHANGE_MIN = -100
PERCENT_CHANGE_MAX = 500


@dataclass
class AnalysisContext:
    """Passed to every tool. Accumulates validated result envelopes."""

    scenario_id: int
    emitted_results: list[dict] = field(default_factory=list)
    tools_called: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Deterministic builders (no LLM)                                             #
# --------------------------------------------------------------------------- #
def _provenance(
    tool: str, params: dict, line_item_ids: list[int]
) -> schemas.Provenance:
    clean = {k: v for k, v in params.items() if v is not None}
    return schemas.Provenance(tool=tool, params=clean, line_item_ids=line_item_ids)


def _chart_from_groups(
    tool: str, params: dict, groups: list[ba.GroupRow], x_key: str, title: str
) -> dict:
    ids = [i for g in groups for i in g.line_item_ids]
    return schemas.SimpleChart(
        provenance=_provenance(tool, params, ids),
        title=title,
        x_key=x_key,
        y_key="variance_total",
        data=[
            {x_key: g.group, "variance_total": money_str(g.variance_total)}
            for g in groups
        ],
    ).model_dump()


def build_analyze_variances(
    scenario_id: int,
    group_by: ba.GroupBy | None = None,
    direction: ba.Direction = "all",
    min_severity: ba.Severity | None = None,
    department: str | None = None,
    category: str | None = None,
    rank_by: ba.RankBy = "unfavorable",
) -> list[dict]:
    """Return [variance_table | grouped_summary, simple_chart]."""
    items = scenario_queries.get_line_items(scenario_id)
    total_budget = scenario_queries.scenario_total_budget(items)
    computed = ba.compute_line_items(items, total_budget)

    tool = "analyze_variances"
    params = {
        "group_by": group_by,
        "direction": direction if direction != "all" else None,
        "min_severity": min_severity,
        "department": department,
        "category": category,
        "rank_by": rank_by if rank_by != "unfavorable" else None,
    }
    results: list[dict] = []

    if group_by:
        groups = ba.group_line_items(
            computed,
            group_by,
            total_budget,
            direction=direction,
            min_severity=min_severity,
            department=department,
            category=category,
        )
        ids = [i for g in groups for i in g.line_item_ids]
        results.append(
            schemas.GroupedSummary(
                provenance=_provenance(tool, params, ids),
                group_by=group_by,
                rows=[
                    schemas.GroupedRow(
                        group=g.group,
                        budget_total=money_str(g.budget_total),
                        actual_total=money_str(g.actual_total),
                        variance_total=money_str(g.variance_total),
                        variance_percent=percent_str(g.variance_percent),
                        severity=g.severity,
                    )
                    for g in groups
                ],
            ).model_dump()
        )
        results.append(
            _chart_from_groups(
                tool, params, groups, group_by, f"Variance by {group_by.title()}"
            )
        )
    else:
        rows = ba.filter_line_items(
            computed,
            direction=direction,
            min_severity=min_severity,
            department=department,
            category=category,
            rank_by=rank_by,
        )
        ids = [r.line_item_id for r in rows]
        results.append(
            schemas.VarianceTable(
                provenance=_provenance(tool, params, ids),
                rows=[
                    schemas.VarianceRow(
                        line_item_id=r.line_item_id,
                        department=r.department,
                        category=r.category,
                        budget_amount=money_str(r.budget_amount),
                        actual_amount=money_str(r.actual_amount),
                        variance=money_str(r.variance),
                        variance_percent=percent_str(r.variance_percent),
                        severity=r.severity,
                        reason=None,
                    )
                    for r in rows
                ],
            ).model_dump()
        )
        # A department chart gives an at-a-glance view for the same filter.
        dept_groups = ba.group_line_items(
            computed,
            "department",
            total_budget,
            direction=direction,
            min_severity=min_severity,
            department=department,
            category=category,
        )
        results.append(
            _chart_from_groups(
                tool, params, dept_groups, "department", "Variance by Department"
            )
        )

    return results


def build_identify_budget_risks(scenario_id: int, limit: int = 3) -> list[dict]:
    """Return [risk_list, recommendation_card?]."""
    items = scenario_queries.get_line_items(scenario_id)
    total_budget = scenario_queries.scenario_total_budget(items)
    computed = ba.compute_line_items(items, total_budget)

    risks = risk_rules.identify_risks(computed, limit=limit)
    tool = "identify_budget_risks"
    params = {"limit": limit}

    results: list[dict] = [
        schemas.RiskList(
            provenance=_provenance(tool, params, [r.line_item_id for r in risks]),
            items=[
                schemas.RiskListItem(
                    rank=r.rank,
                    line_item_id=r.line_item_id,
                    department=r.department,
                    category=r.category,
                    variance=money_str(r.variance),
                    variance_percent=percent_str(r.variance_percent),
                    severity=r.severity,
                    reason=r.reason,
                )
                for r in risks
            ],
        ).model_dump()
    ]

    rec = risk_rules.recommendation_from_risks(risks)
    if rec is not None:
        results.append(
            schemas.RecommendationCard(
                provenance=_provenance(tool, params, rec.related_line_item_ids),
                title=rec.title,
                severity=rec.severity,
                body=rec.body,
                related_line_item_ids=rec.related_line_item_ids,
            ).model_dump()
        )
    return results


def build_simulate_spend_change(
    scenario_id: int,
    target_type: ba.GroupBy,
    target_name: str,
    percent_change: Decimal,
) -> list[dict]:
    """Return [simulation_result, recommendation_card] or raise if target missing."""
    items = scenario_queries.get_line_items(scenario_id)
    total_budget = scenario_queries.scenario_total_budget(items)
    computed = ba.compute_line_items(items, total_budget)

    sim = simulations.simulate_spend_change(
        computed, target_type, target_name, Decimal(percent_change)
    )
    if sim is None:
        available = ", ".join(simulations.target_names(computed, target_type))
        raise ValueError(
            f"No {target_type} named '{target_name}'. Available: {available}"
        )

    tool = "simulate_spend_change"
    params = {
        "target_type": target_type,
        "target_name": sim.target_name,
        "percent_change": money_str(sim.percent_change),
    }
    results: list[dict] = [
        schemas.SimulationResultSchema(
            provenance=_provenance(tool, params, sim.line_item_ids),
            target=schemas.SimTarget(type=sim.target_type, name=sim.target_name),
            percent_change=money_str(sim.percent_change),
            current=schemas.SimTotals(
                actual_total=money_str(sim.current_actual_total),
                variance_total=money_str(sim.current_variance_total),
            ),
            projected=schemas.SimTotals(
                actual_total=money_str(sim.projected_actual_total),
                variance_total=money_str(sim.projected_variance_total),
            ),
            affected_line_items=sim.affected_line_items,
        ).model_dump()
    ]

    direction = "reduce" if sim.percent_change < 0 else "increase"
    delta = sim.projected_variance_total - sim.current_variance_total
    results.append(
        schemas.RecommendationCard(
            provenance=_provenance(tool, params, sim.line_item_ids),
            title=f"What-if: {sim.target_name} {direction} {abs(sim.percent_change)}%",
            severity=None,
            body=(
                f"A {money_str(abs(sim.percent_change))}% change to "
                f"{sim.target_name} actuals moves its variance from "
                f"{money_str(sim.current_variance_total)} to "
                f"{money_str(sim.projected_variance_total)} "
                f"(a change of {money_str(delta)})."
            ),
            related_line_item_ids=sim.line_item_ids,
        ).model_dump()
    )
    return results


def build_check_data_quality(scenario_id: int) -> list[dict]:
    """Return [data_quality_report] for the scenario's raw line items."""
    items = scenario_queries.get_line_items(scenario_id)
    issues = dq.check_data_quality(items)

    tool = "check_data_quality"
    params: dict = {}
    return [
        schemas.DataQualityReport(
            provenance=_provenance(tool, params, [i.line_item_id for i in issues]),
            issues=[
                schemas.DataQualityIssueRow(
                    issue=i.issue,
                    line_item_id=i.line_item_id,
                    department=i.department,
                    category=i.category,
                    detail=i.detail,
                )
                for i in issues
            ],
        ).model_dump()
    ]


# --------------------------------------------------------------------------- #
# OpenAI Agents SDK function tools                                            #
# --------------------------------------------------------------------------- #
# Tool execution happens inside the async SSE request; the sync ORM builders
# are wrapped with sync_to_async at each call site.
def _emit(ctx: RunContextWrapper[AnalysisContext], name: str, envelopes: list[dict]):
    ctx.context.tools_called.append(name)
    ctx.context.emitted_results.extend(envelopes)


@function_tool
async def analyze_variances(
    ctx: RunContextWrapper[AnalysisContext],
    group_by: str | None = None,
    direction: str = "all",
    min_severity: str | None = None,
    department: str | None = None,
    category: str | None = None,
    rank_by: str = "unfavorable",
) -> str:
    """Analyze budget vs actual variances for the selected scenario.

    Args:
        group_by: Optionally aggregate results by "department" or "category".
        direction: "over" for over-budget/unfavorable, "under" for
            under-budget/favorable, or "all" (default) for both.
        min_severity: Optionally filter to "low", "medium", or "high" severity
            and above.
        department: Optionally restrict to a single department by exact name.
        category: Optionally restrict to a single category by exact name.
        rank_by: "unfavorable" (default) sorts by most over budget first;
            "magnitude" sorts by largest absolute change (which item moved most).
    """
    if group_by not in (None, "department", "category"):
        raise ValueError("group_by must be 'department' or 'category'")
    if direction not in ("over", "under", "all"):
        raise ValueError("direction must be 'over', 'under', or 'all'")
    if min_severity not in (None, "low", "medium", "high"):
        raise ValueError("min_severity must be 'low', 'medium', or 'high'")
    if rank_by not in ("unfavorable", "magnitude"):
        raise ValueError("rank_by must be 'unfavorable' or 'magnitude'")

    envelopes = await sync_to_async(build_analyze_variances)(
        ctx.context.scenario_id,
        cast("ba.GroupBy | None", group_by),
        cast("ba.Direction", direction),
        cast("ba.Severity | None", min_severity),
        department,
        category,
        cast("ba.RankBy", rank_by),
    )
    _emit(ctx, "analyze_variances", envelopes)

    first = envelopes[0]
    if first["type"] == "grouped_summary":
        summary = ", ".join(
            f"{r['group']}: variance {r['variance_total']}" for r in first["rows"]
        )
        return f"Grouped by {group_by}. {summary or 'No matching groups.'}"
    summary = ", ".join(
        f"{r['department']}/{r['category']}: variance {r['variance']} ({r['severity']})"
        for r in first["rows"]
    )
    return f"{len(first['rows'])} line item(s). {summary or 'No matching line items.'}"


@function_tool
async def identify_budget_risks(
    ctx: RunContextWrapper[AnalysisContext],
    limit: int = 3,
) -> str:
    """Identify the biggest budget risks (largest unfavorable variances).

    Args:
        limit: Maximum number of risks to return (default 3).
    """
    limit = max(MIN_RISK_LIMIT, min(int(limit), MAX_RISK_LIMIT))
    envelopes = await sync_to_async(build_identify_budget_risks)(
        ctx.context.scenario_id, limit
    )
    _emit(ctx, "identify_budget_risks", envelopes)

    items = envelopes[0]["items"]
    if not items:
        return "No over-budget line items were found in this scenario."
    summary = ", ".join(
        f"#{r['rank']} {r['department']}/{r['category']} variance {r['variance']}"
        for r in items
    )
    return f"Top {len(items)} risk(s): {summary}"


@function_tool
async def simulate_spend_change(
    ctx: RunContextWrapper[AnalysisContext],
    target_type: str,
    target_name: str,
    percent_change: float,
) -> str:
    """Run a what-if simulation changing a target's actual spend by a percentage.

    Args:
        target_type: "department" or "category".
        target_name: The exact department or category name to change.
        percent_change: Percentage change to apply to actuals, e.g. -10 for a 10% cut.
    """
    if target_type not in ("department", "category"):
        raise ValueError("target_type must be 'department' or 'category'")
    if not PERCENT_CHANGE_MIN <= percent_change <= PERCENT_CHANGE_MAX:
        raise ValueError(
            f"percent_change must be between {PERCENT_CHANGE_MIN} "
            f"and {PERCENT_CHANGE_MAX}"
        )

    envelopes = await sync_to_async(build_simulate_spend_change)(
        ctx.context.scenario_id,
        cast("ba.GroupBy", target_type),
        target_name,
        Decimal(str(percent_change)),
    )
    _emit(ctx, "simulate_spend_change", envelopes)

    sim = envelopes[0]
    return (
        f"{sim['target']['name']} actuals changed by {sim['percent_change']}%: "
        f"variance {sim['current']['variance_total']} -> "
        f"{sim['projected']['variance_total']}."
    )


@function_tool
async def check_data_quality(ctx: RunContextWrapper[AnalysisContext]) -> str:
    """Check the scenario's line items for data-quality problems.

    Flags spend recorded against a zero budget and rows that are missing a
    description. Takes no arguments; it always scans the whole selected scenario.
    """
    envelopes = await sync_to_async(build_check_data_quality)(ctx.context.scenario_id)
    _emit(ctx, "check_data_quality", envelopes)

    issues = envelopes[0]["issues"]
    if not issues:
        return "No data-quality issues found in this scenario."
    zero = sum(1 for i in issues if i["issue"] == "zero_budget_actual")
    missing = sum(1 for i in issues if i["issue"] == "missing_description")
    parts = []
    if zero:
        parts.append(f"{zero} zero-budget actual(s)")
    if missing:
        parts.append(f"{missing} row(s) missing a description")
    return f"Found {len(issues)} data-quality issue(s): {', '.join(parts)}."


@function_tool
async def explain_metrics(ctx: RunContextWrapper[AnalysisContext]) -> str:
    """Explain how this workspace defines and calculates its metrics.

    Use for conceptual questions about methodology rather than the scenario's
    numbers — e.g. "what does high risk mean", "how is variance/severity/health
    calculated". Returns the definitions of variance, severity, risk, scenario
    health, and the data-quality checks. Takes no arguments and reads no scenario
    data; the definitions are the same for every scenario.
    """
    # No structured card: the definitions are returned for the model to explain.
    return methodology.explain_metrics()


ALL_TOOLS: list[Tool] = [
    analyze_variances,
    identify_budget_risks,
    simulate_spend_change,
    check_data_quality,
    explain_metrics,
]
