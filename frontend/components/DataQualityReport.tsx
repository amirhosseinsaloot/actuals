"use client";

import type { DataQualityIssue, DataQualityReport } from "@/lib/types";

import ResultCard from "./ResultCard";

const ISSUE_LABELS: Record<DataQualityIssue["issue"], string> = {
  zero_budget_actual: "Zero-budget spend",
  missing_description: "Missing description",
};

export default function DataQualityReportView({
  result,
}: {
  result: DataQualityReport;
}) {
  return (
    <ResultCard provenance={result.provenance}>
      <h3>Data quality</h3>
      {result.issues.length === 0 ? (
        <div className="muted small">No data-quality issues found.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Department</th>
                <th>Category</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {result.issues.map((issue) => (
                <tr key={`${issue.line_item_id}-${issue.issue}`}>
                  <td>
                    <span className="badge medium">
                      {ISSUE_LABELS[issue.issue]}
                    </span>
                  </td>
                  <td>{issue.department}</td>
                  <td>{issue.category}</td>
                  <td className="muted small">{issue.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ResultCard>
  );
}
