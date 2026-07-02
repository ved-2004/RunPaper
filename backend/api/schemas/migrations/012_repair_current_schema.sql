-- Migration 012: repair/ensure the current RunPaper runtime schema.
--
-- Why this exists:
--   001-006 created a legacy `papers` table.
--   007 split runtime persistence into `paper_analyses` + `user_papers`.
--   008-011 assumed those newer tables already existed.
--
-- If a Supabase database was manually migrated, partially migrated, or has stale
-- schema_migrations rows, later migrations can fail with errors like:
--   relation "user_papers" does not exist
--
-- This migration is intentionally idempotent. It creates the current tables when
-- missing, adds all columns the backend/LLM services currently read or write, and
-- installs duplicate-prevention guardrails.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id      TEXT        UNIQUE,
    email          TEXT,
    name           TEXT,
    avatar_url     TEXT,
    phone_number   TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    max_papers     INT         NOT NULL DEFAULT 5,
    credits        INT         NOT NULL DEFAULT 5
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS max_papers INT NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 5;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- ── paper_analyses: global analysis cache, one row per unique paper ──────────

CREATE TABLE IF NOT EXISTS paper_analyses (
    analysis_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id             TEXT,
    content_hash         TEXT,
    status               TEXT        NOT NULL DEFAULT 'processing',
    title                TEXT,
    authors_json         JSONB,
    extraction_json      JSONB,
    code_scaffold_json   JSONB,
    reproducibility_json JSONB,
    flowchart_json       JSONB,
    notebook_json        JSONB,
    sanity_status        TEXT        DEFAULT 'pending',
    sanity_details_json  JSONB,
    faq_json             JSONB,
    error_message        TEXT,
    failed_at            TIMESTAMPTZ,
    first_processed_at   TIMESTAMPTZ DEFAULT now(),
    request_count        INT         NOT NULL DEFAULT 1
);

ALTER TABLE paper_analyses
    ADD COLUMN IF NOT EXISTS arxiv_id TEXT,
    ADD COLUMN IF NOT EXISTS content_hash TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS authors_json JSONB,
    ADD COLUMN IF NOT EXISTS extraction_json JSONB,
    ADD COLUMN IF NOT EXISTS code_scaffold_json JSONB,
    ADD COLUMN IF NOT EXISTS reproducibility_json JSONB,
    ADD COLUMN IF NOT EXISTS flowchart_json JSONB,
    ADD COLUMN IF NOT EXISTS notebook_json JSONB,
    ADD COLUMN IF NOT EXISTS sanity_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS sanity_details_json JSONB,
    ADD COLUMN IF NOT EXISTS faq_json JSONB,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_processed_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS request_count INT NOT NULL DEFAULT 1;

UPDATE paper_analyses
SET sanity_status = COALESCE(sanity_status, 'pending');

UPDATE paper_analyses
SET failed_at = COALESCE(failed_at, first_processed_at, now())
WHERE status = 'failed';

