# Architecture

How the pieces fit together and why. For endpoint-level detail see
[api.md](api.md); for the metric definitions see [methodology.md](methodology.md).

The organising idea: **the LLM is an analyst interface, not the calculation
engine.** All budget math runs in deterministic Django services. The agent picks
one of five typed, approved tools, and the *validated tool output* — never
model-generated JSON — is what reaches the UI.

## System overview

```
┌──────────────┐   REST (JSON)    ┌───────────────────────────┐        ┌────────────┐
│   Browser    │ ───────────────▶ │  Django + DRF (ASGI)       │ ─────▶ │ PostgreSQL │
│  Next.js 14  │                  │  served by uvicorn         │        │    16      │
│  React 18    │ ◀─── SSE ──────── │   • deterministic services │ ◀───── │            │
│  MUI 6       │  (EventSource)   │   • OpenAI Agents SDK agent │        └────────────┘
└──────────────┘                  └───────────────────────────┘
```

Two channels between front and back:

- **REST** — scenario/line-item CRUD, assistant-run creation, suggestions.
- **SSE** — one-way server→client streaming of assistant status, text, results.

Under Compose these are three services: `frontend` (:3000), `backend` (:8000),
`db` (:5432). Both processes also run directly on a host, where the backend
falls back to a SQLite file — see [Database selection](#database-selection).

## Backend layers

Django 5.1 + DRF 3.15 under **ASGI/uvicorn** (so the SSE view can stream),
layered so each concern lives in one place:

```
budgets/
├── models.py         # BudgetScenario, BudgetLineItem, AssistantRun (+ custom QuerySet)
├── serializers.py    # validation + derived-on-read fields
├── views.py          # thin DRF generic views + 2 APIViews
├── filters.py        # django-filter FilterSets (field-scoped 400s)
├── services/         # DETERMINISTIC DOMAIN LAYER — pure Decimal math, no LLM
│   ├── scenario_queries.py  # the only read-path ORM access for analysis
│   ├── budget_analysis.py   # variance, severity, grouping, filtering (source of truth)
│   ├── risk_rules.py · simulations.py · scenario_health.py
│   ├── data_quality.py · methodology.py · money.py
├── ai/               # AI ORCHESTRATION — agent, tools, schemas, guardrails, prompts
├── streaming/sse.py  # plain async view (NOT DRF): claim run, relay events
└── management/commands/seed_budget.py
```

| Layer | Rule |
|---|---|
| **API (DRF)** | Thin generic views. Filtering in FilterSets, validation in serializers, totals as QuerySet annotations. No business math. |
| **Domain (services)** | Pure functions on `Decimal`. No LLM; the only ORM read access is isolated in `scenario_queries.py` so calc functions stay testable with plain objects. |
| **AI (ai/)** | Selects a tool, passes typed params, stashes the *validated* envelope for streaming, hands the model a short text summary. |
| **Streaming (sse.py)** | Plain async view that claims the run and relays agent events as SSE frames. |

Four choices carry most of the correctness weight:

- All money is `Decimal`, crossing the API as **strings** (`money.py`) — no float
  rounding.
- Derived values (`variance`, `variance_percent`, `severity`, `health`, totals)
  are **computed on read, never stored** — one source of truth.
- Scenario totals use **correlated subqueries** (`with_item_totals()`) not
  JOIN+GROUP BY, so a paginated list aggregates only the returned scenarios (no
  N+1; a test asserts ≤ 2 queries for list, 1 for detail).
- **DB check constraints** back serializer validation: period `end ≥ start`,
  line-item amounts `≥ 0`.

## Data model

Only **inputs** are persisted; everything derived is computed on read.

```
BudgetScenario 1──* BudgetLineItem      (cascade delete)
BudgetScenario 1──* AssistantRun        (cascade delete)

BudgetScenario   id, name, period_start, period_end, currency, timestamps
                 CHECK period_end ≥ period_start
BudgetLineItem   id, scenario_id, department, category, description,
                 budget_amount, actual_amount, timestamps
                 CHECK budget_amount ≥ 0 AND actual_amount ≥ 0
                 idx (scenario, department), (scenario, category)
AssistantRun     id(uuid), scenario_id, question, context(jsonb),
                 status(pending|running|completed|failed), timestamps
                 — exists ONLY for the POST→GET SSE handoff, not chat history
```

### Database selection

Postgres is the target database and is what Compose points `DATABASE_URL` at.
With that variable unset, `settings.py` falls back to a SQLite file, so a
checkout runs — and its tests run — with no database server installed. The two
are interchangeable here because nothing in the schema or the queries is
Postgres-specific.

`seed_budget` (idempotent) loads six scenarios across 2026 — a mix of over- and
under-budget spend, including a few incomplete rows (no description, spend
against a zero budget), the shape a real budget export tends to have.

## Assistant flow

A **POST-then-GET** handoff, so the SSE stream is a plain GET that `EventSource`
can open.

```
User asks question
  → POST /assistant/messages/ { question, context? }   context = last primary result (untrusted, optional)
  → create AssistantRun(pending) → { run_id }
  → open EventSource: GET /assistant/stream/?run_id=…
  → backend atomically claims run  (UPDATE … WHERE status='pending')
        ├─ no OPENAI_API_KEY → error event ("assistant not configured") → done
        ├─ blocking guardrail: out of scope → result:{type:"refusal"} → done
        └─ agent runs (Runner.run_streamed, temperature=0):
             picks ONE tool → tool calls deterministic service → validated envelope(s)
             stashed on run context; model writes 1–3 sentence explanation
  → events, in order: status ("Running analyze_variances…") · result (each envelope)
                      · message (text deltas)
  → run marked completed | failed → done
```

- `scenario_id` is injected server-side into the tool run context — **never**
  taken from the model.
- Any provider/agent exception degrades to a single `error` event; the generator
  never raises.
- The agent run executes **inside** the SSE request (no Celery/Redis/worker).

## Tools and guardrails

One agent (`Budget analyst`), `temperature=0`, model from `OPENAI_MODEL`
(default `gpt-4o-mini`), on the **OpenAI Agents SDK**. Instructions forbid the
model from doing math — it must call a tool for every number.

Each `@function_tool` validates model args, calls a **pure builder** (wrapped in
`sync_to_async`), stashes the validated envelope on the run context, and returns
a compact text summary.

| Tool | Params (model-supplied) | Result types |
|---|---|---|
| `analyze_variances` | `group_by?`, `direction` (over/under/all), `min_severity?`, `department?`, `category?`, `rank_by` | `variance_table` **or** `grouped_summary`, + `simple_chart` |
| `identify_budget_risks` | `limit` (1–20, default 3) | `risk_list`, `recommendation_card`? |
| `simulate_spend_change` | `target_type`, `target_name`, `percent_change` (−100…500) | `simulation_result`, `recommendation_card` |
| `check_data_quality` | *(none)* | `data_quality_report` |
| `explain_metrics` | *(none)* | *(text only — definitions from real threshold constants)* |

Guardrails, in depth order:

- **Blocking input guardrail** — a separate tiny classifier agent
  (`ScopeCheck{in_scope}`) runs *before* any text streams, so off-topic requests
  yield a clean `refusal`, never a partial answer.
- **Param validation** — enums checked, `limit` clamped, `percent_change`
  bounded, unknown `target_name` raises with available names.
- **Server-injected `scenario_id`** — not trusted from the model.
- **Output validation** — every envelope is a Pydantic model, so only
  schema-valid JSON is streamed.
- **Untrusted follow-up context** — capped at 20 KB, must carry a known `type`,
  re-validated at the POST boundary; used *only* to resolve references like
  "this" — numbers always come from a fresh DB read.

## SSE protocol

Plain async Django view (`streaming/sse.py`, **not** DRF) returning
`StreamingHttpResponse` with `Content-Type: text/event-stream`,
`X-Accel-Buffering: no`, `Cache-Control: no-cache`. **GZipMiddleware is
deliberately not installed** (it would buffer the stream).

**Atomic claim:** `_claim_run` does a single `UPDATE … WHERE status='pending'`, so
a run executes at most once even if the stream is opened twice.

Wire format is `event: <name>\ndata: <json>\n\n`:

- `status` — high-level progress (one per tool as it starts).
- `result` — a validated envelope, flushed as soon as a tool produces it.
- `message` — assistant text delta (token-by-token).
- `error` — controlled failure (no key, classifier crash, agent exception).
- `done` — terminal; client closes the `EventSource`.

Lifecycle `pending → running → (completed | failed)`; a client disconnect
(`asyncio.CancelledError`) marks the run `failed`. The frontend disambiguates the
named `error` event from `EventSource`'s native error by the presence of `data`.

## Frontend

Next.js 14 (App Router) + React 18 + TypeScript + MUI 6, MUI X **DataGrid** 7.
No global-state or data-fetch library — plain `fetch` (`lib/api.ts`) plus small
hooks.

```
app/scenarios/page.tsx            → <ScenarioList>   (create/edit/delete scenarios)
app/scenarios/[id]/page.tsx       → <Workspace>      (header + metric tiles + grid + assistant)
lib/  api.ts · sse.ts · types.ts · useAssistantChat.ts · serverGrid.ts
components/  LineItemTable · BudgetAssistant · ChatMessageList ·
             AnalysisResultRenderer → { VarianceTable, GroupedSummary, RiskList,
             SimulationCard, SimpleChart, RecommendationCard, DataQualityReport,
             RefusalNotice } · ResultCard + Provenance ("Why this answer?")
```

- **CRUD tables** run the DataGrid fully **server-driven**
  (`paginationMode/sortingMode/filterMode="server"`); `useServerGridState` maps
  grid state → DRF query params, `usePaginatedList` owns data/loading/error.
- **Assistant** (`useAssistantChat`): `POST` → open SSE →
  `onStatus/onMessage/onResult/onError/onDone` fold into the turn; each result is
  rendered via `AnalysisResultRenderer` inside a `ResultCard` with a provenance panel.
- **Follow-up context:** only the latest *primary* result
  (`variance_table | grouped_summary | risk_list | simulation_result`) is sent as
  the next request's `context`; switching scenarios resets the conversation.
- `simple_chart` is a lightweight CSS bar chart (no charting library).

## Testing

pytest + pytest-django + pytest-asyncio (`asyncio_mode=auto`) on the backend,
vitest on the frontend, with a backend coverage floor of **80 %**.

Both suites run **on the host, never in a container**: the test runners live in
`requirements-dev.txt` and `devDependencies`, and are excluded from the images
via `.dockerignore`. `pytest` alone is enough — Django substitutes an in-memory
SQLite database for the file-backed default. Setting `DATABASE_URL` runs the
identical suite against Postgres.

Tests mirror the layer they cover: `budgets/tests/test_budget_analysis.py` and
friends drive the domain services directly, `test_api.py` goes through DRF, and
`test_assistant_run.py` / `test_sse.py` cover the assistant handoff with a
mocked agent. The domain layer is tested with lightweight `SimpleNamespace`
stand-ins rather than model instances, which is what keeps it fast and DB-free.
On the frontend, `lib/*.test.ts` cover the presentation helpers (notably the
sign flip between the API's `actual - budget` and the finance convention shown
to the user) and the SSE event dispatch against a fake `EventSource`.

CI (`.github/workflows/ci.yml`) runs lint, types, formatting and both test
suites on every push and pull request.
