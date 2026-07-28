"""Unit tests for scenario health classification (no DB)."""

from decimal import Decimal

from budgets.services.scenario_health import classify_health, scenario_health


def h(budget, actual):
    return classify_health(Decimal(budget), Decimal(actual))


def test_on_track_when_at_or_under_budget():
    assert h("100000", "100000") == "on_track"  # exactly on plan
    assert h("100000", "95000") == "on_track"  # under budget


def test_watch_when_over_by_up_to_ten_percent():
    assert h("100000", "105000") == "watch"  # 5% over
    assert h("100000", "110000") == "watch"  # exactly 10% over is still watch


def test_over_budget_beyond_ten_percent():
    assert h("100000", "110001") == "over_budget"  # just past 10%
    assert h("100000", "121000") == "over_budget"  # 21% over


def test_zero_budget_guards():
    assert h("0", "0") == "on_track"  # nothing budgeted, nothing spent
    assert h("0", "5000") == "over_budget"  # spend against no budget


def test_labels_track_status():
    assert scenario_health(Decimal("100000"), Decimal("121000")).label == "Over budget"
    assert scenario_health(Decimal("100000"), Decimal("105000")).label == "Watch"
    assert scenario_health(Decimal("100000"), Decimal("90000")).label == "On track"
