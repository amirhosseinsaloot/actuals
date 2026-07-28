"""Each tool builder returns schema-valid, deterministic output with provenance."""

import json
from decimal import Decimal

import pytest
from agents.tool_context import ToolContext

from budgets.ai import schemas
from budgets.ai.tools import (
    AnalysisContext,
    analyze_variances,
    build_analyze_variances,
    build_check_data_quality,
    build_identify_budget_risks,
    build_simulate_spend_change,
    identify_budget_risks,
    simulate_spend_change,
)

pytestmark = pytest.mark.django_db


async def _invoke_tool(
    tool, args: dict, scenario_id: int = 1
) -> tuple[str, AnalysisContext]:
    """Invoke a @function_tool wrapper the way the Agents SDK does.

    Exercises the wrapper's parameter guards (which the pure ``build_*`` tests
    bypass). The SDK catches a tool's exception and returns the error as text,
    so a rejected argument surfaces as a string containing the guard message.
    """
    ctx = ToolContext(
        context=AnalysisContext(scenario_id=scenario_id), tool_call_id="test-call"
    )
    output = await tool.on_invoke_tool(ctx, json.dumps(args))
    return output, ctx.context


def _validate(envelope: dict):
    """Round-trip an envelope through its schema to prove it is valid."""
    model = {
        "variance_table": schemas.VarianceTable,
        "grouped_summary": schemas.GroupedSummary,
        "risk_list": schemas.RiskList,
        "simulation_result": schemas.SimulationResultSchema,
        "simple_chart": schemas.SimpleChart,
        "recommendation_card": schemas.RecommendationCard,
        "data_quality_report": schemas.DataQualityReport,
    }[envelope["type"]]
    model(**envelope)  # raises on invalid payload


def test_analyze_variances_table_and_chart(example_scenario):
    results = build_analyze_variances(example_scenario.id, direction="over")
    for env in results:
        _validate(env)
        assert env["provenance"]["tool"] == "analyze_variances"
    table, chart = results
    assert table["type"] == "variance_table"
    assert [r["department"] for r in table["rows"]] == ["Marketing", "Sales"]
    assert table["rows"][0]["severity"] == "high"
    assert table["rows"][1]["severity"] == "medium"
    assert chart["type"] == "simple_chart"
    assert chart["provenance"]["line_item_ids"]


def test_analyze_variances_grouped_high_only(example_scenario):
    results = build_analyze_variances(
        example_scenario.id, group_by="department", min_severity="high"
    )
    grouped = results[0]
    _validate(grouped)
    assert grouped["type"] == "grouped_summary"
    assert [r["group"] for r in grouped["rows"]] == ["Marketing"]
    assert grouped["rows"][0]["variance_total"] == "15000.00"


def test_identify_budget_risks(example_scenario):
    results = build_identify_budget_risks(example_scenario.id, limit=3)
    risk_list, rec = results
    _validate(risk_list)
    _validate(rec)
    assert risk_list["items"][0]["department"] == "Marketing"
    # Exact copy is pinned in the domain-layer test; here just check substance.
    assert "Marketing" in rec["title"]
    assert rec["severity"] == "high"
    assert rec["provenance"]["line_item_ids"]


def test_simulate_spend_change(example_scenario):
    results = build_simulate_spend_change(
        example_scenario.id, "department", "Marketing", Decimal("-10")
    )
    sim, rec = results
    _validate(sim)
    _validate(rec)
    assert sim["projected"]["actual_total"] == "58500.00"
    assert sim["projected"]["variance_total"] == "8500.00"
    assert sim["percent_change"] == "-10.00"


def test_analyze_variances_filter_by_name(example_scenario):
    results = build_analyze_variances(example_scenario.id, department="Marketing")
    table = results[0]
    _validate(table)
    assert table["type"] == "variance_table"
    assert [r["department"] for r in table["rows"]] == ["Marketing"]


def test_analyze_variances_under_budget(example_scenario):
    results = build_analyze_variances(example_scenario.id, direction="under")
    table = results[0]
    _validate(table)
    assert [r["department"] for r in table["rows"]] == ["Engineering"]


def test_check_data_quality(example_scenario):
    # Seeded line items have blank descriptions, so each is flagged.
    results = build_check_data_quality(example_scenario.id)
    report = results[0]
    _validate(report)
    assert report["type"] == "data_quality_report"
    assert report["provenance"]["tool"] == "check_data_quality"
    assert {i["issue"] for i in report["issues"]} == {"missing_description"}
    assert len(report["issues"]) == 3


def test_simulate_missing_target_raises(example_scenario):
    with pytest.raises(ValueError):
        build_simulate_spend_change(
            example_scenario.id, "department", "Ghost", Decimal("-10")
        )


# --------------------------------------------------------------------------- #
# @function_tool wrapper guards (the pure-builder tests above bypass these).   #
# These run no ORM/DB — the guards reject before the builder is ever called.   #
# --------------------------------------------------------------------------- #
async def test_wrappers_reject_invalid_params():
    """Bad enums and out-of-range numbers are rejected by the wrapper guards."""
    out, _ = await _invoke_tool(analyze_variances, {"direction": "sideways"})
    assert "direction must be" in out
    out, _ = await _invoke_tool(analyze_variances, {"group_by": "region"})
    assert "group_by must be" in out
    out, _ = await _invoke_tool(analyze_variances, {"min_severity": "critical"})
    assert "min_severity must be" in out

    out, _ = await _invoke_tool(
        simulate_spend_change,
        {"target_type": "region", "target_name": "X", "percent_change": 10},
    )
    assert "target_type must be" in out
    out, _ = await _invoke_tool(
        simulate_spend_change,
        {"target_type": "department", "target_name": "X", "percent_change": 999},
    )
    assert "percent_change must be between" in out


async def test_identify_risks_wrapper_clamps_limit(monkeypatch):
    """A limit outside [1, 20] is clamped before it reaches the builder."""
    seen: list[int] = []

    def fake_build(scenario_id: int, limit: int) -> list[dict]:
        seen.append(limit)
        return [
            {
                "type": "risk_list",
                "provenance": {
                    "tool": "identify_budget_risks",
                    "params": {"limit": limit},
                    "line_item_ids": [],
                },
                "items": [],
            }
        ]

    # The wrapper resolves the builder by module global at call time, so this
    # patch is picked up inside its sync_to_async call.
    monkeypatch.setattr("budgets.ai.tools.build_identify_budget_risks", fake_build)

    await _invoke_tool(identify_budget_risks, {"limit": 100})
    await _invoke_tool(identify_budget_risks, {"limit": 0})
    assert seen == [20, 1]
