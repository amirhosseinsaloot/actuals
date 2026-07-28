from django.urls import path

from . import views
from .streaming.sse import assistant_stream

urlpatterns = [
    # Scenario CRUD
    path("scenarios/", views.ScenarioListCreate.as_view()),
    path("scenarios/<int:scenario_id>/", views.ScenarioDetail.as_view()),
    # Line item CRUD (scoped to scenario for list/create)
    path(
        "scenarios/<int:scenario_id>/line-items/",
        views.LineItemListCreate.as_view(),
    ),
    path("line-items/<int:line_item_id>/", views.LineItemDetail.as_view()),
    # AI assistant: example prompts for the empty state (scenario-independent).
    path("assistant/suggestions/", views.AssistantSuggestions.as_view()),
    # AI assistant: POST creates a run, GET streams it over SSE.
    path(
        "scenarios/<int:scenario_id>/assistant/messages/",
        views.AssistantMessageCreate.as_view(),
    ),
    path(
        "scenarios/<int:scenario_id>/assistant/stream/",
        assistant_stream,
    ),
]
