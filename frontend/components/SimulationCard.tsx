"use client";

import { money, toneClass, variancePresentation } from "@/lib/format";
import type { SimulationResult } from "@/lib/types";

import ResultCard from "./ResultCard";

export default function SimulationCard({
  result,
  currency,
}: {
  result: SimulationResult;
  currency: string;
}) {
  const currentVariance = parseFloat(result.current.variance_total);
  const projectedVariance = parseFloat(result.projected.variance_total);
  const improved = projectedVariance < currentVariance;

  const currentVar = variancePresentation(
    result.current.variance_total,
    currency,
  );
  const projectedVar = variancePresentation(
    result.projected.variance_total,
    currency,
  );
  const pct = parseFloat(result.percent_change);
  const pctLabel = `${pct > 0 ? "+" : ""}${pct}%`;

  return (
    <ResultCard provenance={result.provenance}>
      <h3>
        What-if: {result.target.name} ({result.target.type}) {pctLabel} actuals
      </h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th />
              <th className="num">Actual total</th>
              <th className="num">Variance total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Current</td>
              <td className="num">
                {money(result.current.actual_total, currency)}
              </td>
              <td className={`num ${toneClass(currentVar.tone)}`}>
                {currentVar.text}
              </td>
            </tr>
            <tr>
              <td>Projected</td>
              <td className="num">
                {money(result.projected.actual_total, currency)}
              </td>
              <td className={`num ${toneClass(projectedVar.tone)}`}>
                {projectedVar.text}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        {result.affected_line_items} line item(s) affected.{" "}
        {improved
          ? "Variance improves under this change."
          : "Variance worsens under this change."}
      </div>
    </ResultCard>
  );
}
