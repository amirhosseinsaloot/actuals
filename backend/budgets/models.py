"""
Data model for the budget workspace.

Only *inputs* are stored. Derived values such as variance, variance percent,
and severity are computed on read by the domain services — never persisted —
so there is a single source of truth for the math.
"""

import uuid

from django.db import models
from django.db.models import Count, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

MONEY_FIELD: models.DecimalField = models.DecimalField(max_digits=14, decimal_places=2)


class BudgetScenarioQuerySet(models.QuerySet):
    def with_item_totals(self):
        """Annotate line-item count and budget/actual totals per scenario.

        Shared by the list and detail endpoints so totals math lives in exactly
        one place. Uses correlated subqueries rather than a JOIN + GROUP BY: a
        GROUP BY aggregates every scenario's line items before LIMIT, so a
        paginated list would scan all line items on each request; these
        subqueries aggregate only the scenarios actually returned. Totals stay
        derived-on-read (never stored), so they cannot drift from the rows.
        """
        items = BudgetLineItem.objects.filter(scenario=OuterRef("pk")).values(
            "scenario"
        )

        def item_total(field):
            summed = items.annotate(total=Sum(field)).values("total")
            return Coalesce(
                Subquery(summed, output_field=MONEY_FIELD),
                Value(0),
                output_field=MONEY_FIELD,
            )

        counted = items.annotate(n=Count("id")).values("n")
        return self.annotate(
            line_item_count=Coalesce(
                Subquery(counted, output_field=IntegerField()),
                Value(0),
                output_field=IntegerField(),
            ),
            budget_total=item_total("budget_amount"),
            actual_total=item_total("actual_amount"),
        )


class BudgetScenario(models.Model):
    name = models.CharField(max_length=200)
    period_start = models.DateField()
    period_end = models.DateField()
    currency = models.CharField(max_length=3, default="USD")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BudgetScenarioQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(period_end__gte=models.F("period_start")),
                name="scenario_period_valid",
            )
        ]

    def __str__(self) -> str:
        return self.name


class BudgetLineItem(models.Model):
    scenario = models.ForeignKey(
        BudgetScenario,
        related_name="line_items",
        on_delete=models.CASCADE,
    )
    department = models.CharField(max_length=120)
    category = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    budget_amount = models.DecimalField(max_digits=14, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=14, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["scenario", "department"]),
            models.Index(fields=["scenario", "category"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(budget_amount__gte=0)
                & models.Q(actual_amount__gte=0),
                name="lineitem_amounts_non_negative",
            )
        ]

    def __str__(self) -> str:
        return f"{self.department} / {self.category}"


class AssistantRun(models.Model):
    """
    Exists only to support the POST-to-GET SSE handoff. It is not full
    persisted chat history.
    """

    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        COMPLETED = "completed"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.ForeignKey(
        BudgetScenario,
        related_name="assistant_runs",
        on_delete=models.CASCADE,
    )
    question = models.TextField()
    context = models.JSONField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["scenario", "status"])]

    def __str__(self) -> str:
        return f"AssistantRun({self.id}, {self.status})"
