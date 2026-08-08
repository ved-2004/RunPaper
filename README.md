# RunPaper

**Upload a research paper. Get runnable Python code in minutes.**

RunPaper takes an ML/AI research paper (PDF or arXiv ID) and automatically produces a runnable implementation scaffold, interactive architecture diagram, reproducibility checklist, Jupyter notebook, and a chat interface — all grounded in the paper's actual content.

## What You Get

| Tab | Output |
|---|---|
| **Learn** | Interactive architecture flowchart. Click any node to see its description, LaTeX math, and the exact code function that implements it. |
| **Code** | `model.py`, `train.py`, `config.yaml`, `requirements.txt` with exact hyperparameters. `# TODO` markers where the paper is ambiguous. Download as `.zip` or run in Colab (`.ipynb`). |
| **Extraction** | Structured metadata: title, authors, hyperparameters, key equations (KaTeX rendered), datasets. |
| **Reproducibility** | ~20-criterion checklist of what the paper specifies vs. what's missing. |
| **Chat** | Ask anything about the paper. Answers reference code functions and flowchart nodes. |
| **Paper** | Original PDF rendered inline. |

Plus: **Explain panel** — click any equation, hyperparameter, flowchart node, or code function for a floating inline AI explanation. **Sanity badge** — automated code quality check (syntax, config validation, LLM review).

## Architecture

Three services work together. The LLM pipeline lives in a companion repo ([`RunPaper-llm`](../RunPaper-llm/)):

```
Browser (port 3100 by default)
  └─► Backend API (port 8000)   ← auth, DB, file storage, routing
        └─► LLM Service (port 8001)   ← pipeline, chat, explain
```

## Quick Start

### Prerequisites
- Node.js 20+, Python 3.11+
- Supabase project + Google OAuth2 credentials
- LLM API key (Anthropic, OpenAI, or Gemini)

### Install dependencies

```bash
cd ..
python3.11 -m venv .venv
.venv/bin/python -m pip install -r RunPaper/backend/requirements.txt -r RunPaper-llm/requirements.txt
cd RunPaper
npm install
npm install --prefix frontend
```

### Configure

**`backend/.env`** — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `JWT_SECRET`, `LLM_SERVICE_URL=http://localhost:8001`, `LLM_SERVICE_KEY`

**`frontend/.env.local`** — `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

### Database setup

Run all migration files in order in your Supabase SQL Editor (`backend/api/schemas/migrations/001` through latest). If your database is already partially migrated and errors with a missing current table such as `user_papers`, run `backend/api/schemas/migrations/012_repair_current_schema.sql` directly first, then rerun the migration command.

### Run everything

From the `RunPaper` repo root:

```bash
npm run dev
```

Starts frontend (3100), backend (8000), and the sibling `../RunPaper-llm` service (8001) with colour-coded output:

- `frontend`: magenta
- `backend`: blue
- `llm`: yellow

Open `http://localhost:3100` for local authentication. The frontend also listens
on `127.0.0.1:3100`, but using one hostname consistently avoids OAuth cookie issues.

Override any local port when another project needs it:

```bash
RUNPAPER_FRONTEND_PORT=3200 RUNPAPER_BACKEND_PORT=8100 RUNPAPER_LLM_PORT=8101 npm run dev
```

Changing the backend port also requires the matching Google OAuth callback URL
to be authorized, so keep the default `8000` unless that URI is configured.

The Python services use the workspace-level `../.venv/bin/python`, local `.venv/bin/python`, local `venv/bin/python`, or `python3` in that order, and run Uvicorn with `--log-level info`, so app logs and pipeline timing logs print directly in the same terminal.

---

## Deployment

- **Frontend**: Vercel or Cloud Run. `NEXT_PUBLIC_API_BASE_URL` is baked in at build time — set it in `.env.production`.
- **Backend + LLM service**: Cloud Run or any Docker host. Each has an independent `Dockerfile`.

See [`TECHNICAL.md`](./TECHNICAL.md) for the full architecture, database schema, API reference, and deployment details.
