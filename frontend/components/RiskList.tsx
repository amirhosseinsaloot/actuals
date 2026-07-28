"use client";

import { toneClass, variancePresentation } from "@/lib/format";
import type { RiskList } from "@/lib/types";

import ResultCard from "./ResultCard";
import SeverityBadge from "./SeverityBadge";

export default function RiskListView({
  result,
  currency,
}: {
  result: RiskList;
  currency: string;
}) {
  return (
    <ResultCard provenance={result.provenance}>
      <h3>Top budget risks</h3>
      {result.items.length === 0 ? (
        <div className="muted small">No over-budget line items found.</div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {result.items.map((item) => {
            const variance = variancePresentation(item.variance, currency);
            return (
              <div
                key={item.line_item_id}
                className="spread"
                style={{ gap: 10 }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    #{item.rank} {item.department} · {item.category}
                  </div>
                  <div className="muted small">{item.reason}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    className={toneClass(variance.tone)}
                    style={{ fontWeight: 600 }}
                  >
                    {variance.text}
                  </div>
                  <SeverityBadge severity={item.severity} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ResultCard>
  );
}
