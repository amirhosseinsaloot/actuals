"""
Structured result schemas (the UI contract).

Every payload streamed to the frontend as a ``result`` event is validated
against one of these Pydantic models first. Money and percentage values are
strings — never floats — to preserve exact Decimal values across the boundary.

These schemas describe *tool output*, not model output. The LLM never produces
this JSON.
"""

from typing import Literal

from pydantic import BaseModel

from budgets.services.budget_analysis import GroupBy, Severity

__all__ = ["GroupBy", "Severity"]


class Provenance(BaseModel):
    tool: str
    params: dict
    line_item_ids: list[int]


# --- variance_table ---------------------------------------------------------
class VarianceRow(BaseModel):
    line_item_id: int
    department: str
    category: str
    budget_amount: str
    actual_amount: str
    variance: str
    variance_percent: str | None = None
    severity: Severity | None = None
    reason: str | None = None


class VarianceTable(BaseModel):
    type: Literal["variance_table"] = "variance_table"
    provenance: Provenance
    rows: list[VarianceRow]


# --- grouped_summary --------------------------------------------------------
class GroupedRow(BaseModel):
    group: str
    budget_total: str
    actual_total: str
    variance_total: str
    variance_percent: str | None = None
    severity: Severity | None = None


class GroupedSummary(BaseModel):
    type: Literal["grouped_summary"] = "grouped_summary"
    provenance: Provenance
    group_by: GroupBy
    rows: list[GroupedRow]


# --- risk_list --------------------------------------------------------------
class RiskListItem(BaseModel):
    rank: int
    line_item_id: int
    department: str
    category: str
    variance: str
    variance_percent: str | None = None
    severity: Severity | None = None
    reason: str


class RiskList(BaseModel):
    type: Literal["risk_list"] = "risk_list"
    provenance: Provenance
    items: list[RiskListItem]


# --- simulation_result ------------------------------------------------------
class SimTarget(BaseModel):
    type: GroupBy
    name: str


class SimTotals(BaseModel):
    actual_total: str
    variance_total: str


class SimulationResultSchema(BaseModel):
    type: Literal["simulation_result"] = "simulation_result"
    provenance: Provenance
    target: SimTarget
    percent_change: str
    current: SimTotals
    projected: SimTotals
    affected_line_items: int


# --- simple_chart -----------------------------------------------------------
class SimpleChart(BaseModel):
    type: Literal["simple_chart"] = "simple_chart"
    provenance: Provenance
    chart_type: Literal["bar"] = "bar"
    title: str
    x_key: str
    y_key: str
    data: list[dict]


# --- recommendation_card ----------------------------------------------------
class RecommendationCard(BaseModel):
    type: Literal["recommendation_card"] = "recommendation_card"
    provenance: Provenance
    title: str
    severity: Severity | None = None
    body: str
    related_line_item_ids: list[int]


# --- data_quality_report ----------------------------------------------------
class DataQualityIssueRow(BaseModel):
    issue: Literal["zero_budget_actual", "missing_description"]
    line_item_id: int
    department: str
    category: str
    detail: str


class DataQualityReport(BaseModel):
    type: Literal["data_quality_report"] = "data_quality_report"
    provenance: Provenance
    issues: list[DataQualityIssueRow]


# --- refusal ----------------------------------------------------------------
class Refusal(BaseModel):
    type: Literal["refusal"] = "refusal"
    message: str


REFUSAL_MESSAGE = (
    "I can only help analyze the selected budget scenario, including variances, "
    "departments, categories, risks, simple what-if changes, and how these "
    "metrics are calculated. Please ask a question about this budget data."
)


def refusal() -> dict:
    return Refusal(message=REFUSAL_MESSAGE).model_dump()


# Follow-up context (a previously streamed result envelope echoed back by the
# frontend) is untrusted input: capped in size and restricted to known types.
MAX_CONTEXT_BYTES = 20 * 1024

# Result envelope "type" values the frontend may echo back as follow-up context.
KNOWN_RESULT_TYPES = {
    "variance_table",
    "grouped_summary",
    "risk_list",
    "simulation_result",
    "simple_chart",
    "recommendation_card",
    "data_quality_report",
    "refusal",
}
