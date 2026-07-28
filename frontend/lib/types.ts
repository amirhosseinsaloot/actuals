// Mirrors the backend DRF + structured-result schemas.

export type Severity = "low" | "medium" | "high" | null;

/** Scenario-level status, classified by the backend from budget vs. actual. */
export type HealthStatus = "on_track" | "watch" | "over_budget";

export interface Health {
  status: HealthStatus;
  label: string;
}

/** Standard DRF pagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Scenario {
  id: number;
  name: string;
  period_start: string;
  period_end: string;
  currency: string;
  created_at: string;
  updated_at: string;
  line_item_count: number;
  // Scenario health, classified by the backend (single source of truth).
  health: Health;
  // present on detail responses
  line_items?: LineItem[];
  budget_total?: string;
  actual_total?: string;
  variance_total?: string;
}

export interface LineItem {
  id: number;
  scenario: number;
  department: string;
  category: string;
  description: string;
  budget_amount: string;
  actual_amount: string;
  variance: string;
  variance_percent: string | null;
  created_at: string;
  updated_at: string;
}

export interface Provenance {
  tool: string;
  params: Record<string, unknown>;
  line_item_ids: number[];
}

export interface VarianceRow {
  line_item_id: number;
  department: string;
  category: string;
  budget_amount: string;
  actual_amount: string;
  variance: string;
  variance_percent: string | null;
  severity: Severity;
  reason: string | null;
}

export interface VarianceTable {
  type: "variance_table";
  provenance: Provenance;
  rows: VarianceRow[];
}

export interface GroupedRow {
  group: string;
  budget_total: string;
  actual_total: string;
  variance_total: string;
  variance_percent: string | null;
  severity: Severity;
}

export interface GroupedSummary {
  type: "grouped_summary";
  provenance: Provenance;
  group_by: "department" | "category";
  rows: GroupedRow[];
}

export interface RiskItem {
  rank: number;
  line_item_id: number;
  department: string;
  category: string;
  variance: string;
  variance_percent: string | null;
  severity: Severity;
  reason: string;
}

export interface RiskList {
  type: "risk_list";
  provenance: Provenance;
  items: RiskItem[];
}

export interface SimulationResult {
  type: "simulation_result";
  provenance: Provenance;
  target: { type: "department" | "category"; name: string };
  percent_change: string;
  current: { actual_total: string; variance_total: string };
  projected: { actual_total: string; variance_total: string };
  affected_line_items: number;
}

export interface SimpleChart {
  type: "simple_chart";
  provenance: Provenance;
  chart_type: "bar";
  title: string;
  x_key: string;
  y_key: string;
  data: Array<Record<string, string>>;
}

export interface RecommendationCard {
  type: "recommendation_card";
  provenance: Provenance;
  title: string;
  severity: Severity;
  body: string;
  related_line_item_ids: number[];
}

export interface DataQualityIssue {
  issue: "zero_budget_actual" | "missing_description";
  line_item_id: number;
  department: string;
  category: string;
  detail: string;
}

export interface DataQualityReport {
  type: "data_quality_report";
  provenance: Provenance;
  issues: DataQualityIssue[];
}

export interface Refusal {
  type: "refusal";
  message: string;
}

export type AnalysisResult =
  | VarianceTable
  | GroupedSummary
  | RiskList
  | SimulationResult
  | SimpleChart
  | RecommendationCard
  | DataQualityReport
  | Refusal;

// A single assistant turn shown in the chat panel.
export interface ChatTurn {
  id: string;
  question: string;
  status: string | null;
  text: string;
  results: AnalysisResult[];
  error: string | null;
  streaming: boolean;
}
