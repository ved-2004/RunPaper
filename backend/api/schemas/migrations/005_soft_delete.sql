-- Migration 005: Soft delete for papers
-- Papers are never hard-deleted. Setting deleted_at marks them as removed.
-- All queries filter WHERE deleted_at IS NULL.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS papers_deleted_at_idx ON papers(deleted_at) WHERE deleted_at IS NULL;
