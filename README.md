# Vyapaar-Mitra

**Multi-agent operational risk analysis for small & medium businesses.**

Vyapaar-Mitra ingests a business's inventory, supplier, customer, and marketing
metrics, runs them through four specialized AI agents in parallel, and a fifth
"risk evaluator" agent synthesizes a single **operational risk score**, a
**cash-flow impact prediction**, and three **mitigation playbooks** — plus
detailed per-domain insights (dead stock, vendor reliability, buyer
concentration, ROAS anomalies, …).

The system has two cleanly decoupled halves:

- **`backend/`** — a stateful [LangGraph](https://langchain-ai.github.io/langgraph/)
  agent engine, wrapped by a thin FastAPI delivery layer.
- **`frontend/`** — a Next.js dashboard (auth, per-domain pages, run history).

---

## Architecture

```
   Browser (Next.js 16)                 FastAPI gateway              LangGraph engine
 ┌────────────────────┐  POST /api/    ┌──────────────────┐ ainvoke ┌────────────────────┐
 │ dashboard pages     │ analyze-      │ main.py           │ ──────► │ vyapaar_mitra_core   │
 │ edit metrics  ─────►│ operations    │ validate · map ·  │         │  (compiled StateGraph)│
 │ "Run analysis"      │ ─────────────►│ log · shape resp. │ ◄────── │  4 agents + evaluator │
 │ render results      │ ◄─────────────│                   │ result  └────────────────────┘
 └────────────────────┘  JSON          └──────────────────┘
```

The frontend never imports engine code; the engine never imports HTTP code.
`backend/main.py` is the only bridge between them.

### The engine graph

```
                              START
                                │  (fan-out, parallel)
        ┌──────────────┬────────┼─────────┬──────────────┐
        ▼              ▼        ▼         ▼
   inventory_node  supplier_node  customer_node  marketing_node
        └──────────────┴────────┬─────────┴──────────────┘
                                ▼  (fan-in)
                       risk_evaluator_node
                                ▼
                               END
```

Each domain agent writes only its own slice of the shared `BusinessState`
(`*_insights`), so the four run concurrently with no write conflicts. The risk
evaluator runs last, reads all four, and writes the synthesis fields.

---

## Tech stack

| Layer        | Tech                                                                 |
|--------------|----------------------------------------------------------------------|
| Engine       | LangGraph 1.x, LangChain (Groq / Ollama → Llama 3.3 70B), Pydantic v2 |
| API          | FastAPI, Uvicorn                                                      |
| Checkpointer | `langgraph-checkpoint-firestore` (Firestore) / `MemorySaver` fallback |
| Frontend     | Next.js 16 (App Router), React 19, Tailwind CSS v4, Recharts, lucide-react |
| Auth (current) | Local mock (localStorage) — designed to be swapped for Firebase    |

---

## Repository structure

```
vyapaar-mitra/
├── backend/
│   ├── app/
│   │   ├── agents/                 # the LangGraph engine ("operations engine")
│   │   │   ├── state.py            # BusinessState (shared graph state)
│   │   │   ├── llm.py              # LLM access + offline deterministic fallback
│   │   │   ├── inventory.py        # ┐
│   │   │   ├── supplier.py         # │ four domain agents (run in parallel)
│   │   │   ├── customer.py         # │
│   │   │   ├── marketing.py        # ┘
│   │   │   ├── risk_evaluator.py   # orchestrator (runs last, synthesizes)
│   │   │   └── graph.py            # wires + compiles → `vyapaar_mitra_core`
│   │   └── schemas/
│   │       └── business.py         # Pydantic request/response contracts
│   ├── main.py                     # FastAPI gateway (the delivery layer)
│   ├── test_ops_engine.py          # standalone engine harness (no FastAPI)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/                    # App Router pages
        │   ├── page.tsx            # marketing landing (public)
        │   ├── login/              # sign in / sign up (public)
        │   └── dashboard/          # guarded: overview + per-domain pages
        │       ├── page.tsx        # overview (run button + synthesis)
        │       ├── inventory/      # ┐
        │       ├── suppliers/      # │ per-domain edit + insight pages
        │       ├── customers/      # │
        │       ├── marketing/      # ┘
        │       ├── simulations/    # per-user run history
        │       └── settings/       # profile
        ├── components/             # Navbar, Footer, ResultsPanel, ScoreGauge, ops-ui
        ├── context/                # AuthContext (mock auth), OpsContext (shared draft + run)
        ├── lib/                    # api.ts (backend client), runs.ts (history), utils
        └── types/                  # assessment.ts (request/response/insight types)
```

---

## Getting started

### Prerequisites

- **Python 3.11+** (developed on 3.13)
- **Node.js 18+** (developed on 24)

### 1. Backend — the engine + API

```bash
cd backend

# create / activate a virtualenv (a .venv already exists in this repo)
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# (a) run the engine standalone, no API, prints the full final state:
python test_ops_engine.py

# (b) run the API gateway:
python -m uvicorn main:app --reload --port 8000
```

> **Tip:** use `python -m uvicorn ...` rather than a bare `uvicorn` unless the
> virtualenv is activated and on your `PATH`.

API runs at `http://localhost:8000` — interactive docs at `/docs`,
liveness at `/health`.

### 2. Frontend — the dashboard

```bash
cd frontend
npm install

# point the frontend at the backend (see frontend/.env.local):
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

npm run dev                          # http://localhost:3000
```

Then open `http://localhost:3000`, **create an account** (or use the seeded
demo account: `demo@vyapaar-mitra.app` / `demo1234`), go to the dashboard,
edit any domain's metrics, and click **Run analysis**.

> Opening the app from a LAN IP (e.g. `http://192.168.1.7:3000`) instead of
> `localhost` requires that host to be listed in `allowedDevOrigins` in
> `frontend/next.config.ts`, or Next will block dev resources (HMR + hydration).

---

## Configuration (environment variables)

### Backend

| Variable | Default | Purpose |
|----------|---------|---------|
| `RESILIO_LLM_PROVIDER` | `groq` | LLM provider: `groq` or `ollama` |
| `RESILIO_LLM_MODEL` | `llama-3.3-70b-versatile` / `llama3.3:70b` | Model id (provider-specific) |
| `GROQ_API_KEY` | — | Required for live Groq calls; absent ⇒ OFFLINE mode |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama server URL |
| `RESILIO_OFFLINE` | — | Set `1` to force the deterministic fallback |
| `RESILIO_USE_FIRESTORE` | `auto` | `1`/`true` to force Firestore checkpointer |
| `FIRESTORE_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | — | Enables Firestore checkpointer (`auto` mode) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to GCP service-account JSON |

### Frontend (`frontend/.env.local`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

---

## API reference

### `POST /api/analyze-operations`

Validates the payload, runs the engine once (`thread_id = session_id`), and
returns the synthesis plus every domain's insight block.

**Request** (`OperationalMetricsPayload`):

```jsonc
{
  "user_id": "user_123",
  "session_id": "sess_abc",          // forwarded as the checkpointer thread_id
  "inventory":  { "skus": { "SKU-1": { "on_hand": 40, "monthly_demand": 220 } } },
  "suppliers":  { "vendors": [ { "name": "...", "criticality": "HIGH", "single_source": true,
                                 "on_time_delivery_rate": 0.82, "defect_rate": 0.06,
                                 "lead_time_days": 45 } ] },
  "customers":  { "total_customers": 240, "churned_last_30d": 18, "churn_trend_multiplier": 1.4,
                  "avg_order_value": 3200, "orders_per_year": 6,
                  "revenue_by_customer": { "Acme": 1900000 }, "at_risk_segments": ["SMB"] },
  "marketing":  { "current_cac": 1450, "prior_cac": 1100,
                  "campaigns": [ { "name": "Meta", "spend": 200000, "revenue": 160000,
                                   "expected_roas": 2.5 } ] }
}
```

**Response** (`OperationalAnalysisResponse`):

```jsonc
{
  "status": "success",
  "risk_score": 66,                          // 0-100
  "cash_flow_impact_prediction": "…",
  "mitigation_playbooks": [ { "title": "…", "priority": "IMMEDIATE",
                              "action_items": ["…"], "expected_impact": "…" } ],
  "inventory_insights":  { "dead_stock": [...], "stockout_forecast": [...], "key_findings": [...] },
  "supplier_insights":   { "vendor_scorecards": [...], "single_source_bottlenecks": [...], ... },
  "customer_insights":   { "concentration": {...}, "ltv_outlook": {...}, ... },
  "marketing_insights":  { "roas_anomalies": [...], "cac_inflation": {...}, ... }
}
```

`GET /health` → `{ "status": "ok" }`.

---

## How a request flows

1. **Frontend** (`OpsContext.runAnalysis`) gathers the shared draft from all four
   domain pages, builds the payload, and POSTs it (`lib/api.ts`).
2. **FastAPI** (`main.py`) validates, maps the four blocks into `raw_inputs`,
   sets `thread_id = session_id`, and calls
   `await vyapaar_mitra_core.ainvoke(inputs, config)`.
3. **Engine** fans out to the four agents → each calls `run_structured()` (live
   LLM with `.with_structured_output()`, or the offline fallback) and writes its
   insights → risk evaluator fans in and writes the synthesis. State is saved by
   the checkpointer under `thread_id`.
4. **FastAPI** shapes the JSON response (synthesis + four insight blocks).
5. **Frontend** stores the result, renders synthesis on the overview, slices
   each insight block onto its domain page, and records the run in history.

---

## Testing

```bash
cd backend
python test_ops_engine.py            # end-to-end engine run, prints final state

cd ../frontend
npx tsc --noEmit                     # type-check
npm run build                        # production build (also type-checks)
npm run lint                         # ESLint
```

---

## Current status & swap-in points

These are intentional development defaults, each isolated to one place:

| Area | Now | To productionize |
|------|-----|------------------|
| **LLM** | **OFFLINE** deterministic fallback (no key set) | Set `GROQ_API_KEY` (or run Ollama) → live Llama 3.3 70B. Same data shapes. |
| **Checkpointer** | `MemorySaver` (not durable across restarts) | Set Firestore env vars → `FirestoreSaver`. |
| **Auth** | Local mock in `context/AuthContext.tsx` (localStorage, plaintext passwords) | Replace that one module with real Firebase Auth; rest of the app only uses `useAuth()`. |
| **Run history** | `localStorage` (`lib/runs.ts`) | Swap for Firestore. |

> ⚠️ The mock auth stores passwords in plaintext in the browser — for local
> development only. Do not use real credentials.

---

## Conventions

- Backend: agents are pure async node functions that read one slice of state and
  return one slice; all model access goes through `app/agents/llm.py`.
- Keep the delivery layer (`main.py`, `schemas/`) free of engine internals and
  vice-versa.
- Frontend: shared dashboard state lives in `OpsContext`; auth in `AuthContext`;
  the backend is reached only via `lib/api.ts`.
```
