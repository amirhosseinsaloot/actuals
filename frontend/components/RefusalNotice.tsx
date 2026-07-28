"use client";

import type { Refusal } from "@/lib/types";

export default function RefusalNotice({ result }: { result: Refusal }) {
  return <div className="refusal">{result.message}</div>;
}
