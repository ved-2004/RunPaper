-- Migration 011: timestamp failed analyses so failed dashboard entries can age out.
--
-- If a database drifted and is missing paper_analyses, do not fail the whole
-- migration chain here. Migration 012 creates/repairs the current runtime schema.

DO $$
BEGIN
    IF to_regclass('public.paper_analyses') IS NOT NULL THEN
        ALTER TABLE paper_analyses
            ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

        UPDATE paper_analyses
        SET failed_at = COALESCE(failed_at, first_processed_at, NOW())
        WHERE status = 'failed';

        CREATE INDEX IF NOT EXISTS paper_analyses_failed_at_idx
            ON paper_analyses(failed_at)
            WHERE status = 'failed';
    END IF;
END $$;
