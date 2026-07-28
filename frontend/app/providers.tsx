"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";

// Mirrors the tokens in globals.css — MUI needs literal values (alpha(),
// contrast calculations, etc. can't read CSS custom properties), so keep
// these two files in sync by hand.
const primary = "#5b7cff";
const primaryDark = "#4a68e6";
const primaryLight = "#e8ecff";
const success = "#10b981";
const successLight = "#ecfdf5";
const warning = "#f59e0b";
const warningLight = "#fffbeb";
const danger = "#ef4444";
const dangerLight = "#fef2f2";
const neutral = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
};
const radiusSm = 6;
const radiusMd = 8;
const radiusLg = 12;
const shadowXs = "0 1px 2px rgba(0, 0, 0, 0.05)";
const shadowSm = "0 1px 3px rgba(0, 0, 0, 0.1)";
const shadowMd = "0 4px 12px rgba(0, 0, 0, 0.08)";
const shadowLg = "0 10px 28px rgba(0, 0, 0, 0.12)";

/** Custom elevation shadows, for the handful of components that need one
 * directly (MuiPaper is themed to the outlined variant app-wide, so
 * theme.shadows itself is unused). Import this instead of redeclaring the
 * rgba strings at each call site. */
export const customShadows = {
  xs: shadowXs,
  sm: shadowSm,
  md: shadowMd,
  lg: shadowLg,
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: primary, dark: primaryDark, light: primaryLight },
    error: { main: danger, light: dangerLight },
    success: { main: success, light: successLight },
    warning: { main: warning, light: warningLight },
    background: { default: neutral[50], paper: "#ffffff" },
    text: { primary: neutral[900], secondary: neutral[500] },
    divider: neutral[200],
    grey: neutral,
  },
  shape: { borderRadius: radiusMd },
  typography: {
    fontFamily:
      'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 14,
    h4: {
      fontSize: "32px",
      fontWeight: 700,
      letterSpacing: "-0.5px",
      color: neutral[900],
    },
    h5: {
      fontSize: "28px",
      fontWeight: 700,
      letterSpacing: "-0.3px",
      color: neutral[900],
    },
    h6: { fontSize: "16px", fontWeight: 600, color: neutral[900] },
    subtitle1: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.3px" },
    body1: { fontSize: "15px" },
    body2: { fontSize: "14px" },
    button: { textTransform: "none", fontWeight: 500, fontSize: "14px" },
    // Uppercase eyebrow labels (metric card labels, etc).
    overline: {
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.04em",
      lineHeight: 1.4,
    },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radiusMd },
        containedPrimary: {
          "&:hover": { boxShadow: shadowMd, backgroundColor: primaryDark },
        },
        outlined: { borderColor: neutral[200], color: neutral[700] },
      },
    },
    MuiPaper: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: { borderColor: neutral[200] },
        outlined: { borderRadius: radiusLg, boxShadow: shadowXs },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radiusMd, fontWeight: 500, fontSize: 13 },
        outlined: {
          backgroundColor: neutral[100],
          borderColor: neutral[200],
          color: neutral[700],
        },
        filledPrimary: {
          backgroundColor: primaryLight,
          color: primaryDark,
          fontWeight: 600,
          border: `1px solid ${alpha(primary, 0.28)}`,
          "&:hover": { backgroundColor: alpha(primary, 0.18) },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radiusMd,
          backgroundColor: "#ffffff",
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${alpha(primary, 0.15)}`,
          },
        },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: radiusMd } } },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radiusLg } },
    },
    MuiTableCell: {
      styleOverrides: { root: { borderColor: neutral[100] } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: radiusSm, fontSize: 12 },
      },
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
