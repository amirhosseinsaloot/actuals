"use client";

import { variancePresentation } from "@/lib/format";
import type { SimpleChart } from "@/lib/types";

import ResultCard from "./ResultCard";

export default function SimpleChartView({
  result,
  currency,
}: {
  result: SimpleChart;
  currency: string;
}) {
  const values = result.data.map((point) =>
    parseFloat(point[result.y_key] ?? "0"),
  );
  const maxAbsolute = Math.max(1, ...values.map((value) => Math.abs(value)));

  return (
    <ResultCard provenance={result.provenance} className="chart">
      <h3>{result.title}</h3>
      {result.data.length === 0 ? (
        <div className="muted small">No data to chart.</div>
      ) : (
        result.data.map((point, index) => {
          const value = values[index];
          const width = `${(Math.abs(value) / maxAbsolute) * 100}%`;
          // Bar reddens for over-budget (raw variance > 0); the label uses the
          // favorable-signed money convention shared across the app.
          const label = variancePresentation(
            point[result.y_key] ?? "0",
            currency,
          ).text;
          return (
            // Chart rows come from grouped results, so the x value is unique.
            <div className="bar-row" key={point[result.x_key]}>
              <div
                title={point[result.x_key]}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {point[result.x_key]}
              </div>
              <div className="track">
                <div
                  className={`fill ${value > 0 ? "pos" : ""}`}
                  style={{ width }}
                />
              </div>
              <div className="num" style={{ minWidth: 88 }}>
                {label}
              </div>
            </div>
          );
        })
      )}
    </ResultCard>
  );
}
