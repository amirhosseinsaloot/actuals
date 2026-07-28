"""The seed command loads the documented sample data and is idempotent."""

import pytest
from django.core.management import call_command

from budgets.models import BudgetLineItem, BudgetScenario

pytestmark = pytest.mark.django_db


def test_seed_budget_creates_documented_scenarios():
    call_command("seed_budget")

    counts = {
        scenario.name: scenario.line_items.count()
        for scenario in BudgetScenario.objects.all()
    }
    assert counts == {
        "Q3 2026 Operating Budget": 10,
        "Q3 2026 Department Snapshot": 3,
        "Q1 2026 Marketing Budget": 10,
        "Q2 2026 Product Launch": 10,
        "Q3 2026 Operating Expenses": 10,
        "Q3 2026 Contractor & Vendor Spend": 10,
    }


def test_seed_budget_is_idempotent():
    call_command("seed_budget")
    call_command("seed_budget")

    assert BudgetScenario.objects.count() == 6
    assert BudgetLineItem.objects.count() == 53
