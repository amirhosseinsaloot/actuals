import { beforeEach, describe, expect, it, vi } from "vitest";

import { startStream } from "./sse";

type Listener = (event: MessageEvent<string>) => void;

/**
 * Minimal stand-in for the browser EventSource: records listeners so a test
 * can push named events, and tracks whether the stream was closed.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Listener[]>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as unknown as MessageEvent<string>);
    }
  }
}

function openStream() {
  const handlers = {
    onStatus: vi.fn(),
    onMessage: vi.fn(),
    onResult: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
  };
  const close = startStream("/api/stream", handlers);
  return { handlers, close, source: FakeEventSource.instances[0] };
}

beforeEach(() => {
  FakeEventSource.instances = [];
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
});

describe("startStream", () => {
  it("unwraps each named event into its handler", () => {
    const { handlers, source } = openStream();

    source.emit("status", JSON.stringify({ message: "Running analysis…" }));
    source.emit("message", JSON.stringify({ text: "Marketing is over." }));
    source.emit("result", JSON.stringify({ type: "variance_table", rows: [] }));

    expect(handlers.onStatus).toHaveBeenCalledWith("Running analysis…");
    expect(handlers.onMessage).toHaveBeenCalledWith("Marketing is over.");
    expect(handlers.onResult).toHaveBeenCalledWith({
      type: "variance_table",
      rows: [],
    });
  });

  it("closes the connection once the terminal event arrives", () => {
    const { handlers, source } = openStream();

    source.emit("done");

    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(source.closed).toBe(true);
  });

  // The backend's named `error` event and EventSource's own connection-error
  // event share a name; only the former carries data.
  it("reports a backend error event using its message", () => {
    const { handlers, source } = openStream();

    source.emit("error", JSON.stringify({ message: "Assistant unavailable." }));

    expect(handlers.onError).toHaveBeenCalledWith("Assistant unavailable.");
    expect(source.closed).toBe(false);
  });

  it("falls back to a generic message when the error payload is malformed", () => {
    const { handlers, source } = openStream();

    source.emit("error", "{not json");

    expect(handlers.onError).toHaveBeenCalledWith(
      "The assistant reported an error.",
    );
  });

  it("treats a dataless error as a lost connection and closes", () => {
    const { handlers, source } = openStream();

    source.emit("error");

    expect(handlers.onError).toHaveBeenCalledWith(
      "Connection to the assistant was lost.",
    );
    expect(source.closed).toBe(true);
  });

  it("returns a close function that is safe to call twice", () => {
    const { close, source } = openStream();

    close();
    close();

    expect(source.closed).toBe(true);
  });
});
