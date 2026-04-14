# CLAUDE.md — Project Intelligence for Claude Code

This file is read automatically by Claude Code at the start of every session.
It contains project conventions, skill routing, and working patterns.

---

## Project Overview

**RunPaper** — Upload a research paper (arXiv PDF) → get runnable Python code.

The core value: go from reading a paper to running it. Upload a paper → get a Python
implementation scaffold you can actually execute and extend.

**Outputs per paper:**
1. **Extraction** — title, authors, core contribution, method breakdown, hyperparameter table, datasets
2. **Code Scaffold** — model.py, train.py, config.yaml, requirements.txt with # TODO markers
3. **Reproducibility** — checklist of what the paper provides vs what's missing

**Stack:**
- Backend: FastAPI (`/backend/api`) — entry point `main.py`
- Frontend: Next.js App Router (`/frontend-next`)
- Auth: Google OAuth2 + JWT
- Storage: Supabase (PostgreSQL + file storage)
- LLM: Provider-agnostic via `api/llm_client.py` (Anthropic/OpenAI/Gemini, env-driven)

---

## Skill Routing — Read Before Acting

| Task | Read First |
|------|-----------|
| Create or edit `.docx` Word documents | `.claude/skills/docx.md` |
| Create or edit `.xlsx` spreadsheets | `.claude/skills/xlsx.md` |
| Create or edit `.pptx` presentations | `.claude/skills/pptx.md` |
| Create, merge, split, or read PDFs | `.claude/skills/pdf.md` |
| Build frontend UI components or pages | `.claude/skills/frontend-design.md` |

---

## Code Conventions

### Backend (FastAPI / Python)

- Use `--break-system-packages` flag with pip installs
- All environment variables must be declared in `.env.example` before use
- LLM calls go through `api/llm_client.py` only — never import provider SDKs directly elsewhere
- Supabase for all persistence — no in-memory dicts for sessions/state
- RAG embeddings cached — never re-embed the same document

### Frontend (Next.js / TypeScript)

- All pages are Client Components (`"use client"`) — auth lives in localStorage
- API calls go through `/frontend-next/lib/` — never fetch directly from components
- State: React Query for server state, useState/useReducer for local
- No `<form>` tags — use onClick/onChange handlers

### Git

- Branch from `main` for each feature
- Commit messages: `feat:`, `fix:`, `refactor:`, `chore:` prefixes
- Never commit `.env` — only `.env.example`

---

## Architecture

### LLM Client (`api/llm_client.py`)

```python
async def complete(system_prompt, user_prompt, model=None, max_tokens=4096) -> str
```

Controlled by env vars:
- `LLM_PROVIDER=anthropic|openai|gemini` (default: anthropic)
- `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`

### Pipelines

- `api/paper_extraction/pipeline.py` — PDF bytes → extraction dict
- `api/code_generation/pipeline.py` — extraction dict → {model_py, train_py, config_yaml, requirements_txt}
- `api/reproducibility/pipeline.py` — extraction + paper text → checklist

### Database

Tables: `users`, `user_uploads`, `papers`

`papers` columns: paper_id, user_id, arxiv_id, title, authors_json, status, extraction_json, code_scaffold_json, reproducibility_json

### API Routes

- `POST /api/papers/upload-and-analyze` — upload PDF + start pipeline
- `GET /api/papers/{paper_id}` — get results (poll until status=complete)
- `GET /api/papers` — list user's papers
- `GET /api/papers/{paper_id}/download` — download code as .zip

---

## Environment Variables

See `.env.example` for the full list. Key vars:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=
```

---

## Testing

- Backend: `pytest /api/tests/` — run before every PR
- Frontend: `npm test` in `/frontend-next`

---

## Do Not Do

- ❌ Import anthropic/openai/gemini SDKs directly — use `api/llm_client.py`
- ❌ Store uploads on local disk (use Supabase Storage)
- ❌ Use in-memory dicts for session/paper state
- ❌ Re-embed documents already in the vector store
- ❌ Use `<form>` tags in React components
- ❌ Commit secrets or `.env` files
