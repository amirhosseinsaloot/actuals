"use client";

import type { AnalysisResult } from "@/lib/types";

import DataQualityReportView from "./DataQualityReport";
import GroupedSummaryView from "./GroupedSummary";
import RecommendationCardView from "./RecommendationCard";
import RefusalNotice from "./RefusalNotice";
import RiskListView from "./RiskList";
import SimpleChartView from "./SimpleChart";
import SimulationCard from "./SimulationCard";
import VarianceTableView from "./VarianceTable";

/** Maps a validated result envelope to its renderer. `currency` formats the
 *  money/variance cells consistently with the scenario views. */
export default function AnalysisResultRenderer({
  result,
  currency,
}: {
  result: AnalysisResult;
  currency: string;
}) {
  switch (result.type) {
    case "variance_table":
      return <VarianceTableView result={result} currency={currency} />;
    case "grouped_summary":
      return <GroupedSummaryView result={result} currency={currency} />;
    case "risk_list":
      return <RiskListView result={result} currency={currency} />;
    case "simulation_result":
      return <SimulationCard result={result} currency={currency} />;
    case "simple_chart":
      return <SimpleChartView result={result} currency={currency} />;
    case "recommendation_card":
      return <RecommendationCardView result={result} />;
    case "data_quality_report":
      return <DataQualityReportView result={result} />;
    case "refusal":
      return <RefusalNotice result={result} />;
    default:
      return null;
  }
}
