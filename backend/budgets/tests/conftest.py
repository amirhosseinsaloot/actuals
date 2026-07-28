from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from budgets.models import BudgetLineItem, BudgetScenario


def make_item(item_id, department, category, budget, actual, description=""):
    """Lightweight stand-in for a line item for pure-function tests (no DB)."""
    return SimpleNamespace(
        id=item_id,
        department=department,
        category=category,
        description=description,
        budget_amount=Decimal(budget),
        actual_amount=Decimal(actual),
    )


@pytest.fixture
def example_items():
    """Three items with a round total budget of 100000, so the severity
    thresholds (high >= 10%, medium >= 5% of the total) are easy to assert."""
    return [
        make_item(1, "Marketing", "Paid Ads", "50000", "65000"),
        make_item(2, "Sales", "Travel", "20000", "27500"),
        make_item(3, "Engineering", "Tools", "30000", "28500"),
    ]


@pytest.fixture
def example_scenario(db):
    scenario = BudgetScenario.objects.create(
        name="Q3 2026 Department Snapshot",
        period_start=date(2026, 7, 1),
        period_end=date(2026, 9, 30),
        currency="USD",
    )
    rows = [
        ("Marketing", "Paid Ads", "50000", "65000"),
        ("Sales", "Travel", "20000", "27500"),
        ("Engineering", "Tools", "30000", "28500"),
    ]
    for dept, cat, budget, actual in rows:
        BudgetLineItem.objects.create(
            scenario=scenario,
            department=dept,
            category=cat,
            budget_amount=Decimal(budget),
            actual_amount=Decimal(actual),
        )
    return scenario
