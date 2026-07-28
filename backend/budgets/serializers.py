"""DRF serializers. Derived values (variance, variance %) are computed on read."""

import json
from decimal import Decimal

from rest_framework import serializers

from .ai.schemas import KNOWN_RESULT_TYPES, MAX_CONTEXT_BYTES
from .models import AssistantRun, BudgetLineItem, BudgetScenario
from .services.budget_analysis import line_variance
from .services.money import money_str, percent_str
from .services.scenario_health import scenario_health

# Amounts are inputs; negative budgets/actuals are not a supported domain state.
NON_NEGATIVE = {"min_value": Decimal("0")}


class BudgetLineItemSerializer(serializers.ModelSerializer):
    scenario: serializers.PrimaryKeyRelatedField = serializers.PrimaryKeyRelatedField(
        read_only=True
    )
    variance = serializers.SerializerMethodField()
    variance_percent = serializers.SerializerMethodField()

    class Meta:
        model = BudgetLineItem
        fields = [
            "id",
            "scenario",
            "department",
            "category",
            "description",
            "budget_amount",
            "actual_amount",
            "variance",
            "variance_percent",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "budget_amount": NON_NEGATIVE,
            "actual_amount": NON_NEGATIVE,
        }

    def to_representation(self, instance):
        # variance and variance_percent come from one calculation; compute it
        # once per row here so the two fields below don't each recompute it.
        variance, percent = line_variance(
            Decimal(instance.budget_amount), Decimal(instance.actual_amount)
        )
        self._variance_str = money_str(variance)
        self._variance_percent_str = percent_str(percent)
        return super().to_representation(instance)

    def get_variance(self, obj) -> str:
        return self._variance_str

    def get_variance_percent(self, obj) -> str | None:
        return self._variance_percent_str


class BudgetScenarioSerializer(serializers.ModelSerializer):
    """Scenario payload for list, detail, and write responses.

    ``budget_total`` / ``actual_total`` / ``line_item_count`` come from
    ``BudgetScenarioQuerySet.with_item_totals()`` annotations, so both the list
    and detail endpoints serve totals from a single grouped query. The only
    un-annotated instance this serializer ever sees is the response to a POST
    create, where the scenario is brand new and has no line items — hence the
    zero fallbacks. Line items themselves are served by the paginated
    ``/line-items/`` endpoint, not inlined here.
    """

    budget_total = serializers.SerializerMethodField()
    actual_total = serializers.SerializerMethodField()
    variance_total = serializers.SerializerMethodField()
    line_item_count = serializers.SerializerMethodField()
    health = serializers.SerializerMethodField()

    class Meta:
        model = BudgetScenario
        fields = [
            "id",
            "name",
            "period_start",
            "period_end",
            "currency",
            "created_at",
            "updated_at",
            "budget_total",
            "actual_total",
            "variance_total",
            "line_item_count",
            "health",
        ]

    def validate_currency(self, value: str) -> str:
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError(
                "currency must be a 3-letter code, e.g. USD."
            )
        return value.upper()

    def validate(self, attrs):
        # Return a clean 400 for an invalid period instead of a DB-level 500.
        # Handle partial (PATCH) updates by falling back to the current values.
        start = attrs.get("period_start") or getattr(
            self.instance, "period_start", None
        )
        end = attrs.get("period_end") or getattr(self.instance, "period_end", None)
        if start and end and end < start:
            raise serializers.ValidationError(
                {"period_end": "period_end must be on or after period_start."}
            )
        return attrs

    def get_budget_total(self, obj) -> str:
        return money_str(getattr(obj, "budget_total", Decimal("0")))

    def get_actual_total(self, obj) -> str:
        return money_str(getattr(obj, "actual_total", Decimal("0")))

    def get_variance_total(self, obj) -> str:
        budget = getattr(obj, "budget_total", Decimal("0"))
        actual = getattr(obj, "actual_total", Decimal("0"))
        return money_str(actual - budget)

    def get_line_item_count(self, obj) -> int:
        return getattr(obj, "line_item_count", 0)

    def get_health(self, obj) -> dict[str, str]:
        budget = getattr(obj, "budget_total", Decimal("0"))
        actual = getattr(obj, "actual_total", Decimal("0"))
        health = scenario_health(budget, actual)
        return {"status": health.status, "label": health.label}


class AssistantMessageSerializer(serializers.Serializer):
    """Validates an assistant message request and creates the run."""

    question = serializers.CharField(max_length=2000, trim_whitespace=True)
    # The wire-format key must be "context". At runtime DRF's metaclass pops
    # declared fields off the class, so this does NOT shadow Serializer.context
    # — but mypy cannot see the metaclass, hence the targeted ignore.
    context = serializers.JSONField(required=False, allow_null=True)  # type: ignore[assignment]

    def validate_question(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Question must not be empty.")
        return value.strip()

    def validate_context(self, value):
        if value in (None, "", {}):
            return None
        if not isinstance(value, dict):
            raise serializers.ValidationError("context must be an object.")
        # Untrusted, size-capped, and must look like a known result envelope.
        if len(json.dumps(value)) > MAX_CONTEXT_BYTES:
            raise serializers.ValidationError("context is too large.")
        if value.get("type") not in KNOWN_RESULT_TYPES:
            raise serializers.ValidationError("context has an unknown result type.")
        return value

    def create(self, validated_data):
        # `scenario` arrives via serializer.save(scenario=...) from the view.
        return AssistantRun.objects.create(
            scenario=validated_data["scenario"],
            question=validated_data["question"],
            context=validated_data.get("context"),
        )
