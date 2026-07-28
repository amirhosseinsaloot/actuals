"use client";

import {
  formatVariancePercent,
  toneClass,
  variancePresentation,
} from "@/lib/format";
import type { VarianceTable } from "@/lib/types";

import ResultCard from "./ResultCard";
import SeverityBadge from "./SeverityBadge";

export default function VarianceTableView({
  result,
  currency,
}: {
  result: VarianceTable;
  currency: string;
}) {
  return (
    <ResultCard provenance={result.provenance}>
      <h3>Variance table</h3>
      {result.rows.length === 0 ? (
        <div className="muted small">No matching line items.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Category</th>
                <th className="num">Variance</th>
                <th className="num">%</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                // Favorable convention (overspend negative/red), matching the
                // scenario metric cards and the line-item table.
                const variance = variancePresentation(row.variance, currency);
                return (
                  <tr key={row.line_item_id}>
                    <td>{row.department}</td>
                    <td>{row.category}</td>
                    <td className={`num ${toneClass(variance.tone)}`}>
                      {variance.text}
                    </td>
                    <td className="num">
                      {formatVariancePercent(row.variance_percent)}
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
