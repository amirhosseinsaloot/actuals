"use client";

import Box from "@mui/material/Box";

import { budgetUsedPct } from "@/lib/format";

/** Slim progress track for a metric card: primary fill up to 100% of budget,
 * red overflow beyond it. */
export default function BudgetUsedBar({
  budgetTotal,
  actualTotal,
}: {
  budgetTotal?: string;
  actualTotal?: string;
}) {
  const usedPercent = budgetUsedPct(budgetTotal, actualTotal);

  // Scale the track so overflow beyond 100% renders as a red segment.
  const trackScale = Math.max(100, usedPercent);
  const withinPlanWidth = (Math.min(100, usedPercent) / trackScale) * 100;
  const overflowWidth =
    usedPercent > 100 ? ((usedPercent - 100) / trackScale) * 100 : 0;

  return (
    <Box
      sx={{
        display: "flex",
        height: 8,
        borderRadius: 999,
        overflow: "hidden",
        bgcolor: "grey.100",
        mt: 1.5,
      }}
    >
      <Box sx={{ width: `${withinPlanWidth}%`, bgcolor: "primary.main" }} />
      <Box sx={{ width: `${overflowWidth}%`, bgcolor: "error.main" }} />
    </Box>
  );
}
