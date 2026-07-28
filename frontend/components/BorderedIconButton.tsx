"use client";

import IconButton, { type IconButtonProps } from "@mui/material/IconButton";

import { toSxArray } from "@/lib/sx";

const BASE_SX = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  width: 32,
  height: 32,
} as const;

/** A 32×32 icon button with a visible border, for row-level table actions
 * (edit/delete). Plain MUI IconButtons read as borderless ghost buttons,
 * which is too quiet for a destructive/edit affordance sitting in a dense
 * table row. */
export default function BorderedIconButton({ sx, ...props }: IconButtonProps) {
  return (
    <IconButton size="small" {...props} sx={[BASE_SX, ...toSxArray(sx)]} />
  );
}
