"""The methodology reference stays in sync with the calculation constants."""

from budgets.ai.tools import ALL_TOOLS, explain_metrics
from budgets.services import methodology
from budgets.services.budget_analysis import HIGH_THRESHOLD, MEDIUM_THRESHOLD
from budgets.services.scenario_health import OVER_THRESHOLD


def test_definitions_cover_the_core_metrics():
    defs = methodology.metric_definitions()
    assert {"variance", "severity", "risk", "health", "data_quality"} <= set(defs)


def test_thresholds_are_rendered_from_the_constants():
    text = methodology.explain_metrics()
    assert f"{int(HIGH_THRESHOLD * 100)}%" in text  # High = 10%
    assert f"{int(MEDIUM_THRESHOLD * 100)}%" in text  # Medium = 5%
    assert f"{int(OVER_THRESHOLD * 100)}%" in text  # health "over budget" = 10%


def test_reference_describes_the_core_rules():
    text = methodology.explain_metrics().lower()
    assert "actual - budget" in text
    assert "zero budget" in text
    assert "missing a description" in text


def test_explain_metrics_tool_is_registered():
    assert explain_metrics in ALL_TOOLS
