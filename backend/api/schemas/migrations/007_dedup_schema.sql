-- Migration 007: Paper deduplication + per-user ownership
--
-- Splits the monolithic `papers` table into:
--   paper_analyses  — global, one row per unique paper (keyed by arXiv ID or SHA-256 hash)
--   user_papers     — per-user ownership; soft-delete only removes the user's link
--
-- Also adds max_papers to users table (default 5) for the upload limit.

-- ── 1. Global paper analyses ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paper_analyses (
    analysis_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id             TEXT        UNIQUE,            -- NULL for non-arXiv uploads
    content_hash         TEXT        UNIQUE,            -- SHA-256 of PDF bytes; NULL for arXiv imports
    status               TEXT        NOT NULL DEFAULT 'processing'
                                     CHECK (status IN ('processing', 'complete', 'failed')),
    title                TEXT,
    authors_json         JSONB,
    extraction_json      JSONB,
    code_scaffold_json   JSONB,
    reproducibility_json JSONB,
    flowchart_json       JSONB,
    faq_json             JSONB,
    error_message        TEXT,
    first_processed_at   TIMESTAMPTZ DEFAULT now(),
    request_count        INT         NOT NULL DEFAULT 1  -- incremented each time a new user submits same paper
);

CREATE INDEX IF NOT EXISTS paper_analyses_arxiv_idx
    ON paper_analyses(arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS paper_analyses_hash_idx
    ON paper_analyses(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS paper_analyses_status_idx
    ON paper_analyses(status);

-- ── 2. Per-user paper ownership ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_papers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id    TEXT        UNIQUE NOT NULL,   -- URL-safe identifier used by the frontend
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    trial_id    TEXT,                          -- set for anonymous trial submissions
    analysis_id UUID        NOT NULL REFERENCES paper_analyses(analysis_id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ DEFAULT now(),
    deleted_at  TIMESTAMPTZ                    -- soft-delete: user removes their copy; global analysis preserved
);

CREATE INDEX IF NOT EXISTS user_papers_user_id_idx   ON user_papers(user_id);
CREATE INDEX IF NOT EXISTS user_papers_analysis_idx  ON user_papers(analysis_id);
CREATE INDEX IF NOT EXISTS user_papers_trial_id_idx  ON user_papers(trial_id) WHERE trial_id IS NOT NULL;

-- ── 3. User paper limit ───────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS max_papers INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN users.max_papers IS
    'Maximum number of papers this user can have. Default 5. Increase via admin script.';

-- ── 4. Migrate existing data ──────────────────────────────────────────────────
-- Creates one paper_analyses row per unique paper in the old papers table,
-- then one user_papers row per existing papers row.

-- 4a. Insert unique analyses (one per arxiv_id; one per paper_id for non-arXiv)
INSERT INTO paper_analyses (
    analysis_id, arxiv_id, content_hash, status, title, authors_json,
    extraction_json, code_scaffold_json, reproducibility_json, flowchart_json,
    faq_json, error_message, first_processed_at
)
SELECT DISTINCT ON (COALESCE(arxiv_id, paper_id))
    gen_random_uuid(),
    arxiv_id,
    NULL,   -- no content hash for pre-existing rows
    status,
    title,
    authors_json,
    extraction_json,
    code_scaffold_json,
    reproducibility_json,
    flowchart_json,
    faq_json,
    error_message,
    uploaded_at
FROM papers
WHERE deleted_at IS NULL
ORDER BY
    COALESCE(arxiv_id, paper_id),
    CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
    uploaded_at DESC
ON CONFLICT DO NOTHING;

-- 4b. Create user_papers rows linking each old papers row to its analysis
INSERT INTO user_papers (paper_id, user_id, trial_id, analysis_id, added_at, deleted_at)
SELECT
    p.paper_id,
    p.user_id,
    p.trial_id,
    pa.analysis_id,
    p.uploaded_at,
    p.deleted_at
FROM papers p
LEFT JOIN paper_analyses pa
    ON  (p.arxiv_id IS NOT NULL AND pa.arxiv_id = p.arxiv_id)
    OR  (p.arxiv_id IS NULL     AND pa.arxiv_id IS NULL AND pa.content_hash IS NULL
         AND pa.first_processed_at = p.uploaded_at)
WHERE p.deleted_at IS NULL
  AND pa.analysis_id IS NOT NULL
ON CONFLICT (paper_id) DO NOTHING;
