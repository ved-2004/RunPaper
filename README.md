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
Browser (port 3000)
  └─► Backend API (port 8000)   ← auth, DB, file storage, routing
        └─► LLM Service (port 8001)   ← pipeline, chat, explain
```

## Quick Start

### Prerequisites
- Node.js 20+, Python 3.11+
- Supabase project + Google OAuth2 credentials
- LLM API key (Anthropic, OpenAI, or Gemini)
- [honcho](https://honcho.readthedocs.io/) (`pip install honcho`)

### Install dependencies

```bash
cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
cd frontend && npm install
# Also set up RunPaper-llm — see its README
```

### Configure

**`backend/.env`** — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `JWT_SECRET`, `LLM_SERVICE_URL=http://localhost:8001`, `LLM_SERVICE_KEY`

**`frontend/.env.local`** — `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

### Database setup

Run all migration files in order in your Supabase SQL Editor (`backend/api/schemas/migrations/001` through `008`).

### Run everything

From the repo root (where `Procfile` lives):

```bash
honcho start
```

Starts frontend (3000), backend (8000), and LLM service (8001) with colour-coded output.

---

## Deployment

- **Frontend**: Vercel or Cloud Run. `NEXT_PUBLIC_API_BASE_URL` is baked in at build time — set it in `.env.production`.
- **Backend + LLM service**: Cloud Run or any Docker host. Each has an independent `Dockerfile`.

See [`TECHNICAL.md`](./TECHNICAL.md) for the full architecture, database schema, API reference, and deployment details.
