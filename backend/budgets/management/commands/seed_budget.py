"""
Idempotent seed data: six budget scenarios across 2026.

1. "Q3 2026 Operating Budget" — company-wide, five departments.
2. "Q3 2026 Department Snapshot" — a three-row extract of the operating budget.
3. "Q1 2026 Marketing Budget" — demand gen, brand, content, events.
4. "Q2 2026 Product Launch" — launch spend including contractor costs.
5. "Q3 2026 Operating Expenses" — G&A opex; comes in under budget.
6. "Q3 2026 Contractor & Vendor Spend" — outsourced and vendor spend.

The rows mirror a typical budget export: some scenarios overspend and some
come in under, and a few entries are missing descriptions or carry spend
against no budget.

Running it repeatedly is safe: scenarios are matched by name and their line
items are only created when the scenario has none.
"""

from datetime import date
from decimal import Decimal
from typing import TypedDict

from django.core.management.base import BaseCommand
from django.db import transaction

from budgets.models import BudgetLineItem, BudgetScenario

# (department, category, description, budget, actual)
SeedItem = tuple[str, str, str, str, str]


class ScenarioSpec(TypedDict):
    name: str
    period_start: date
    period_end: date
    currency: str
    items: list[SeedItem]


OPERATING_Q3: ScenarioSpec = {
    "name": "Q3 2026 Operating Budget",
    "period_start": date(2026, 7, 1),
    "period_end": date(2026, 9, 30),
    "currency": "USD",
    "items": [
        # department, category, description, budget, actual
        ("Marketing", "Paid Ads", "Search & social campaigns", "50000", "65000"),
        ("Marketing", "Content", "Blog and video production", "20000", "18000"),
        ("Sales", "Travel", "Client visits and conferences", "20000", "27500"),
        ("Sales", "Commissions", "Quota attainment payouts", "35000", "41000"),
        ("Engineering", "Tools", "Developer tooling licenses", "30000", "28500"),
        ("Engineering", "Cloud", "Compute and storage", "45000", "52000"),
        ("Operations", "Vendors", "Outsourced services", "40000", "42000"),
        ("Operations", "Facilities", "Office and utilities", "25000", "25000"),
        ("HR", "Recruiting", "Agency and job boards", "15000", "12000"),
        ("HR", "Training", "Unbudgeted certification program", "0", "3000"),
    ],
}

SNAPSHOT: ScenarioSpec = {
    "name": "Q3 2026 Department Snapshot",
    "period_start": date(2026, 7, 1),
    "period_end": date(2026, 9, 30),
    "currency": "USD",
    "items": [
        ("Marketing", "Paid Ads", "Search & social campaigns", "50000", "65000"),
        ("Sales", "Travel", "Client visits and conferences", "20000", "27500"),
        ("Engineering", "Tools", "Developer tooling licenses", "30000", "28500"),
    ],
}

# Q1 — Marketing: demand gen, brand, content, events.
MARKETING_Q1: ScenarioSpec = {
    "name": "Q1 2026 Marketing Budget",
    "period_start": date(2026, 1, 1),
    "period_end": date(2026, 3, 31),
    "currency": "USD",
    "items": [
        ("Demand Gen", "Paid Search", "Google & Bing campaigns", "60000", "76000"),
        ("Demand Gen", "Paid Social", "LinkedIn & Meta paid social", "45000", "38000"),
        ("Demand Gen", "Webinars", "", "12000", "9500"),
        ("Brand", "Sponsorships", "Industry conference sponsorships", "30000", "32000"),
        ("Brand", "Influencer Program", "", "0", "9000"),
        ("Content", "SEO Retainer", "Agency SEO retainer", "24000", "21000"),
        ("Content", "Blog & Video", "Freelance content production", "18000", "20500"),
        ("Events", "Trade Show Booth", "Q1 flagship trade show", "50000", "47000"),
        ("Events", "Field Dinners", "Regional prospect dinners", "15000", "22000"),
        ("Marketing Ops", "Martech Licenses", "HubSpot & 6sense", "20000", "20000"),
    ],
}

