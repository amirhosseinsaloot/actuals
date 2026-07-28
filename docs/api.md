# HTTP API

Base path `/api/`. Lists return `{ count, next, previous, results }` with a
default page size of **10** (max 100).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET, POST | `/scenarios/` | List (paginated) / create. |
| GET, PUT, PATCH, DELETE | `/scenarios/{id}/` | Retrieve / update / delete. |
| GET, POST | `/scenarios/{id}/line-items/` | Scoped list / create; **404** if the scenario is missing. |
| GET, PUT, PATCH, DELETE | `/line-items/{id}/` | Single line item. |
| GET | `/assistant/suggestions/` | Prompts shown in the assistant's empty state. |
| POST | `/scenarios/{id}/assistant/messages/` | Create an `AssistantRun` → `{ run_id }` (201). |
| GET | `/scenarios/{id}/assistant/stream/?run_id=…` | SSE stream for that run. |

## Query parameters

Backed by django-filter plus DRF's search and ordering filters. An unusable
value returns a **400** naming the offending field rather than being ignored.

- **Scenarios** — `search` (name), `currency`, `ordering`
  (`name` / `created_at` / `period_start` / `period_end`), `page`, `page_size`.
- **Line items** — `department`, `category` (exact, case-insensitive),
  `over_budget=true|false` (evaluated in the database as `actual > budget`;
  any other value is a 400), `search` (department / category / description),
  `ordering`.

## Computed fields

Never stored, always derived on read:

- **Line item** — `variance`, `variance_percent`.
- **Scenario** — `budget_total`, `actual_total`, `variance_total`,
  `line_item_count`, `health { status, label }`.

Money and percent fields are **strings** end to end: an exact `Decimal` is
serialised to a string, and the frontend `parseFloat`s only for colors, labels
and bar widths — never for arithmetic. See
[methodology.md](methodology.md) for how each value is defined.

## Streamed result envelopes

The assistant streams eight envelope types, defined in `ai/schemas.py` and
mirrored in `frontend/lib/types.ts` as a discriminated union on `type`. Every
non-refusal envelope carries a **provenance** block
`{ tool, params, line_item_ids }`, which the UI exposes behind "Why this
answer?".

| `type` | Produced by |
|---|---|
| `variance_table` / `grouped_summary` / `simple_chart` | `analyze_variances` |
| `risk_list` (+ `recommendation_card`) | `identify_budget_risks` |
| `simulation_result` (+ `recommendation_card`) | `simulate_spend_change` |
| `data_quality_report` | `check_data_quality` |
| `refusal` | off-scope guardrail (no provenance) |

The event names and lifecycle of the stream itself are described in
[architecture.md](architecture.md#sse-protocol).
