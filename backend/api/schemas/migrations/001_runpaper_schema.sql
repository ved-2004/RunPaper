-- Migration 001: RunPaper initial schema
-- Run with: python -m api.scripts.migrate
-- Tables are created in dependency order (referenced tables first).
-- All user-owned tables cascade-delete when the parent user row is deleted.


-- ── 1. users ──────────────────────────────────────────────────────────────────
-- Populated on every Google OAuth login. id is the platform UUID for all FKs.

CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     text        NOT NULL UNIQUE,
  email         text        NOT NULL,
  name          text        NOT NULL,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx     ON users(email);


-- ── 2. user_uploads ───────────────────────────────────────────────────────────
-- File metadata for Supabase Storage uploads.
-- user_id is nullable so anonymous uploads can be recorded without a FK target.

CREATE TABLE IF NOT EXISTS user_uploads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       text        NOT NULL UNIQUE,
  user_id         uuid        REFERENCES users(id) ON DELETE CASCADE,
  filename        text        NOT NULL,
  file_size_bytes bigint      NOT NULL DEFAULT 0,
  bucket_path     text        NOT NULL,
  paper_id        text,                         -- set after paper is created
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS user_uploads_user_id_idx    ON user_uploads(user_id);
CREATE INDEX IF NOT EXISTS user_uploads_expires_at_idx ON user_uploads(expires_at);


-- ── 3. papers ─────────────────────────────────────────────────────────────────
-- One row per uploaded arXiv PDF. Stores the three-pipeline output as JSONB.
-- status transitions: processing → complete | failed

CREATE TABLE IF NOT EXISTS papers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id             text        UNIQUE NOT NULL,   -- short human-readable ID e.g. "A1B2C3D4"
  user_id              uuid        REFERENCES users(id) ON DELETE CASCADE,
  arxiv_id             text,                          -- e.g. "2301.00001" if detected
  title                text,
  authors_json         jsonb,                         -- list of author name strings
  uploaded_at          timestamptz NOT NULL DEFAULT now(),
  status               text        NOT NULL DEFAULT 'processing'
                                   CHECK (status IN ('processing', 'complete', 'failed')),
  extraction_json      jsonb,                         -- PaperExtraction dict
  code_scaffold_json   jsonb,                         -- {model_py, train_py, config_yaml, requirements_txt}
  reproducibility_json jsonb,                         -- list of ReproducibilityItem dicts
  error_message        text
);

CREATE INDEX IF NOT EXISTS papers_user_id_idx  ON papers(user_id);
CREATE INDEX IF NOT EXISTS papers_paper_id_idx ON papers(paper_id);
CREATE INDEX IF NOT EXISTS papers_arxiv_id_idx ON papers(arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS papers_status_idx   ON papers(status);

-- Link uploads → papers (nullable for backwards compat)
ALTER TABLE user_uploads
  ADD COLUMN IF NOT EXISTS paper_id_fk text REFERENCES papers(paper_id) ON DELETE SET NULL;
