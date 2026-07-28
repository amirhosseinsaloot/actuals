import type { AnalysisResult, LineItem, Paginated, Scenario } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** An HTTP error that carries the status code so callers can branch on it. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function humanizeError(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") {
      return obj.detail;
    }
    // DRF field errors: { field: ["message", ...] }
    const first = Object.values(obj)[0];
    if (Array.isArray(first) && typeof first[0] === "string") {
      return first[0];
    }
  }
  return `Request failed (${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* no body */
    }
    throw new ApiError(res.status, humanizeError(res.status, body));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

// --- Scenarios ---
export type ScenarioListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  currency?: string;
};

export const listScenarios = (params: ScenarioListParams = {}) =>
  request<Paginated<Scenario>>(`/api/scenarios/${toQuery(params)}`);

export const getScenario = (id: number) =>
  request<Scenario>(`/api/scenarios/${id}/`);

export const createScenario = (data: Partial<Scenario>) =>
  request<Scenario>("/api/scenarios/", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateScenario = (id: number, data: Partial<Scenario>) =>
  request<Scenario>(`/api/scenarios/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteScenario = (id: number) =>
  request<void>(`/api/scenarios/${id}/`, { method: "DELETE" });

// --- Line items ---
export type LineItemListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  department?: string;
  category?: string;
  over_budget?: boolean;
};

export const listLineItems = (
  scenarioId: number,
  params: LineItemListParams = {},
) =>
  request<Paginated<LineItem>>(
    `/api/scenarios/${scenarioId}/line-items/${toQuery(params)}`,
  );

export const createLineItem = (scenarioId: number, data: Partial<LineItem>) =>
  request<LineItem>(`/api/scenarios/${scenarioId}/line-items/`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateLineItem = (id: number, data: Partial<LineItem>) =>
  request<LineItem>(`/api/line-items/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteLineItem = (id: number) =>
  request<void>(`/api/line-items/${id}/`, { method: "DELETE" });

// --- Assistant ---
export const getAssistantSuggestions = () =>
  request<{ suggestions: string[] }>("/api/assistant/suggestions/");

export const createAssistantRun = (
  scenarioId: number,
  question: string,
  context: AnalysisResult | null,
) =>
  request<{ run_id: string }>(
    `/api/scenarios/${scenarioId}/assistant/messages/`,
    {
      method: "POST",
      body: JSON.stringify({ question, context }),
    },
  );

export const streamUrl = (scenarioId: number, runId: string) =>
  `${API_BASE}/api/scenarios/${scenarioId}/assistant/stream/?run_id=${runId}`;
