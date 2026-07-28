"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { customShadows } from "@/app/providers";

/**
 * A bordered metric card (Budget / Actual / Variance …). Reusable so every
 * headline number is presented consistently.
 */
export default function StatTile({
  label,
  value,
  color,
  sub,
  children,
}: {
  label: string;
  value?: string;
  color?: string;
  sub?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        p: 2,
        bgcolor: "background.paper",
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        "&:hover": { borderColor: "grey.300", boxShadow: customShadows.sm },
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        display="block"
        sx={{ mb: 1 }}
      >
        {label}
      </Typography>
      <Typography
        variant="h5"
        className="tnum"
        sx={{ color: color ?? "text.primary", lineHeight: 1.2 }}
      >
        {value ?? "—"}
      </Typography>
      {sub && (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: color ?? "text.secondary" }}
        >
          {sub}
        </Typography>
      )}
      {children}
    </Box>
  );
}
