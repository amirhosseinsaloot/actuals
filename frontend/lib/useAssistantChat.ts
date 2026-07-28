"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createAssistantRun, streamUrl } from "./api";
import { startStream } from "./sse";
import type { AnalysisResult, ChatTurn } from "./types";

// Primary result types that make sense to carry into a follow-up as context.
const PRIMARY_TYPES = new Set<AnalysisResult["type"]>([
  "variance_table",
  "grouped_summary",
  "risk_list",
  "simulation_result",
]);

// If the stream goes silent this long — no status/message/result and no terminal
// done/error — give up, so a stalled provider can never soft-lock the composer.
const STREAM_IDLE_TIMEOUT_MS = 60_000;
const TIMEOUT_ERROR = "The assistant timed out. Please try again.";

function newTurnId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}

function createPendingTurn(id: string, question: string): ChatTurn {
  return {
    id,
    question,
    status: "Sending…",
    text: "",
    results: [],
    error: null,
    streaming: true,
  };
}

/** A single-shot idle watchdog: `arm` (re)starts it, `clear` cancels it. */
function useStreamTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const arm = useCallback(
    (onTimeout: () => void) => {
      clear();
      timerRef.current = setTimeout(onTimeout, STREAM_IDLE_TIMEOUT_MS);
    },
    [clear],
  );
  return { arm, clear };
}

/**
 * The per-turn list plus the latest primary-result envelope kept as follow-up
 * context. All mutators are stable so the orchestrating hook can list them in
 * effect deps without churn.
 */
function useTurns() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const contextRef = useRef<AnalysisResult | null>(null);

  const reset = useCallback(() => {
    setTurns([]);
    contextRef.current = null;
  }, []);
  const addPending = useCallback((id: string, question: string) => {
    setTurns((previous) => [...previous, createPendingTurn(id, question)]);
  }, []);
  const patchTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((previous) =>
      previous.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
    );
  }, []);
  const appendText = useCallback((id: string, text: string) => {
    setTurns((previous) =>
      previous.map((turn) =>
        turn.id === id ? { ...turn, text: turn.text + text } : turn,
      ),
    );
  }, []);
  const appendResult = useCallback((id: string, result: AnalysisResult) => {
    setTurns((previous) =>
      previous.map((turn) =>
        turn.id === id ? { ...turn, results: [...turn.results, result] } : turn,
      ),
    );
    if (PRIMARY_TYPES.has(result.type)) {
      contextRef.current = result;
    }
  }, []);
  const endStreaming = useCallback(() => {
    setTurns((previous) =>
      previous.map((turn) =>
        turn.streaming ? { ...turn, streaming: false, status: null } : turn,
      ),
    );
  }, []);

  return {
    turns,
    contextRef,
    reset,
    addPending,
    patchTurn,
    appendText,
    appendResult,
    endStreaming,
  };
}

/**
 * Chat state machine for the assistant: POSTs the question, opens the SSE
 * stream, folds status/message/result/error events into per-turn state, and
 * keeps the latest primary result envelope as follow-up context. UI-free —
 * components only render what this returns.
 */
export function useAssistantChat(scenarioId: number) {
  const [streaming, setStreaming] = useState(false);
  const closeRef = useRef<(() => void) | null>(null);
  const { arm: armTimer, clear: clearTimer } = useStreamTimer();
  const {
    turns,
    contextRef,
    reset,
    addPending,
    patchTurn,
    appendText,
    appendResult,
    endStreaming,
  } = useTurns();

  // Close any open EventSource and cancel its idle timer. Idempotent.
  const closeStream = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    clearTimer();
  }, [clearTimer]);

  // Close any stream and drop all turns + follow-up context. Backs both the
  // "Clear chat" button and the scenario-switch reset below.
  const clearChat = useCallback(() => {
    closeStream();
    setStreaming(false);
    reset();
  }, [closeStream, reset]);

  // Close the stream on unmount.
  useEffect(() => closeStream, [closeStream]);

  // Reset on a scenario switch. Closing the in-flight stream here (not just on
  // unmount) stops a late result from the previous scenario repopulating
  // follow-up context under the new one.
  useEffect(() => clearChat(), [scenarioId, clearChat]);

  /** Stop an in-flight stream without discarding the partial turn. */
  function stop() {
    closeStream();
    setStreaming(false);
    endStreaming();
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) {
      return;
    }
    setStreaming(true);
    const id = newTurnId();
    addPending(id, trimmed);

    const endTurn = (patch: Partial<ChatTurn> = {}) => {
      closeStream();
      patchTurn(id, { streaming: false, status: null, ...patch });
      setStreaming(false);
    };
    // (Re)arm the idle watchdog on every sign of life from the stream.
    const resetIdleTimer = () =>
      armTimer(() => endTurn({ error: TIMEOUT_ERROR }));

    try {
      const { run_id } = await createAssistantRun(
        scenarioId,
        trimmed,
        contextRef.current,
      );
      resetIdleTimer();
      closeRef.current = startStream(streamUrl(scenarioId, run_id), {
        onStatus: (message) => {
          resetIdleTimer();
          patchTurn(id, { status: message });
        },
        onMessage: (text) => {
          resetIdleTimer();
          appendText(id, text);
        },
        onResult: (result) => {
          resetIdleTimer();
          appendResult(id, result);
        },
        // Treat errors as terminal: connection-level failures never deliver a
        // `done` event, so ending the turn here prevents a soft-locked composer.
        onError: (message) => endTurn({ error: message }),
        onDone: () => endTurn(),
      });
    } catch (err) {
      endTurn({
        error:
          err instanceof Error ? err.message : "Failed to reach the assistant.",
      });
    }
  }

  return { turns, streaming, ask, stop, clearChat };
}