# Q2 — Product launch, including contractor and agency costs.
PRODUCT_LAUNCH_Q2: ScenarioSpec = {
    "name": "Q2 2026 Product Launch",
    "period_start": date(2026, 4, 1),
    "period_end": date(2026, 6, 30),
    "currency": "USD",
    "items": [
        ("Product", "Market Research", "User interviews & surveys", "15000", "12000"),
        ("Engineering", "Launch Infra", "Scaling & load testing", "40000", "53000"),
        ("Engineering", "Contractor Dev", "Backend contractors", "30000", "34000"),
        ("Design", "Brand & Assets", "Launch creative & video", "25000", "23000"),
        ("Marketing", "Launch Campaign", "PR, paid, and email", "60000", "62000"),
        ("Marketing", "Analyst Relations", "", "20000", "17000"),
        ("Sales Enablement", "Training", "", "18000", "18000"),
        ("Customer Success", "Onboarding", "Launch onboarding", "22000", "19000"),
        ("Product", "Beta Incentives", "", "0", "6000"),
        ("Engineering", "Monitoring Tools", "APM & observability", "12000", "14500"),
    ],
}

# Q3 — General & administrative operating expenses.
OPEX_Q3: ScenarioSpec = {
    "name": "Q3 2026 Operating Expenses",
    "period_start": date(2026, 7, 1),
    "period_end": date(2026, 9, 30),
    "currency": "USD",
    "items": [
        ("Facilities", "Office Lease", "HQ + regional offices", "90000", "88000"),
        ("Facilities", "Utilities", "Electricity, water, internet", "18000", "21000"),
        ("IT", "SaaS Subscriptions", "Company-wide SaaS renewals", "45000", "39000"),
        ("IT", "Hardware Refresh", "Laptop replacements", "30000", "24000"),
        ("Finance", "Audit & Tax", "External audit fees", "25000", "25000"),
        ("HR", "Benefits Admin", "Benefits platform & broker", "20000", "17500"),
        ("HR", "Recruiting Agencies", "", "15000", "26000"),
        ("Operations", "Logistics", "Fulfillment & freight", "22000", "20000"),
        ("Legal", "Outside Counsel", "Corporate legal retainer", "28000", "24000"),
        ("Operations", "Software Overage", "Unbudgeted license overage", "0", "4000"),
    ],
}

# Q3 — Outsourced contractor and vendor spend.
CONTRACTOR_Q3: ScenarioSpec = {
    "name": "Q3 2026 Contractor & Vendor Spend",
    "period_start": date(2026, 7, 1),
    "period_end": date(2026, 9, 30),
    "currency": "USD",
    "items": [
        ("Operations", "Managed Services", "Outsourced IT services", "50000", "49000"),
        ("Engineering", "Frontend Contractor", "React contractor", "36000", "30000"),
        ("Marketing", "Design Contractor", "Brand & design work", "24000", "21000"),
        ("HR", "Recruiting Agency", "Exec search agency fees", "20000", "17000"),
        ("Engineering", "Data Pipeline Vendor", "ETL & warehouse", "30000", "33000"),
        ("Operations", "Security Audit", "", "15000", "15000"),
        ("Product", "UX Research Vendor", "Usability testing vendor", "12000", "9000"),
        (
            "Engineering",
            "Contractor Overtime",
            "Sprint overtime true-up",
            "6000",
            "7000",
        ),
        ("Marketing", "Translation Vendor", "Localization & i18n", "10000", "13500"),
        ("Finance", "Payroll Vendor", "Contractor payroll processing", "8000", "8000"),
    ],
}

SCENARIOS: tuple[ScenarioSpec, ...] = (
    OPERATING_Q3,
    SNAPSHOT,
    MARKETING_Q1,
    PRODUCT_LAUNCH_Q2,
    OPEX_Q3,
    CONTRACTOR_Q3,
)


class Command(BaseCommand):
    help = "Load idempotent seed budget scenarios and line items."

    @transaction.atomic
    def handle(self, *args, **options):
        for spec in SCENARIOS:
            scenario, created = BudgetScenario.objects.get_or_create(
                name=spec["name"],
                defaults={
                    "period_start": spec["period_start"],
                    "period_end": spec["period_end"],
                    "currency": spec["currency"],
                },
            )
            if scenario.line_items.exists():
                self.stdout.write(
                    f"Scenario '{scenario.name}' already has line items; skipping."
                )
                continue

            BudgetLineItem.objects.bulk_create(
                [
                    BudgetLineItem(
                        scenario=scenario,
                        department=dept,
                        category=cat,
                        description=desc,
                        budget_amount=Decimal(budget),
                        actual_amount=Decimal(actual),
                    )
                    for dept, cat, desc, budget, actual in spec["items"]
                ]
            )
            verb = "Created" if created else "Populated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{verb} scenario '{scenario.name}' with "
                    f"{len(spec['items'])} line items."
                )
            )
