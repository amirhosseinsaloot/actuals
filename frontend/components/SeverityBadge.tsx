"use client";

import type { Severity } from "@/lib/types";

/** Pill for the backend's High/Medium/Low severity labels. */
export default function SeverityBadge({ severity }: { severity: Severity }) {
  if (!severity) {
    return <span className="muted small">—</span>;
  }
  return <span className={`badge ${severity}`}>{severity}</span>;
}
