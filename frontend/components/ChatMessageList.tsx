"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { ChatTurn } from "@/lib/types";

import AnalysisResultRenderer from "./AnalysisResultRenderer";
import ThinkingDots from "./ThinkingDots";

export default function ChatMessageList({
  turns,
  currency,
}: {
  turns: ChatTurn[];
  currency: string;
}) {
  if (turns.length === 0) {
    return (
      <Box className="empty">
        Ask a question about this scenario to see analysis rendered here.
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      {turns.map((turn) => (
        <Box key={turn.id}>
          {/* User message — right-aligned bubble */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <Box
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                px: 1.75,
                py: 1,
                borderRadius: "14px 14px 4px 14px",
                maxWidth: "88%",
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              {turn.question}
            </Box>
          </Box>

          {/* Assistant response — animated pending indicator while streaming */}
          {turn.status && turn.streaming && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ mb: 0.5 }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                fontStyle="italic"
              >
                {turn.status}
              </Typography>
              <ThinkingDots />
            </Stack>
          )}

          {turn.text && (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 1 }}>
              {turn.text}
            </Typography>
          )}

          {turn.results.map((result, index) => (
            // Results within a turn are append-only and never reordered, so
            // the index is a stable key here.
            // eslint-disable-next-line react/no-array-index-key
            <Box key={index} sx={{ mb: 1 }}>
              <AnalysisResultRenderer result={result} currency={currency} />
            </Box>
          ))}

          {turn.error && <Box className="error-box">{turn.error}</Box>}
        </Box>
      ))}
    </Stack>
  );
}
