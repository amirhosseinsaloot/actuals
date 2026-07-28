// Presentation helpers. Money and variance amounts come from the backend as
// exact Decimal strings; everything here is display-only formatting.
//
// Deliberately NOT using decimal.js: the frontend performs no financial math.
// Precision-critical calculations live in the backend (Python Decimal); the
// parseFloat calls below only drive colors, labels, and bar widths.
import { formatDistanceToNow } from "date-fns";

import type { HealthStatus } from "@/lib/types";

/** Currency with thousands separators, no decimals: "$290,000". */
export function money(
  value: string | number,
  currency = "USD",
  options: { signed?: boolean } = {},
): string {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(amount)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      signDisplay: options.signed ? "exceptZero" : "auto",
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain prefixed number.
    let sign = "";
    if (amount < 0) {
      sign = "-";
    } else if (amount > 0 && options.signed) {
      sign = "+";
    }
    const rounded = Math.abs(Math.round(amount)).toLocaleString("en-US");
    return `${sign}${currency} ${rounded}`;
  }
}

export type Tone = "error" | "warning" | "success" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  error: "error.main",
  warning: "warning.main",
  success: "success.main",
  neutral: "text.secondary",
};

function toneColor(tone: Tone): string {
  return TONE_COLOR[tone];
}

// CSS utility classes (globals.css) for the assistant's plain-CSS result cards,
// where MUI theme tokens aren't available.
const TONE_CLASS: Record<Tone, string> = {
  error: "pos",
  warning: "",
  success: "neg",
  neutral: "",
};

/** CSS class matching a tone's color, for the custom-CSS result cards. */
export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

function varianceTone(variance: number): Tone {
  if (variance > 0) {
    return "error";
  }
  if (variance < 0) {
    return "success";
  }
  return "neutral";
}

/**
 * Favorable-variance presentation. The backend `variance` is
 * `actual - budget` (positive = over budget). Finance convention shows this as
 * budget - actual, so overspend is negative and red.
 */
export function variancePresentation(
  varianceActualMinusBudget: string,
  currency = "USD",
): { text: string; tone: Tone; color: string; over: boolean } {
  const variance = parseFloat(varianceActualMinusBudget);
  const favorableAmount = -variance;
  const tone = varianceTone(variance);
  return {
    text: money(favorableAmount, currency, { signed: true }),
    tone,
    color: toneColor(tone),
    over: variance > 0,
  };
}

/**
 * Favorable-signed percentage that matches {@link variancePresentation}:
 * over-budget is negative, under-budget positive; "—" when undefined (zero
 * budget). The backend sends `variance_percent` as `(actual - budget) / budget
 * * 100`.
 */
export function formatVariancePercent(variancePercent: string | null): string {
  if (variancePercent == null) {
    return "—";
  }
  const favorable = -parseFloat(variancePercent);
  if (!isFinite(favorable)) {
    return "—";
  }
  return `${favorable > 0 ? "+" : ""}${favorable.toFixed(1)}%`;
}

/** "30.0% over" / "12.0% under" / "on plan" from the backend variance_percent. */
export function overUnderLabel(variancePercent: string | null): string | null {
  if (variancePercent == null) {
    return null;
  }
  const percent = parseFloat(variancePercent);
  if (percent === 0) {
    return "on plan";
  }
  return `${Math.abs(percent).toFixed(1)}% ${percent > 0 ? "over" : "under"}`;
}

const HEALTH_TONE: Record<HealthStatus, Tone> = {
  on_track: "success",
  watch: "warning",
  over_budget: "error",
};

/** Display tone for a backend health status. The status and its label are
 *  computed server-side; this only picks the pill's color. */
export function healthTone(status: HealthStatus): Tone {
  return HEALTH_TONE[status];
}

/** "2.3% over plan" / "1.4% under plan", or null when there is no budget. */
export function planDeviationLabel(
  budgetTotal?: string,
  actualTotal?: string,
): string | null {
  const budget = parseFloat(budgetTotal ?? "0");
  const actual = parseFloat(actualTotal ?? "0");
  if (budget <= 0) {
    return null;
  }
  const deviationPercent = Math.abs(((actual - budget) / budget) * 100).toFixed(
    1,
  );
  return `${deviationPercent}% ${actual > budget ? "over" : "under"} plan`;
}

/** Percentage of budget consumed (actual / budget * 100). Display-only. */
export function budgetUsedPct(
  budgetTotal?: string,
  actualTotal?: string,
): number {
  const budget = parseFloat(budgetTotal ?? "0");
  const actual = parseFloat(actualTotal ?? "0");
  if (budget <= 0) {
    return actual > 0 ? 100 : 0;
  }
  return (actual / budget) * 100;
}

/**
 * Sub-label for the "Budget Used" tile: how much budget is left, or how far
 * spend is past the limit. `over` drives the tile's warning color.
 */
export function budgetRemainingLabel(
  budgetTotal?: string,
  actualTotal?: string,
  currency = "USD",
): { label: string; over: boolean } {
  const budget = parseFloat(budgetTotal ?? "0");
  const actual = parseFloat(actualTotal ?? "0");
  const overspend = actual - budget;
  if (overspend > 0) {
    return { label: `${money(overspend, currency)} past limit`, over: true };
  }
  return { label: `${money(budget - actual, currency)} left`, over: false };
}

/** Parse a date-only ISO string ("2026-07-01") as local midnight, so the
 * rendered day never shifts across timezones. */
function parseDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

const PERIOD_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * "Oct 1 → Dec 31, 2026" — delegated to Intl.DateTimeFormat.formatRange, which
 * de-duplicates shared parts (e.g. the year) natively. Only the range
 * separator literal is swapped for this app's "→".
 */
export function formatPeriod(startISO: string, endISO: string): string {
  const start = parseDateOnly(startISO);
  const end = parseDateOnly(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return `${startISO} → ${endISO}`;
  }
  return PERIOD_FORMATTER.formatRangeToParts(start, end)
    .map((part) =>
      part.type === "literal" && part.value.includes("–") ? " → " : part.value,
    )
    .join("");
}

/** "2 hours ago", "1 day ago", "14 days ago" — delegated to date-fns. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "";
  }
  return formatDistanceToNow(date, { addSuffix: true });
}
