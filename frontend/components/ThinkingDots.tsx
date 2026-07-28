"use client";

import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";

// A staggered wave: each dot lifts and brightens on its own delay, giving a
// smooth left-to-right "thinking" motion rather than three dots blinking in sync.
const wave = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
`;

// Stable keys (values never reorder) so we avoid array-index keys.
const DOTS = ["dot-1", "dot-2", "dot-3"];
const STAGGER_MS = 160;

/** Animated three-dot "thinking" indicator for the assistant's pending state. */
export default function ThinkingDots() {
  return (
    <Box
      role="status"
      aria-label="Assistant is thinking"
      sx={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {DOTS.map((id, index) => (
        <Box
          key={id}
          component="span"
          sx={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            bgcolor: "primary.main",
            animation: `${wave} 1.3s ease-in-out infinite`,
            animationDelay: `${index * STAGGER_MS}ms`,
            // Respect users who prefer reduced motion: hold the bright state.
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              opacity: 0.6,
            },
          }}
        />
      ))}
    </Box>
  );
}
