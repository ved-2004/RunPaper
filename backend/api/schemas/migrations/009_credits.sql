-- Migration 009: Credits system
-- Replaces the free trial + paper-limit model with a per-user credit balance.
-- New users receive 5 credits (1 credit = 1 paper analysis).
-- Credits are deducted the first time a completed paper is fetched by the user.

-- ── 1. Add credits to users ───────────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN users.credits IS
    'Remaining paper analysis credits. Default 5 for new users. Admin-adjustable.';

-- ── 2. Track whether a credit was consumed for each user_papers row ───────────
ALTER TABLE user_papers
    ADD COLUMN IF NOT EXISTS credit_consumed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_papers.credit_consumed IS
    'True once 1 credit has been deducted for this paper (set on first complete fetch).';

-- ── 3. Feedback table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    name            TEXT        NOT NULL,
    role            TEXT        NOT NULL,        -- student / engineer / researcher / etc.
    organization    TEXT        NOT NULL,
    why_credits     TEXT        NOT NULL,        -- what they liked + why they need more credits
    improvements    TEXT        NOT NULL,        -- what they'd like to see
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_submitted_at_idx ON feedback(submitted_at DESC);
