"""REST API tests: scenario CRUD, line item CRUD (scoped), assistant-run creation."""

from datetime import date

import pytest
from rest_framework.test import APIClient

from budgets.models import AssistantRun, BudgetLineItem, BudgetScenario

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_scenario_crud(client):
    resp = client.post(
        "/api/scenarios/",
        {
            "name": "New Scenario",
            "period_start": "2026-01-01",
            "period_end": "2026-03-31",
            "currency": "USD",
        },
        format="json",
    )
    assert resp.status_code == 201
    scenario_id = resp.data["id"]

    assert client.get("/api/scenarios/").status_code == 200
    assert client.get(f"/api/scenarios/{scenario_id}/").status_code == 200

    patch = client.patch(
        f"/api/scenarios/{scenario_id}/", {"name": "Renamed"}, format="json"
    )
    assert patch.status_code == 200
    assert patch.data["name"] == "Renamed"

    assert client.delete(f"/api/scenarios/{scenario_id}/").status_code == 204


def test_scenario_rejects_invalid_period(client):
    resp = client.post(
        "/api/scenarios/",
        {
            "name": "Bad period",
            "period_start": "2026-09-30",
            "period_end": "2026-07-01",
            "currency": "USD",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "period_end" in resp.data


def test_scenario_rejects_invalid_currency(client):
    resp = client.post(
        "/api/scenarios/",
        {
            "name": "Bad currency",
            "period_start": "2026-07-01",
            "period_end": "2026-09-30",
            "currency": "US1",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "currency" in resp.data


def test_line_item_crud_scoped(client, example_scenario):
    # Create under the scenario
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/line-items/",
        {
            "department": "Ops",
            "category": "SaaS",
            "budget_amount": "1000.00",
            "actual_amount": "1200.00",
        },
        format="json",
    )
    assert resp.status_code == 201
    item_id = resp.data["id"]
    assert resp.data["scenario"] == example_scenario.id
    assert resp.data["variance"] == "200.00"

    # List is scoped to the scenario (paginated envelope)
    listing = client.get(f"/api/scenarios/{example_scenario.id}/line-items/")
    assert listing.status_code == 200
    assert listing.data["count"] == 4  # 3 seeded + 1
    assert len(listing.data["results"]) == 4

    # Update + delete via the flat line-item route
    patch = client.patch(
        f"/api/line-items/{item_id}/", {"actual_amount": "900.00"}, format="json"
    )
    assert patch.status_code == 200
    assert patch.data["variance"] == "-100.00"
    assert client.delete(f"/api/line-items/{item_id}/").status_code == 204


def test_scenario_totals(client, example_scenario):
    detail = client.get(f"/api/scenarios/{example_scenario.id}/").data
    assert detail["budget_total"] == "100000.00"
    assert detail["actual_total"] == "121000.00"
    assert detail["variance_total"] == "21000.00"
    assert detail["line_item_count"] == 3
    # Health is classified server-side (21% over budget).
    assert detail["health"] == {"status": "over_budget", "label": "Over budget"}


def test_line_item_rejects_negative_amount(client, example_scenario):
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/line-items/",
        {
            "department": "Ops",
            "category": "SaaS",
            "budget_amount": "-100.00",
            "actual_amount": "50.00",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "budget_amount" in resp.data


def test_scenario_list_avoids_n_plus_one(
    client, example_scenario, django_assert_max_num_queries
):
    BudgetScenario.objects.create(
        name="Second", period_start=date(2026, 1, 1), period_end=date(2026, 3, 31)
    )
    # Paginator COUNT + one grouped page query; independent of scenario count.
    with django_assert_max_num_queries(2):
        resp = client.get("/api/scenarios/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2
    assert len(resp.data["results"]) == 2


def test_scenario_list_pagination_and_search(client, example_scenario):
    BudgetScenario.objects.create(
        name="Marketing Review",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
    )
    page = client.get("/api/scenarios/?page_size=1")
    assert page.status_code == 200
    assert page.data["count"] == 2
    assert len(page.data["results"]) == 1
    assert page.data["next"] is not None

    found = client.get("/api/scenarios/?search=Marketing")
    assert found.data["count"] == 1
    assert found.data["results"][0]["name"] == "Marketing Review"


def test_line_item_filtering(client, example_scenario):
    over = client.get(
        f"/api/scenarios/{example_scenario.id}/line-items/?over_budget=true"
    )
    assert {r["department"] for r in over.data["results"]} == {"Marketing", "Sales"}

    under = client.get(
        f"/api/scenarios/{example_scenario.id}/line-items/?over_budget=false"
    )
    assert {r["department"] for r in under.data["results"]} == {"Engineering"}

    # department/category match is case-insensitive (iexact).
    dept = client.get(
        f"/api/scenarios/{example_scenario.id}/line-items/?department=engineering"
    )
    assert dept.data["count"] == 1
    assert dept.data["results"][0]["category"] == "Tools"

    ordered = client.get(
        f"/api/scenarios/{example_scenario.id}/line-items/?ordering=-actual_amount"
    )
    actuals = [r["actual_amount"] for r in ordered.data["results"]]
    assert actuals == sorted(actuals, key=float, reverse=True)


def test_line_item_filter_validation(client, example_scenario):
    resp = client.get(
        f"/api/scenarios/{example_scenario.id}/line-items/?over_budget=maybe"
    )
    assert resp.status_code == 400
    assert "over_budget" in resp.data

    # An empty value means "filter not applied", not an error.
    empty = client.get(f"/api/scenarios/{example_scenario.id}/line-items/?over_budget=")
    assert empty.status_code == 200
    assert empty.data["count"] == 3


def test_scenario_currency_filter(client, example_scenario):
    BudgetScenario.objects.create(
        name="EU Budget",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
        currency="EUR",
    )
    # Case-insensitive match on the 3-letter code.
    resp = client.get("/api/scenarios/?currency=eur")
    assert resp.status_code == 200
    assert resp.data["count"] == 1
    assert resp.data["results"][0]["currency"] == "EUR"


def test_line_item_default_page_size_is_ten(client, example_scenario):
    for i in range(9):  # 3 seeded + 9 = 12 items
        BudgetLineItem.objects.create(
            scenario=example_scenario,
            department="Ops",
            category=f"Extra {i}",
            budget_amount="100.00",
            actual_amount="100.00",
        )
    resp = client.get(f"/api/scenarios/{example_scenario.id}/line-items/")
    assert resp.data["count"] == 12
    assert len(resp.data["results"]) == 10
    assert resp.data["next"] is not None


def test_line_item_list_unknown_scenario_404(client):
    resp = client.get("/api/scenarios/999999/line-items/")
    assert resp.status_code == 404


def test_scenario_detail_query_count(
    client, example_scenario, django_assert_max_num_queries
):
    # Totals come from with_item_totals() annotations: one grouped query.
    with django_assert_max_num_queries(1):
        resp = client.get(f"/api/scenarios/{example_scenario.id}/")
    assert resp.status_code == 200
    assert resp.data["line_item_count"] == 3


def test_assistant_suggestions(client):
    resp = client.get("/api/assistant/suggestions/")
    assert resp.status_code == 200
    suggestions = resp.data["suggestions"]
    assert isinstance(suggestions, list)
    assert "Are there any data-quality issues?" in suggestions


def test_assistant_message_creates_run(client, example_scenario):
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/assistant/messages/",
        {"question": "Which areas are over budget?"},
        format="json",
    )
    assert resp.status_code == 201
    run_id = resp.data["run_id"]
    run = AssistantRun.objects.get(id=run_id)
    assert run.status == AssistantRun.Status.PENDING
    assert run.scenario_id == example_scenario.id


def test_assistant_message_rejects_empty_question(client, example_scenario):
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/assistant/messages/",
        {"question": "   "},
        format="json",
    )
    assert resp.status_code == 400


def test_assistant_message_rejects_bad_context(client, example_scenario):
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/assistant/messages/",
        {"question": "group this", "context": {"type": "not_a_real_type"}},
        format="json",
    )
    assert resp.status_code == 400


def test_assistant_message_accepts_valid_context(client, example_scenario):
    resp = client.post(
        f"/api/scenarios/{example_scenario.id}/assistant/messages/",
        {
            "question": "group this by department",
            "context": {
                "type": "variance_table",
                "provenance": {
                    "tool": "analyze_variances",
                    "params": {},
                    "line_item_ids": [1],
                },
                "rows": [],
            },
        },
        format="json",
    )
    assert resp.status_code == 201
