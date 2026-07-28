import type { AnalysisResult } from "./types";

export interface SSEHandlers {
  onStatus?: (message: string) => void;
  onMessage?: (text: string) => void;
  onResult?: (result: AnalysisResult) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/** Typed JSON.parse so event payloads don't flow through `any`. */
function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

/**
 * Open an EventSource against the assistant stream and dispatch named events.
 *
 * The backend emits `status`, `message`, `result`, `error`, and a terminal
 * `done`. Note the collision between our named `error` event (a MessageEvent
 * with JSON data) and EventSource's native connection-error event (no data) —
 * we disambiguate on the presence of `data`.
 *
 * Returns a `close()` function to abort the stream.
 */
export function startStream(url: string, handlers: SSEHandlers): () => void {
  const eventSource = new EventSource(url);
  let closed = false;

  const close = () => {
    if (!closed) {
      closed = true;
      eventSource.close();
    }
  };

  eventSource.addEventListener("status", (event: MessageEvent<string>) => {
    handlers.onStatus?.(parseJson<{ message: string }>(event.data).message);
  });

  eventSource.addEventListener("message", (event: MessageEvent<string>) => {
    handlers.onMessage?.(parseJson<{ text: string }>(event.data).text);
  });

  eventSource.addEventListener("result", (event: MessageEvent<string>) => {
    handlers.onResult?.(parseJson<AnalysisResult>(event.data));
  });

  eventSource.addEventListener("done", () => {
    handlers.onDone?.();
    close();
  });

  eventSource.addEventListener("error", (event) => {
    const data: unknown = (event as MessageEvent<unknown>).data;
    if (typeof data === "string" && data.length > 0) {
      // Application-level error event from the backend.
      try {
        handlers.onError?.(parseJson<{ message: string }>(data).message);
      } catch {
        handlers.onError?.("The assistant reported an error.");
      }
    } else if (!closed) {
      // Connection-level failure.
      handlers.onError?.("Connection to the assistant was lost.");
      close();
    }
  });

  return close;
}
