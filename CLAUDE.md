# CLAUDE.md — RunPaper Project Intelligence

This file is read automatically by Claude Code at the start of every session.
It contains the full project context, conventions, architecture, and routing decisions.

---

## What RunPaper Is

**RunPaper** — Upload any ML/AI research paper (arXiv PDF) → get runnable Python code in minutes.

Target users: ML engineers and researchers who want to reproduce or prototype from a paper without spending hours reverse-engineering math into training loops.

**Every uploaded paper produces:**
1. **Learn tab** — Interactive ReactFlow architecture diagram with click-to-inspect nodes (description, LaTeX math, code snippet). Resizable slide-over drawer. Companion panel mode (Code or Paper alongside the diagram).
2. **Code tab** — `model.py`, `train.py`, `config.yaml`, `requirements.txt` scaffold with `# TODO` markers. Function navigator sidebar from flowchart annotations. Download as `.zip`.
3. **Paper tab** — Original PDF rendered inline (Supabase signed URL or arXiv fallback).
4. **Extraction tab** — Title, authors, method, key equations (KaTeX), hyperparameter table (name, value, source, description), clickable dataset links (PapersWithCode).
5. **Reproducibility tab** — ~20 criteria checklist: ✅ explicitly stated / ❌ not specified (with suggested defaults). Legend shown above.
6. **Chat tab** — Live Q&A in Direct or Socratic mode. Pre-generated FAQ chips load instantly. Responses include code refs (file + function) and flowchart node refs. Cost-controlled: 3000-char model.py, 2000-char train.py, 6-message history window.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS, shadcn/ui, React Query, ReactFlow (`@xyflow/react`) |
| Backend | FastAPI, Python 3.11+ |
| LLM | Provider-agnostic — `api/llm_client.py` (Anthropic / OpenAI / Gemini via env var) |
| PDF parsing | PyMuPDF |
| Math rendering | KaTeX (dynamic import, SSR-safe, `frontend/components/ui/katex-math.tsx`) |
| Auth | Google OAuth2 + JWT, token in localStorage |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage with signed URLs |

---

## Directory Structure

```
backend/
└── api/
    ├── main.py                         # FastAPI app, router registration
    ├── llm_client.py                   # ONLY place to call LLM providers
    ├── paper_extraction/               # PDF bytes → extraction dict (Step 1)
    ├── code_generation/                # extraction → code scaffold (Step 2)
    ├── reproducibility/                # extraction + text → checklist (Step 3)
    ├── flowchart/                      # extraction + scaffold → ReactFlow graph (Step 4)
    ├── chat/                           # FAQ pre-gen (Step 5) + live chat endpoint
    ├── routers/
    │   ├── papers.py                   # Upload, list, get, download, pdf-url
    │   └── chat.py                     # GET /faq, POST /chat
    ├── services/
    │   ├── papers_db.py                # Supabase papers table (+ in-memory fallback)
    │   ├── trial_db.py                 # Anonymous trial tracking (trials table)
    │   └── storage.py                  # Supabase Storage upload + signed URLs
    └── schemas/migrations/
        ├── 001_runpaper_schema.sql     # users, user_uploads, papers tables
        ├── 002_flowchart_annotations.sql  # ADD COLUMN flowchart_json
        ├── 003_faq_column.sql          # ADD COLUMN faq_json
        └── 004_trials.sql             # trials table for free trial tracking

frontend/
├── app/
│   ├── page.tsx                        # Landing page (public)
│   ├── login/page.tsx                  # Google sign-in + "Try free" CTA (public)
│   ├── dashboard/page.tsx              # Paper list (requiresAuth=true)
│   ├── upload/page.tsx                 # PDF upload (requiresAuth=false — trial allowed)
│   ├── papers/[id]/page.tsx            # Results tabs (requiresAuth=false — trial allowed)
│   └── auth/callback/page.tsx          # OAuth callback handler
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx               # requiresAuth prop; isTrial passed to sidebar
│   │   ├── AppSidebar.tsx              # isTrial prop: reduced nav + Sign In CTA footer
│   │   └── TopNav.tsx                  # Breadcrumbs, theme toggle
│   ├── runpaper/
│   │   ├── FlowchartTab.tsx            # ReactFlow canvas + resizable NodeDrawer
│   │   ├── CodeTab.tsx                 # File selector + function navigator + viewer
│   │   ├── ChatTab.tsx                 # Live chat: FAQ chips, Direct/Socratic toggle
│   │   ├── ExtractionTab.tsx           # Equations (KaTeX), hyperparams, datasets
│   │   └── ReproducibilityTab.tsx      # Checklist with legend
│   └── ui/
│       └── katex-math.tsx              # <TexMath tex="..." display /> component
├── lib/
│   ├── paperApi.ts                     # All paper API calls; TrialExhaustedError
│   ├── chatApi.ts                      # getFaq(), sendMessage()
│   ├── trial.ts                        # getOrCreateTrialId(), getTrialId()
│   └── config.ts                       # NEXT_PUBLIC_API_BASE_URL
└── types/
    ├── paper.ts                        # PaperRecord, FlowchartData, etc.
    └── chat.ts                         # ChatMessage, ChatResponse, FaqItem, CodeRef
```

