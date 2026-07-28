import type { SxProps, Theme } from "@mui/material/styles";

/** The array form of MUI's sx prop (its entries, unlike SxProps itself, may
 * not be nested arrays). */
export type SxArray = Extract<SxProps<Theme>, readonly unknown[]>;

/**
 * MUI's documented sx-merge pattern for components that layer their own
 * base styles under a caller-supplied `sx`: `sx={[baseSx, ...toSxArray(sx)]}`.
 * The casts tame Array.isArray's `any[]` narrowing so the caller's sx entries
 * stay typed under the linter.
 */
export function toSxArray(sx: SxProps<Theme> | undefined): SxArray {
  if (!sx) {
    return [];
  }
  if (Array.isArray(sx)) {
    return sx as SxArray;
  }
  return [sx] as SxArray;
}
