"use client";

import type { Provenance } from "@/lib/types";

import ProvenanceView from "./Provenance";

/**
 * Shell shared by every structured-result renderer: the `card` container plus
 * the inspectable provenance footer the product spec requires on each result.
 * Callers provide their own heading and body; putting the provenance here keeps
 * it consistent and impossible to forget.
 */
export default function ResultCard({
  provenance,
  className,
  children,
}: {
  provenance: Provenance;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `card ${className}` : "card"}>
      {children}
      <ProvenanceView provenance={provenance} />
    </div>
  );
}
