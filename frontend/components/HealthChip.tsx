"use client";

import Box from "@mui/material/Box";

import type { Tone } from "@/lib/format";

const STYLES: Record<Tone, { dot: string; fg: string; bg: string }> = {
  error: { dot: "error.main", fg: "error.main", bg: "error.light" },
  warning: { dot: "warning.main", fg: "warning.main", bg: "warning.light" },
  success: { dot: "success.main", fg: "success.main", bg: "success.light" },
  neutral: { dot: "grey.400", fg: "grey.600", bg: "grey.100" },
};

/** Soft pill with a status dot, e.g. "● Over budget". */
export default function HealthChip({
  label,
  tone,
  size = "medium",
}: {
  label: string;
  tone: Tone;
  size?: "small" | "medium";
}) {
  const style = STYLES[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: size === "small" ? 1 : 1.25,
        py: size === "small" ? 0.25 : 0.5,
        borderRadius: 1,
        bgcolor: style.bg,
        color: style.fg,
        fontSize: size === "small" ? 11 : 12,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        component="span"
        sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: style.dot }}
      />
      {label}
    </Box>
  );
}
