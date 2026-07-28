import type { GridSortModel } from "@mui/x-data-grid";
import { describe, expect, it } from "vitest";

import { toOrdering } from "./serverGrid";

describe("toOrdering", () => {
  it("maps an ascending sort to a bare field name", () => {
    const model: GridSortModel = [{ field: "department", sort: "asc" }];
    expect(toOrdering(model)).toBe("department");
  });

  it("prefixes a descending sort with a minus, as DRF expects", () => {
    const model: GridSortModel = [{ field: "actual_amount", sort: "desc" }];
    expect(toOrdering(model)).toBe("-actual_amount");
  });

  it("sends no ordering param when the grid is unsorted", () => {
    expect(toOrdering([])).toBeUndefined();
  });

  it("uses only the first column, since the API sorts by one field", () => {
    const model: GridSortModel = [
      { field: "department", sort: "asc" },
      { field: "category", sort: "desc" },
    ];
    expect(toOrdering(model)).toBe("department");
  });
});
