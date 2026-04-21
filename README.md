# RunPaper

**From research to implementation in minutes.**

Automatically extract research papers and generate production-ready Python code scaffolds with a single click.

## What You Get

- **Structured Extraction** — Automatically parse papers to extract key methods, hyperparameters, and datasets
- **Code Scaffold** — Runnable Python implementation with exact hyperparameters and reproducibility guidance
- **Reproducibility Analysis** — Get a detailed checklist of what's specified vs. missing
- **Interactive Flowchart** — Visual architecture diagram from the paper with code references

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- API keys for LLM providers (Anthropic, OpenAI, or Google Gemini)

### Frontend (Public-facing UI)
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### Backend (Paper processing engine)
For development setup, see `backend/.env.example` and configure your LLM provider, Supabase credentials, and Google OAuth settings.

> **Note:** The LLM service has been moved to a separate private repository for version control isolation.

---

## Deployment

The frontend is designed for deployment on Vercel, with the backend running on your infrastructure (Cloud Run, Docker, etc.).

**Key environment variables:**
- `NEXT_PUBLIC_API_BASE_URL` — Backend API endpoint
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth2 credentials
- LLM provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`)

---

## Architecture

RunPaper uses a multi-step pipeline to convert papers to code:

1. **PDF Processing** — Extract text and diagram images
2. **Structured Extraction** — Identify method, hyperparameters, datasets
3. **Code Generation** — Create runnable Python scaffolds
4. **Reproducibility Analysis** — Checklist of missing details
5. **Architecture Visualization** — Interactive flowchart with code references

Processing typically completes in 90–110 seconds per paper.

---

## Support

For questions or issues, reach out to the team or check the project documentation.
