"""Unit tests for the deterministic domain layer (no DB, no LLM)."""

from decimal import Decimal

from budgets.services import budget_analysis as ba
from budgets.services import data_quality, risk_rules, simulations
from budgets.services.money import money_str, percent_str

from .conftest import make_item

TOTAL = Decimal("100000")


def compute(items):
    total = sum((i.budget_amount for i in items), Decimal("0"))
    return ba.compute_line_items(items, total), total


def test_variance_and_percent(example_items):
    computed, _ = compute(example_items)
    mkt = computed[0]
    assert mkt.variance == Decimal("15000")
    assert percent_str(mkt.variance_percent) == "30.00"


def test_zero_budget_guards():
    # budget 0, actual > 0 -> percent None, severity high
    item = make_item(1, "HR", "Training", "0", "3000")
    computed = ba.compute_line_items([item], Decimal("0"))[0]
    assert computed.variance_percent is None
    assert computed.severity == "high"


def test_severity_thresholds():
    # share of a 100000 total budget
    assert ba.classify_severity(Decimal("15000"), TOTAL) == "high"  # 15%
    assert ba.classify_severity(Decimal("10000"), TOTAL) == "high"  # 10%
    assert ba.classify_severity(Decimal("7500"), TOTAL) == "medium"  # 7.5%
    assert ba.classify_severity(Decimal("5000"), TOTAL) == "medium"  # 5%
    assert ba.classify_severity(Decimal("4000"), TOTAL) == "low"  # 4%
    assert ba.classify_severity(Decimal("-1500"), TOTAL) is None  # under budget


def test_scenario_zero_total_over_budget_is_high():
    assert ba.classify_severity(Decimal("500"), Decimal("0")) == "high"


def test_example_severities(example_items):
    computed, total = compute(example_items)
    assert total == TOTAL
    by_dept = {c.department: c for c in computed}
    assert by_dept["Marketing"].severity == "high"
    assert by_dept["Sales"].severity == "medium"
    assert by_dept["Engineering"].severity is None  # under budget


def test_filter_over_budget(example_items):
    computed, _ = compute(example_items)
    over = ba.filter_line_items(computed, direction="over")
    assert [r.department for r in over] == ["Marketing", "Sales"]


def test_filter_under_budget(example_items):
    computed, _ = compute(example_items)
    under = ba.filter_line_items(computed, direction="under")
    assert [r.department for r in under] == ["Engineering"]


def test_filter_by_name_is_case_insensitive(example_items):
    computed, _ = compute(example_items)
    rows = ba.filter_line_items(computed, department="  marketing ")
    assert [r.department for r in rows] == ["Marketing"]


def test_rank_by_magnitude_includes_favorable(example_items):
    # A big favorable swing should outrank a smaller unfavorable one.
    items = [
        make_item(1, "Marketing", "Paid Ads", "50000", "52000"),  # +2000
        make_item(2, "Engineering", "Tools", "40000", "10000"),  # -30000
    ]
    computed, _ = compute(items)
    ranked = ba.filter_line_items(computed, rank_by="magnitude")
    assert [r.department for r in ranked] == ["Engineering", "Marketing"]


def test_min_severity_filter(example_items):
    computed, _ = compute(example_items)
    high = ba.filter_line_items(computed, direction="over", min_severity="high")
    assert [r.department for r in high] == ["Marketing"]


def test_grouped_summary(example_items):
    computed, total = compute(example_items)
    groups = ba.group_line_items(computed, "department", total, direction="over")
    by = {g.group: g for g in groups}
    assert money_str(by["Marketing"].variance_total) == "15000.00"
    assert by["Marketing"].severity == "high"
    assert by["Sales"].severity == "medium"
    assert "Engineering" not in by  # under budget filtered out


def test_grouped_under_budget(example_items):
    computed, total = compute(example_items)
    groups = ba.group_line_items(computed, "department", total, direction="under")
    assert [g.group for g in groups] == ["Engineering"]


def test_data_quality_flags_zero_budget_and_missing_description():
    items = [
        make_item(1, "HR", "Training", "0", "3000"),  # zero-budget spend, no desc
        make_item(2, "Sales", "Travel", "20000", "18000", description="Q3 travel"),
        make_item(3, "IT", "SaaS", "5000", "6000", description="   "),  # blank desc
    ]
    issues = data_quality.check_data_quality(items)
    kinds = {(i.line_item_id, i.issue) for i in issues}
    assert (1, "zero_budget_actual") in kinds
    assert (1, "missing_description") in kinds
    assert (3, "missing_description") in kinds  # whitespace-only counts as missing
    # A row with a real budget and a description is clean.
    assert (2, "zero_budget_actual") not in kinds
    assert (2, "missing_description") not in kinds


def test_risk_ranking_and_recommendation(example_items):
    computed, _ = compute(example_items)
    risks = risk_rules.identify_risks(computed, limit=3)
    assert [r.rank for r in risks] == [1, 2]
    assert risks[0].department == "Marketing"
    rec = risk_rules.recommendation_from_risks(risks)
    assert rec is not None
    assert rec.title == "Review Marketing Paid Ads"
    assert rec.severity == "high"
    assert rec.related_line_item_ids == [1]


def test_simulation_math(example_items):
    computed, _ = compute(example_items)
    sim = simulations.simulate_spend_change(
        computed, "department", "Marketing", Decimal("-10")
    )
    assert sim is not None
    assert money_str(sim.current_actual_total) == "65000.00"
    assert money_str(sim.current_variance_total) == "15000.00"
    assert money_str(sim.projected_actual_total) == "58500.00"
    assert money_str(sim.projected_variance_total) == "8500.00"
    assert sim.affected_line_items == 1


def test_simulation_missing_target(example_items):
    computed, _ = compute(example_items)
    sim = simulations.simulate_spend_change(
        computed, "department", "Nonexistent", Decimal("-10")
    )
    assert sim is None
