"""FilterSets for the list endpoints.

django-filter's DRF backend validates query params and returns a field-scoped
400 on invalid input (e.g. ``?over_budget=maybe``), replacing hand-rolled
parsing in the views.
"""

import django_filters as filters
from django.db.models import F

from .models import BudgetLineItem, BudgetScenario


class BudgetScenarioFilterSet(filters.FilterSet):
    currency = filters.CharFilter(lookup_expr="iexact")

    class Meta:
        model = BudgetScenario
        fields = ["currency"]


class BudgetLineItemFilterSet(filters.FilterSet):
    department = filters.CharFilter(lookup_expr="iexact")
    category = filters.CharFilter(lookup_expr="iexact")
    # ChoiceFilter (not BooleanFilter) so unrecognized values 400 instead of
    # being silently coerced to None and skipped.
    over_budget = filters.ChoiceFilter(
        choices=(("true", "true"), ("false", "false")),
        method="filter_over_budget",
    )

    class Meta:
        model = BudgetLineItem
        fields = ["department", "category", "over_budget"]

    def filter_over_budget(self, queryset, name, value):
        if value == "true":
            return queryset.filter(actual_amount__gt=F("budget_amount"))
        return queryset.filter(actual_amount__lte=F("budget_amount"))
