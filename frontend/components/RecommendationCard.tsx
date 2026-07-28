"use client";

import type { RecommendationCard } from "@/lib/types";

import ResultCard from "./ResultCard";
import SeverityBadge from "./SeverityBadge";

export default function RecommendationCardView({
  result,
}: {
  result: RecommendationCard;
}) {
  return (
    <ResultCard provenance={result.provenance} className="rec">
      <div className="spread">
        <h3 style={{ margin: 0 }}>{result.title}</h3>
        <SeverityBadge severity={result.severity} />
      </div>
      <p style={{ margin: "8px 0 0" }}>{result.body}</p>
    </ResultCard>
  );
}
