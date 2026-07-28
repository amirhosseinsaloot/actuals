import { describe, expect, it } from "vitest";

import {
  budgetRemainingLabel,
  budgetUsedPct,
  formatPeriod,
  formatVariancePercent,
  healthTone,
  money,
  overUnderLabel,
  planDeviationLabel,
  relativeTime,
  toneClass,
  variancePresentation,
} from "./format";

describe("money", () => {
  it("renders whole currency units with separators", () => {
    expect(money("50000")).toBe("$50,000");
    expect(money(1234.56)).toBe("$1,235");
  });

  it("shows an explicit sign only when asked, and never for zero", () => {
    expect(money("2500", "USD", { signed: true })).toBe("+$2,500");
    expect(money("-2500", "USD", { signed: true })).toBe("-$2,500");
    expect(money("0", "USD", { signed: true })).toBe("$0");
  });

  it("falls back to a prefixed number for an unusable currency code", () => {
    expect(money(1234.6, "US")).toBe("US 1,235");
    expect(money(-1234.6, "US", { signed: true })).toBe("-US 1,235");
  });

  it("renders a dash rather than NaN for unparseable input", () => {
    expect(money("not a number")).toBe("—");
  });
});

// The backend sends variance as `actual - budget`, so positive means
// overspend. The UI flips it to the finance convention where overspend reads
// negative and red; these tests pin that flip down.
describe("variancePresentation", () => {
  it("shows an over-budget variance as a negative amount in the error tone", () => {
    const result = variancePresentation("15000");
    expect(result.text).toBe("-$15,000");
    expect(result.tone).toBe("error");
    expect(result.over).toBe(true);
  });

  it("shows an under-budget variance as a positive amount in the success tone", () => {
    const result = variancePresentation("-1500");
    expect(result.text).toBe("+$1,500");
    expect(result.tone).toBe("success");
    expect(result.over).toBe(false);
  });

  it("treats an exact match as neutral", () => {
    const result = variancePresentation("0");
    expect(result.tone).toBe("neutral");
    expect(result.over).toBe(false);
  });
});

describe("formatVariancePercent", () => {
  it("flips the sign to the favorable convention", () => {
    expect(formatVariancePercent("30")).toBe("-30.0%");
    expect(formatVariancePercent("-12.5")).toBe("+12.5%");
  });

  it("renders a dash when the backend could not compute one", () => {
    expect(formatVariancePercent(null)).toBe("—");
  });
});

describe("overUnderLabel", () => {
  it("describes the direction in absolute terms", () => {
    expect(overUnderLabel("30")).toBe("30.0% over");
    expect(overUnderLabel("-12.5")).toBe("12.5% under");
  });

  it("names the exact-match and unknown cases", () => {
    expect(overUnderLabel("0")).toBe("on plan");
    expect(overUnderLabel(null)).toBeNull();
  });
});

describe("planDeviationLabel", () => {
  it("reports deviation against the budget total", () => {
    expect(planDeviationLabel("100000", "112000")).toBe("12.0% over plan");
    expect(planDeviationLabel("100000", "98000")).toBe("2.0% under plan");
  });

  it("has nothing to report without a budget", () => {
    expect(planDeviationLabel("0", "5000")).toBeNull();
    expect(planDeviationLabel(undefined, undefined)).toBeNull();
  });
});

describe("budgetUsedPct", () => {
  it("is the share of budget consumed", () => {
    expect(budgetUsedPct("200000", "50000")).toBe(25);
  });

  it("treats spend against a zero budget as fully used", () => {
    expect(budgetUsedPct("0", "3000")).toBe(100);
    expect(budgetUsedPct("0", "0")).toBe(0);
  });
});

describe("budgetRemainingLabel", () => {
  it("reports what is left while under budget", () => {
    expect(budgetRemainingLabel("100000", "90000")).toEqual({
      label: "$10,000 left",
      over: false,
    });
  });

  it("reports the overspend once past the limit", () => {
    expect(budgetRemainingLabel("100000", "112000")).toEqual({
      label: "$12,000 past limit",
      over: true,
    });
  });
});

describe("formatPeriod", () => {
  it("collapses the shared year across a range", () => {
    const formatted = formatPeriod("2026-07-01", "2026-09-30");
    expect(formatted).toContain("→");
    expect(formatted).toContain("Jul 1");
    expect(formatted).toContain("Sep 30, 2026");
  });

  it("echoes the raw values when they are not dates", () => {
    expect(formatPeriod("nope", "also nope")).toBe("nope → also nope");
  });
});

describe("tone helpers", () => {
  it("maps health status to a display tone", () => {
    expect(healthTone("on_track")).toBe("success");
    expect(healthTone("watch")).toBe("warning");
    expect(healthTone("over_budget")).toBe("error");
  });

  it("maps a tone to the plain-CSS class used by result cards", () => {
    expect(toneClass("error")).toBe("pos");
    expect(toneClass("success")).toBe("neg");
    expect(toneClass("neutral")).toBe("");
  });
});

describe("relativeTime", () => {
  it("returns an empty string for an unparseable timestamp", () => {
    expect(relativeTime("whenever")).toBe("");
  });
});
