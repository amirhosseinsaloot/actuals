"use client";

import type { Provenance } from "@/lib/types";

/** "min_severity" -> "Min severity" for a finance-reader-friendly label. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The inspectable "why this answer" section required by the product spec.
 *  Renders the tool, its parameters, and the contributing rows as a readable
 *  list rather than a raw JSON dump. */
export default function ProvenanceView({
  provenance,
}: {
  provenance: Provenance;
}) {
  const params = Object.entries(provenance.params).filter(
    ([, value]) => value != null && value !== "",
  );
  const ids = provenance.line_item_ids;

  return (
    <details className="prov">
      <summary>Why this answer?</summary>
      <div className="small muted" style={{ marginTop: 6 }}>
        Computed by the <strong>{provenance.tool}</strong> tool.
      </div>
      {params.length > 0 && (
        <dl className="prov-list">
          {params.map(([key, value]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt>{humanizeKey(key)}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="small muted" style={{ marginTop: 6 }}>
        Based on {ids.length} line item(s)
        {ids.length ? `: ${ids.join(", ")}` : ""}.
      </div>
    </details>
  );
}