DO $$
BEGIN
    ALTER TABLE paper_analyses
        ADD CONSTRAINT paper_analyses_status_check
        CHECK (status IN ('processing', 'complete', 'failed'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE paper_analyses
        ADD CONSTRAINT paper_analyses_sanity_status_check
        CHECK (sanity_status IN ('passed', 'warning', 'failed', 'skipped', 'pending'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS paper_analyses_status_idx ON paper_analyses(status);
CREATE INDEX IF NOT EXISTS paper_analyses_failed_at_idx
    ON paper_analyses(failed_at)
    WHERE status = 'failed';

-- ── user_papers: per-user links to shared analyses ───────────────────────────

CREATE TABLE IF NOT EXISTS user_papers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        TEXT        UNIQUE NOT NULL,
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
    trial_id        TEXT,
    analysis_id     UUID        REFERENCES paper_analyses(analysis_id) ON DELETE CASCADE,
    added_at        TIMESTAMPTZ DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    credit_consumed BOOLEAN     NOT NULL DEFAULT false
);

ALTER TABLE user_papers
    ADD COLUMN IF NOT EXISTS paper_id TEXT,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS trial_id TEXT,
    ADD COLUMN IF NOT EXISTS analysis_id UUID REFERENCES paper_analyses(analysis_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS credit_consumed BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS user_papers_paper_id_idx ON user_papers(paper_id);
CREATE INDEX IF NOT EXISTS user_papers_user_id_idx ON user_papers(user_id);
CREATE INDEX IF NOT EXISTS user_papers_analysis_idx ON user_papers(analysis_id);
CREATE INDEX IF NOT EXISTS user_papers_trial_id_idx
    ON user_papers(trial_id)
    WHERE trial_id IS NOT NULL;

-- ── Optional legacy backfill from papers if the old table exists ─────────────

DO $$
BEGIN
    IF to_regclass('public.papers') IS NOT NULL THEN
        ALTER TABLE papers
            ADD COLUMN IF NOT EXISTS flowchart_json JSONB,
            ADD COLUMN IF NOT EXISTS faq_json JSONB,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS trial_id TEXT;

        INSERT INTO paper_analyses (
            analysis_id, arxiv_id, content_hash, status, title, authors_json,
            extraction_json, code_scaffold_json, reproducibility_json,
            flowchart_json, faq_json, error_message, first_processed_at
        )
        SELECT DISTINCT ON (COALESCE(arxiv_id, paper_id))
            gen_random_uuid(),
            arxiv_id,
            NULL,
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

        INSERT INTO user_papers (paper_id, user_id, trial_id, analysis_id, added_at, deleted_at, credit_consumed)
        SELECT
            p.paper_id,
            p.user_id,
            p.trial_id,
            pa.analysis_id,
            p.uploaded_at,
            p.deleted_at,
            false
        FROM papers p
        JOIN paper_analyses pa
            ON (p.arxiv_id IS NOT NULL AND pa.arxiv_id = p.arxiv_id)
            OR (p.arxiv_id IS NULL AND pa.arxiv_id IS NULL AND pa.first_processed_at = p.uploaded_at)
        ON CONFLICT (paper_id) DO NOTHING;
    END IF;
END $$;

-- ── Collapse duplicate global analyses before installing unique indexes ─────

WITH ranked AS (
    SELECT
        analysis_id,
        FIRST_VALUE(analysis_id) OVER (
            PARTITION BY arxiv_id
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
            PARTITION BY arxiv_id
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS rn
    FROM paper_analyses
    WHERE arxiv_id IS NOT NULL
)
UPDATE user_papers up
SET analysis_id = ranked.keeper_id
FROM ranked
WHERE up.analysis_id = ranked.analysis_id
  AND ranked.rn > 1;

WITH ranked AS (
    SELECT
        analysis_id,
        ROW_NUMBER() OVER (
            PARTITION BY arxiv_id
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS rn
    FROM paper_analyses
    WHERE arxiv_id IS NOT NULL
)
DELETE FROM paper_analyses pa
USING ranked
WHERE pa.analysis_id = ranked.analysis_id
  AND ranked.rn > 1;

WITH ranked AS (
    SELECT
        analysis_id,
        FIRST_VALUE(analysis_id) OVER (
            PARTITION BY content_hash
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
            PARTITION BY content_hash
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS rn
    FROM paper_analyses
    WHERE content_hash IS NOT NULL
)
UPDATE user_papers up
SET analysis_id = ranked.keeper_id
FROM ranked
WHERE up.analysis_id = ranked.analysis_id
  AND ranked.rn > 1;

WITH ranked AS (
    SELECT
        analysis_id,
        ROW_NUMBER() OVER (
            PARTITION BY content_hash
            ORDER BY
                CASE status WHEN 'complete' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
                first_processed_at DESC NULLS LAST,
                analysis_id
        ) AS rn
    FROM paper_analyses
    WHERE content_hash IS NOT NULL
)
DELETE FROM paper_analyses pa
USING ranked
WHERE pa.analysis_id = ranked.analysis_id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS paper_analyses_arxiv_unique_idx
    ON paper_analyses(arxiv_id)
    WHERE arxiv_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS paper_analyses_content_hash_unique_idx
    ON paper_analyses(content_hash)
    WHERE content_hash IS NOT NULL;

-- Keep the newest active dashboard link for each user + shared analysis.
WITH ranked AS (
    SELECT
        paper_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, analysis_id
            ORDER BY added_at DESC NULLS LAST, paper_id DESC
        ) AS rn
    FROM user_papers
    WHERE deleted_at IS NULL
      AND user_id IS NOT NULL
      AND analysis_id IS NOT NULL
)
UPDATE user_papers up
SET deleted_at = now()
FROM ranked
WHERE up.paper_id = ranked.paper_id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_papers_one_active_analysis_per_user_idx
    ON user_papers(user_id, analysis_id)
    WHERE deleted_at IS NULL
      AND user_id IS NOT NULL
      AND analysis_id IS NOT NULL;

-- ── user_uploads: Supabase Storage metadata ──────────────────────────────────

CREATE TABLE IF NOT EXISTS user_uploads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id       TEXT        NOT NULL UNIQUE,
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT        NOT NULL,
    file_size_bytes BIGINT      NOT NULL DEFAULT 0,
    bucket_path     TEXT        NOT NULL,
    paper_id        TEXT,
    paper_id_fk     TEXT,
    program_id      TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL
);

ALTER TABLE user_uploads
    ADD COLUMN IF NOT EXISTS upload_id TEXT,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS filename TEXT,
    ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bucket_path TEXT,
    ADD COLUMN IF NOT EXISTS paper_id TEXT,
    ADD COLUMN IF NOT EXISTS paper_id_fk TEXT,
    ADD COLUMN IF NOT EXISTS program_id TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS user_uploads_upload_id_idx ON user_uploads(upload_id);
CREATE INDEX IF NOT EXISTS user_uploads_user_id_idx ON user_uploads(user_id);
CREATE INDEX IF NOT EXISTS user_uploads_program_id_idx
    ON user_uploads(program_id)
    WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_uploads_expires_at_idx ON user_uploads(expires_at);

-- ── trials ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trials (
    trial_id      TEXT        PRIMARY KEY,
    uploads_used  INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── feedback ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    name            TEXT        NOT NULL,
    role            TEXT        NOT NULL,
    organization    TEXT        NOT NULL,
    why_credits     TEXT        NOT NULL,
    improvements    TEXT        NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_submitted_at_idx ON feedback(submitted_at DESC);

COMMENT ON TABLE paper_analyses IS
    'Global paper analysis cache shared across users.';
COMMENT ON TABLE user_papers IS
    'Per-user links to shared paper analyses; dashboard rows live here.';
COMMENT ON COLUMN user_uploads.program_id IS
    'Current backend stores the paper_id here for PDF rerun recovery.';
