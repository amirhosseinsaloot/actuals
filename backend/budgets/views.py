"""DRF CRUD views and the assistant-run creation endpoint (the POST half of the
POST-then-GET SSE handoff).

Views stay thin: filtering is declared in ``filters.py`` FilterSets, totals
annotations live on ``BudgetScenarioQuerySet``, and validation lives in the
serializers. List endpoints are paginated and support server-side filtering,
search, and ordering; invalid filter values return a field-scoped 400.
"""

from functools import cached_property

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai.suggestions import ASSISTANT_SUGGESTIONS
from .filters import BudgetLineItemFilterSet, BudgetScenarioFilterSet
from .models import BudgetLineItem, BudgetScenario
from .pagination import StandardResultsPagination
from .serializers import (
    AssistantMessageSerializer,
    BudgetLineItemSerializer,
    BudgetScenarioSerializer,
)


class ScenarioListCreate(generics.ListCreateAPIView):
    serializer_class = BudgetScenarioSerializer
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BudgetScenarioFilterSet
    search_fields = ["name"]
    ordering_fields = ["name", "created_at", "period_start", "period_end"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return BudgetScenario.objects.with_item_totals()


class ScenarioDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BudgetScenarioSerializer
    lookup_url_kwarg = "scenario_id"

    def get_queryset(self):
        return BudgetScenario.objects.with_item_totals()


class LineItemListCreate(generics.ListCreateAPIView):
    serializer_class = BudgetLineItemSerializer
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BudgetLineItemFilterSet
    search_fields = ["department", "category", "description"]
    ordering_fields = ["department", "category", "budget_amount", "actual_amount", "id"]
    ordering = ["id"]

    @cached_property
    def scenario(self):
        """404 for an unknown scenario instead of a misleading empty list;
        cached so list and create each hit the DB once."""
        return get_object_or_404(BudgetScenario, pk=self.kwargs["scenario_id"])

    def get_queryset(self):
        return BudgetLineItem.objects.filter(scenario=self.scenario)

    def perform_create(self, serializer):
        serializer.save(scenario=self.scenario)


class LineItemDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = BudgetLineItem.objects.all()
    serializer_class = BudgetLineItemSerializer
    lookup_url_kwarg = "line_item_id"


class AssistantSuggestions(APIView):
    """GET the example questions shown in the assistant's empty state.

    Static and scenario-independent; served so the list lives in one place next
    to the tools that answer it, instead of being duplicated in the frontend.
    """

    def get(self, request):
        return Response({"suggestions": ASSISTANT_SUGGESTIONS})


class AssistantMessageCreate(APIView):
    """POST a question -> create AssistantRun -> return run_id for the SSE stream."""

    def post(self, request, scenario_id):
        scenario = get_object_or_404(BudgetScenario, pk=scenario_id)
        serializer = AssistantMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run = serializer.save(scenario=scenario)
        return Response({"run_id": str(run.id)}, status=status.HTTP_201_CREATED)
