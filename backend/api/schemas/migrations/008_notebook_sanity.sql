-- Migration 008: Notebook and Sanity Check columns
-- Adds notebook_json, sanity_status, sanity_details_json to paper_analyses.

ALTER TABLE paper_analyses
    ADD COLUMN IF NOT EXISTS notebook_json      JSONB,
    ADD COLUMN IF NOT EXISTS sanity_status      TEXT
        CHECK (sanity_status IN ('passed', 'warning', 'failed', 'skipped', 'pending')),
    ADD COLUMN IF NOT EXISTS sanity_details_json JSONB;

-- Default existing rows to 'pending' so the badge shows "Not yet checked"
UPDATE paper_analyses
SET sanity_status = 'pending'
WHERE sanity_status IS NULL;
