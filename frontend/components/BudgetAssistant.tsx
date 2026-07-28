"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { keyframes } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { useAssistantChat } from "@/lib/useAssistantChat";
import { useSuggestions } from "@/lib/useSuggestions";

import ChatMessageList from "./ChatMessageList";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

function SuggestionList({
  suggestions,
  streaming,
  onPick,
}: {
  suggestions: string[];
  streaming: boolean;
  onPick: (question: string) => void;
}) {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      {suggestions.map((suggestion) => (
        // A native <button> makes each prompt keyboard-operable (focus + Enter/
        // Space) for free; the sx resets the default button chrome.
        <Box
          key={suggestion}
          component="button"
          type="button"
          disabled={streaming}
          onClick={() => onPick(suggestion)}
          sx={{
            textAlign: "left",
            font: "inherit",
            color: "text.primary",
            width: "100%",
            display: "block",
            m: 0,
            p: 1.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            fontSize: 13,
            cursor: streaming ? "default" : "pointer",
            opacity: streaming ? 0.6 : 1,
            transition: "all 200ms ease",
            "&:hover:not(:disabled)": {
              borderColor: "primary.main",
              bgcolor: "primary.light",
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          {suggestion}
        </Box>
      ))}
    </Stack>
  );
}

/** Question input + send button; owns its draft text. */
function AssistantComposer({
  streaming,
  onAsk,
  onStop,
}: {
  streaming: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim() || streaming) {
      return;
    }
    const question = input;
    setInput("");
    onAsk(question);
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Ask about variances, risks, or a what-if…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          disabled={streaming}
        />
        {streaming ? (
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            onClick={onStop}
            sx={{ height: 40 }}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            variant="contained"
            disabled={!input.trim()}
            sx={{ height: 40 }}
          >
            Ask
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default function BudgetAssistant({
  scenarioId,
  scenarioName,
  currency,
}: {
  scenarioId: number;
  scenarioName: string;
  currency: string;
}) {
  const { turns, streaming, ask, stop, clearChat } =
    useAssistantChat(scenarioId);
  const suggestions = useSuggestions();
  const submit = (question: string) => void ask(question);

  return (
    <Paper
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.grey[50]} 100%)`,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.main",
              animation: `${pulse} 2s infinite`,
            }}
          />
          <Typography variant="h6" sx={{ color: "primary.main" }}>
            AI Assistant
          </Typography>
        </Stack>
        {turns.length > 0 && (
          <Button size="small" onClick={clearChat} disabled={streaming}>
            Clear chat
          </Button>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <Box component="strong" sx={{ color: "primary.main" }}>
          Analyzing:
        </Box>{" "}
        {scenarioName}
      </Typography>

      {/* Scrollable middle: starter suggestions + chat history. On desktop the
          pane is viewport-locked, so this shrinks (minHeight 0) to keep the
          composer below pinned and visible; on mobile it keeps a 240px floor
          since there the page — not the pane — scrolls. */}
      <Box
        sx={{
          flex: 1,
          minHeight: { xs: 240, md: 0 },
          overflowY: "auto",
          pr: 0.5,
          mb: 2,
        }}
      >
        <SuggestionList
          suggestions={suggestions}
          streaming={streaming}
          onPick={submit}
        />
        <ChatMessageList turns={turns} currency={currency} />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <AssistantComposer streaming={streaming} onAsk={submit} onStop={stop} />
      </Box>
    </Paper>
  );
}
