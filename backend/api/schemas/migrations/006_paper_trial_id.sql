-- Migration 006: Add trial_id column to papers table
-- Lets us link anonymous trial papers to a user account when they sign in.

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS trial_id TEXT;

CREATE INDEX IF NOT EXISTS papers_trial_id_idx ON papers(trial_id)
    WHERE trial_id IS NOT NULL;

COMMENT ON COLUMN papers.trial_id IS
    'Anonymous trial session ID (UUID stored in browser localStorage). '
    'Set on upload; cleared (user_id set) when the user signs in and migrates.';
