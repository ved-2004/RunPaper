-- Migration 010: prevent duplicate active dashboard rows for the same user/paper.
--
-- user_papers can have many users linked to one paper_analyses row, but one user
-- should only have one active link to a given analysis. Keep the newest duplicate
-- link active and soft-delete older active duplicates before adding the guardrail.
--
-- If a database drifted and is missing user_papers, do not fail here. Migration
-- 012 creates/repairs the current runtime schema and adds the same guardrail.

DO $$
BEGIN
    IF to_regclass('public.user_papers') IS NOT NULL THEN
        WITH ranked AS (
            SELECT
                paper_id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, analysis_id
                    ORDER BY added_at DESC, paper_id DESC
                ) AS rn
            FROM user_papers
            WHERE deleted_at IS NULL
              AND user_id IS NOT NULL
              AND analysis_id IS NOT NULL
        )
        UPDATE user_papers AS up
        SET deleted_at = NOW()
        FROM ranked
        WHERE up.paper_id = ranked.paper_id
          AND ranked.rn > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS user_papers_one_active_analysis_per_user_idx
            ON user_papers(user_id, analysis_id)
            WHERE deleted_at IS NULL
              AND user_id IS NOT NULL
              AND analysis_id IS NOT NULL;
    END IF;
END $$;
