"use client";

import { money, toneClass, variancePresentation } from "@/lib/format";
import type { GroupedSummary } from "@/lib/types";

import ResultCard from "./ResultCard";
import SeverityBadge from "./SeverityBadge";

export default function GroupedSummaryView({
  result,
  currency,
}: {
  result: GroupedSummary;
  currency: string;
}) {
  return (
    <ResultCard provenance={result.provenance}>
      <h3>Grouped by {result.group_by}</h3>
      {result.rows.length === 0 ? (
        <div className="muted small">No matching groups.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ textTransform: "capitalize" }}>
                  {result.group_by}
                </th>
                <th className="num">Budget</th>
                <th className="num">Actual</th>
                <th className="num">Variance</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const variance = variancePresentation(
                  row.variance_total,
                  currency,
                );
                return (
                  <tr key={row.group}>
                    <td>{row.group}</td>
                    <td className="num">{money(row.budget_total, currency)}</td>
                    <td className="num">{money(row.actual_total, currency)}</td>
                    <td className={`num ${toneClass(variance.tone)}`}>
                      {variance.text}
                    </td>
                    <td>
                      <SeverityBadge severity={row.severity} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ResultCard>
  );
}
