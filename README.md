# RunPaper

**From paper to PyTorch in minutes.**

Upload any ML/AI research paper (arXiv PDF) and get back:

1. **Structured Extraction** — title, authors, method, hyperparameters, datasets, and flagged ambiguities
2. **Code Scaffold** — runnable `model.py`, `train.py`, `config.yaml`, and `requirements.txt` with `# TODO` markers where the paper is underspecified
3. **Reproducibility Checklist** — green/red indicators for ~20 criteria (random seed, optimizer, learning rate schedule, dataset splits, hardware, etc.) with suggested defaults for anything missing

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui, React Query |
| Backend | FastAPI, Python 3.11+ |
| LLM | Provider-agnostic (`anthropic` / `openai` / `gemini`) |
| PDF parsing | PyMuPDF |
| Auth | Google OAuth2 + JWT |
| Storage | Supabase (Storage + Postgres) |
| Vector store | ChromaDB |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (or skip — the app falls back to in-memory storage)
- An API key for at least one LLM provider

### Backend

```bash
cd backend

# (Optional) Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r api/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set LLM_PROVIDER and the matching API key

# Run
uvicorn api.main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd frontend

npm install
npm run dev
```

---

## Environment Variables

Copy `backend/.env.example` and fill in values.

### Required

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | `anthropic` \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY` | Required if `LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | Required if `LLM_PROVIDER=openai` |
| `GEMINI_API_KEY` | Required if `LLM_PROVIDER=gemini` |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `JWT_SECRET` | Secret for signing JWTs |

### Optional (Supabase)

Without these, the app stores data in memory (resets on restart).

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `SUPABASE_BUCKET` | Storage bucket name (`runpaper-uploads`) |

### LLM Model Overrides

| Variable | Default |
|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` |
| `OPENAI_MODEL` | `gpt-4o` |
| `GEMINI_MODEL` | `gemini-2.5-pro` |

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/papers/upload-and-analyze` | Upload PDF, start pipeline |
| `GET` | `/api/papers` | List user's papers |
| `GET` | `/api/papers/{id}` | Get paper results (poll until `status=complete`) |
| `GET` | `/api/papers/{id}/download` | Download code scaffold as `.zip` |
| `GET` | `/auth/google` | Begin Google OAuth2 flow |

The upload endpoint returns immediately with a `paper_id`. Poll `GET /api/papers/{id}` every few seconds until `status` is `complete` or `failed`.

---

## Database

There is a single migration file. Run it against your Supabase Postgres instance before starting the backend.

**Option A — automated runner (recommended):**

```bash
cd backend
# DATABASE_URL must be set in .env (see backend/.env.example)
python -m api.scripts.migrate
```

**Option B — Supabase SQL editor:**

Paste the contents of `backend/api/schemas/migrations/001_runpaper_schema.sql` into the SQL editor in the Supabase dashboard and run it.

**Option C — psql directly:**

```bash
export DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
psql $DATABASE_URL -f backend/api/schemas/migrations/001_runpaper_schema.sql
```

> The app runs without a database (in-memory fallback), but data will not persist across restarts.

---

## Project Structure

```
backend/
└── api/
    ├── main.py                    # FastAPI app entry point
    ├── llm_client.py              # Provider-agnostic LLM interface
    ├── paper_extraction/          # PDF → structured JSON pipeline
    ├── code_generation/           # Extraction → code scaffold pipeline
    ├── reproducibility/           # Extraction → checklist pipeline
    ├── routers/                   # API route handlers
    ├── services/                  # papers_db, storage
    └── rag/                       # ChromaDB vector store + fetcher stubs

frontend/
├── app/                           # Next.js App Router pages
│   ├── page.tsx                   # Landing page
│   ├── dashboard/                 # Paper list
│   ├── upload/                    # PDF upload
│   ├── papers/[id]/               # Three-tab results view
│   └── auth/callback/             # OAuth callback
├── components/
│   ├── runpaper/                # ExtractionTab, CodeTab, ReproducibilityTab
│   └── layout/                    # AppLayout, AppSidebar, TopNav
└── lib/
    ├── paperApi.ts                # API client
    └── config.ts                  # NEXT_PUBLIC_API_BASE_URL
```