---

## Background Pipeline (5 steps, all async)

```
Upload PDF
  → Step 1: extract_paper()          PDF bytes → extraction dict (title, authors, method,
                                      equations, hyperparameters with descriptions, datasets)
  → Step 2: generate_code()          extraction → {model_py, train_py, config_yaml, requirements_txt}
  → Step 3: analyze_reproducibility() extraction + raw text → checklist [{criterion, present, value, ...}]
  → Step 4: generate_flowchart()     extraction + scaffold → {nodes, edges, annotations}
  → Step 5: generate_faq()           extraction + scaffold → [{question, answer, code_ref, code_file}] × 5

All saved to papers table on completion. Frontend polls GET /api/papers/{id} every 3s.
```

---

## Free Trial System

Anonymous users get **1 free paper upload** without signing in.

**How it works:**
- On first visit, `frontend/lib/trial.ts` generates a UUID and stores it in `localStorage` (`runpaper_trial_id`)
- Every upload sends `X-Trial-ID: <uuid>` header
- Backend (`routers/papers.py`) reads the header and calls `trial_db.check_and_consume(trial_id)`
- `trial_db.py` upserts a row in the `trials` table (Supabase) — allows if `uploads_used < 1`, increments, returns True; otherwise returns False → 403 `{"code": "trial_exhausted"}`
- Frontend catches `TrialExhaustedError` → shows modal with sign-in CTA
- Signed-in users (future: JWT detected) bypass trial check entirely
- Trial mode sidebar: shows only "Upload Paper" + "Sign in for more" footer button
- `AppLayout` `requiresAuth={false}`: `/upload` and `/papers/[id]` accessible without login

---

## Auth

- Google OAuth2 flow: `GET /auth/google` → redirect → `GET /auth/google/callback` → JWT
- JWT stored in `localStorage` as `runpaper_token`
- `AuthContext` reads token, fetches user on mount
- `AppLayout` `requiresAuth={true}` (default): redirects to `/login` if no user
- `AppLayout` `requiresAuth={false}`: renders for both signed-in and trial users

---

## LLM Client (`api/llm_client.py`)

```python
async def complete(system_prompt: str, user_prompt: str, model=None, max_tokens=4096) -> str
```

Controlled by env vars:
- `LLM_PROVIDER=anthropic|openai|gemini` (default: anthropic)
- `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`)
- `OPENAI_MODEL` (default: `gpt-4o`)
- `GEMINI_MODEL` (default: `gemini-2.5-pro`)

**Rule: Never import anthropic/openai/gemini SDKs anywhere except `llm_client.py`.**

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/papers/upload-and-analyze` | Trial or signed-in | Upload PDF, start pipeline |
| `GET` | `/api/papers` | None | List papers |
| `GET` | `/api/papers/{id}` | None | Get results (poll) |
| `GET` | `/api/papers/{id}/pdf-url` | None | Signed URL or arXiv fallback |
| `GET` | `/api/papers/{id}/download` | None | `.zip` of code scaffold |
| `GET` | `/api/papers/{id}/faq` | None | Pre-generated FAQ (5 Q&As) |
| `POST` | `/api/papers/{id}/chat` | None | Live chat (`{message, history, mode}`) |
| `GET` | `/auth/google` | — | Begin OAuth2 flow |
| `GET` | `/auth/google/callback` | — | OAuth2 callback → JWT |

---

## Database Tables

| Table | Purpose |
|---|---|
| `users` | Google OAuth users |
| `user_uploads` | Supabase Storage file metadata |
| `papers` | One row per PDF. Columns: paper_id, status, extraction_json, code_scaffold_json, reproducibility_json, flowchart_json, faq_json |
| `trials` | Anonymous trial tracking: trial_id (UUID), uploads_used, created_at, last_used_at |

Run all migrations before starting:
```bash
cd backend && python -m api.scripts.migrate
```
Or paste each `.sql` file into the Supabase SQL editor.

---

## Code Conventions

### Backend
- LLM calls only through `api/llm_client.py`
- Supabase for all persistence — every service has an in-memory fallback dict for dev
- All env vars declared in `.env.example` before use
- New pipeline steps go in `api/<step_name>/pipeline.py` with `__init__.py` exporting the main function

### Frontend
- All pages are `"use client"` — auth lives in localStorage
- API calls only through `frontend/lib/` — never `fetch()` directly from components
- React Query for server state, `useState`/`useReducer` for local state
- `requiresAuth={false}` on any page accessible without login
- Trial ID managed exclusively through `frontend/lib/trial.ts`

### Git
- Commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`
- Never commit `.env` — only `.env.example`

---

## Do Not Do

- ❌ Import anthropic/openai/gemini SDKs directly — use `api/llm_client.py`
- ❌ Store uploads on local disk — use Supabase Storage
- ❌ Use in-memory dicts as the primary store (only as fallback)
- ❌ Add new pages with auth without considering `requiresAuth` prop
- ❌ Call `fetch()` directly from React components — use `lib/` functions
- ❌ Commit secrets or `.env` files
- ❌ Use `<form>` tags in React components — use `onClick`/`onChange` handlers
