-- Migration 013: public release data-safety and concurrency hardening.
--
-- The API uses the Supabase service-role key and is the only supported data
-- access path. RLS and grants below prevent accidental browser access through
-- Supabase's generated REST API. RPCs keep deduplication, credits, rerun claims,
-- and failed-run refunds atomic across workers and Cloud Run instances.

-- Server-owned tables must not be readable or writable with public Supabase keys.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'paper_analyses', 'user_papers', 'user_uploads',
        'feedback', 'trials', 'papers', 'schema_migrations'
    ]
    LOOP
        IF to_regclass('public.' || table_name) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Return an existing global analysis or create it. Unique-index races are
-- resolved inside the transaction, and request_count is incremented atomically.
CREATE OR REPLACE FUNCTION get_or_create_paper_analysis(
    p_proposed_analysis_id UUID,
    p_arxiv_id TEXT DEFAULT NULL,
    p_content_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
    result_analysis_id UUID,
    result_status TEXT,
    result_code_scaffold JSONB,
    result_flowchart JSONB,
    result_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_row paper_analyses%ROWTYPE;
    arxiv_row paper_analyses%ROWTYPE;
    hash_row paper_analyses%ROWTYPE;
    loser_row paper_analyses%ROWTYPE;
    has_arxiv BOOLEAN := FALSE;
    has_hash BOOLEAN := FALSE;
BEGIN
    IF p_arxiv_id IS NULL AND p_content_hash IS NULL THEN
        RAISE EXCEPTION 'arxiv_id or content_hash is required';
    END IF;

    IF p_arxiv_id IS NOT NULL THEN
        SELECT pa.* INTO arxiv_row
        FROM paper_analyses pa
        WHERE pa.arxiv_id = p_arxiv_id
        FOR UPDATE;
        has_arxiv := FOUND;
    END IF;

    IF p_content_hash IS NOT NULL THEN
        SELECT pa.* INTO hash_row
        FROM paper_analyses pa
        WHERE pa.content_hash = p_content_hash
        FOR UPDATE;
        has_hash := FOUND;
    END IF;

    -- Older deployments could create one row from an arXiv import and another
    -- from a PDF upload. When a submission supplies both keys, reconcile those
    -- rows and refund any duplicate active user link before continuing.
    IF has_arxiv AND has_hash AND arxiv_row.analysis_id <> hash_row.analysis_id THEN
        IF (CASE hash_row.status
               WHEN 'complete' THEN 3 WHEN 'processing' THEN 2 ELSE 1
           END) > (CASE arxiv_row.status
               WHEN 'complete' THEN 3 WHEN 'processing' THEN 2 ELSE 1
           END) THEN
            found_row := hash_row;
            loser_row := arxiv_row;
        ELSE
            found_row := arxiv_row;
            loser_row := hash_row;
        END IF;

        UPDATE users u
        SET credits = COALESCE(u.credits, 0) + refunds.refund_count
        FROM (
            SELECT losing.user_id, COUNT(*)::INT AS refund_count
            FROM user_papers losing
            WHERE losing.analysis_id = loser_row.analysis_id
              AND losing.deleted_at IS NULL
              AND losing.credit_consumed = TRUE
              AND losing.user_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM user_papers winning
                  WHERE winning.analysis_id = found_row.analysis_id
                    AND winning.user_id = losing.user_id
                    AND winning.deleted_at IS NULL
              )
            GROUP BY losing.user_id
        ) refunds
        WHERE u.id = refunds.user_id;

        UPDATE user_papers losing
        SET deleted_at = now(), credit_consumed = FALSE
        WHERE losing.analysis_id = loser_row.analysis_id
          AND losing.deleted_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM user_papers winning
              WHERE winning.analysis_id = found_row.analysis_id
                AND winning.user_id = losing.user_id
                AND winning.deleted_at IS NULL
          );

        UPDATE user_papers up
        SET analysis_id = found_row.analysis_id
        WHERE up.analysis_id = loser_row.analysis_id;

        DELETE FROM paper_analyses pa
        WHERE pa.analysis_id = loser_row.analysis_id;

        UPDATE paper_analyses pa
        SET arxiv_id = COALESCE(pa.arxiv_id, loser_row.arxiv_id, p_arxiv_id),
            content_hash = COALESCE(pa.content_hash, loser_row.content_hash, p_content_hash),
            title = COALESCE(pa.title, loser_row.title),
            authors_json = COALESCE(pa.authors_json, loser_row.authors_json),
            extraction_json = COALESCE(pa.extraction_json, loser_row.extraction_json),
            code_scaffold_json = COALESCE(pa.code_scaffold_json, loser_row.code_scaffold_json),
            reproducibility_json = COALESCE(pa.reproducibility_json, loser_row.reproducibility_json),
            flowchart_json = COALESCE(pa.flowchart_json, loser_row.flowchart_json),
            notebook_json = COALESCE(pa.notebook_json, loser_row.notebook_json),
            sanity_details_json = COALESCE(pa.sanity_details_json, loser_row.sanity_details_json),
            faq_json = COALESCE(pa.faq_json, loser_row.faq_json),
            request_count = COALESCE(pa.request_count, 0) + COALESCE(loser_row.request_count, 0)
        WHERE pa.analysis_id = found_row.analysis_id
        RETURNING * INTO found_row;
    ELSIF has_arxiv THEN
        found_row := arxiv_row;
        IF p_content_hash IS NOT NULL AND found_row.content_hash IS NULL THEN
            UPDATE paper_analyses pa
            SET content_hash = p_content_hash
            WHERE pa.analysis_id = found_row.analysis_id
            RETURNING * INTO found_row;
        END IF;
    ELSIF has_hash THEN
        found_row := hash_row;
        IF p_arxiv_id IS NOT NULL AND found_row.arxiv_id IS NULL THEN
            UPDATE paper_analyses pa
            SET arxiv_id = p_arxiv_id
            WHERE pa.analysis_id = found_row.analysis_id
            RETURNING * INTO found_row;
        END IF;
    END IF;

    IF has_arxiv OR has_hash THEN
        UPDATE paper_analyses pa
        SET request_count = COALESCE(pa.request_count, 0) + 1
        WHERE pa.analysis_id = found_row.analysis_id;

        RETURN QUERY SELECT
            found_row.analysis_id,
            found_row.status,
            found_row.code_scaffold_json,
            found_row.flowchart_json,
            FALSE;
        RETURN;
    END IF;

    BEGIN
        INSERT INTO paper_analyses (
            analysis_id, arxiv_id, content_hash, status,
            first_processed_at, request_count
        ) VALUES (
            p_proposed_analysis_id, p_arxiv_id, p_content_hash, 'processing',
            now(), 1
        )
        RETURNING * INTO found_row;

        RETURN QUERY SELECT
            found_row.analysis_id,
            found_row.status,
            found_row.code_scaffold_json,
            found_row.flowchart_json,
            TRUE;
        RETURN;
    EXCEPTION WHEN unique_violation THEN
        -- A concurrent transaction inserted the same arXiv ID or hash.
        SELECT pa.* INTO found_row
        FROM paper_analyses pa
        WHERE (p_arxiv_id IS NOT NULL AND pa.arxiv_id = p_arxiv_id)
           OR (p_content_hash IS NOT NULL AND pa.content_hash = p_content_hash)
        ORDER BY (pa.arxiv_id = p_arxiv_id) DESC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE;
        END IF;

        UPDATE paper_analyses pa
        SET request_count = COALESCE(pa.request_count, 0) + 1
        WHERE pa.analysis_id = found_row.analysis_id;

        RETURN QUERY SELECT
            found_row.analysis_id,
            found_row.status,
            found_row.code_scaffold_json,
            found_row.flowchart_json,
            FALSE;
    END;
END;
$$;

-- Create (or reuse) a user's active dashboard link and consume one credit in
-- the same transaction. Repeated requests for the same link are free.
CREATE OR REPLACE FUNCTION link_paper_and_consume_credit(
    p_proposed_paper_id TEXT,
    p_analysis_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    result_paper_id TEXT,
    result_link_created BOOLEAN,
    result_insufficient_credits BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_paper_id TEXT;
    current_credits INT;
BEGIN
    SELECT up.paper_id INTO existing_paper_id
    FROM user_papers up
    WHERE up.user_id = p_user_id
      AND up.analysis_id = p_analysis_id
      AND up.deleted_at IS NULL
    ORDER BY up.added_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RETURN QUERY SELECT existing_paper_id, FALSE, FALSE;
        RETURN;
    END IF;

    SELECT u.credits INTO current_credits
    FROM users u
    WHERE u.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(current_credits, 0) < 1 THEN
        RETURN QUERY SELECT NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    BEGIN
        INSERT INTO user_papers (
            paper_id, user_id, analysis_id, added_at, credit_consumed
        ) VALUES (
            p_proposed_paper_id, p_user_id, p_analysis_id, now(), TRUE
        );
    EXCEPTION WHEN unique_violation THEN
        -- A concurrent request may have created the same active user link.
        SELECT up.paper_id INTO existing_paper_id
        FROM user_papers up
        WHERE up.user_id = p_user_id
          AND up.analysis_id = p_analysis_id
          AND up.deleted_at IS NULL
        ORDER BY up.added_at DESC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT existing_paper_id, FALSE, FALSE;
            RETURN;
        END IF;
        RAISE;
    END;

    UPDATE users u
    SET credits = current_credits - 1
    WHERE u.id = p_user_id;

    RETURN QUERY SELECT p_proposed_paper_id, TRUE, FALSE;
END;
$$;

-- Only the first caller can move a non-processing shared analysis into a new
-- processing run. It also refunds every charged active link to that failed or
-- partial shared result. Concurrent callers cannot duplicate either operation.
CREATE OR REPLACE FUNCTION claim_analysis_rerun(p_analysis_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_status TEXT;
BEGIN
    SELECT pa.status INTO current_status
    FROM paper_analyses pa
    WHERE pa.analysis_id = p_analysis_id
    FOR UPDATE;

    IF NOT FOUND OR current_status = 'processing' THEN
        RETURN FALSE;
    END IF;

    UPDATE users u
    SET credits = COALESCE(u.credits, 0) + refunds.refund_count
    FROM (
        SELECT up.user_id, COUNT(*)::INT AS refund_count
        FROM user_papers up
        WHERE up.analysis_id = p_analysis_id
          AND up.deleted_at IS NULL
          AND up.credit_consumed = TRUE
          AND up.user_id IS NOT NULL
        GROUP BY up.user_id
    ) refunds
    WHERE u.id = refunds.user_id;

    UPDATE user_papers up
    SET credit_consumed = FALSE
    WHERE up.analysis_id = p_analysis_id
      AND up.deleted_at IS NULL
      AND up.credit_consumed = TRUE;

    UPDATE paper_analyses pa
    SET status = 'processing',
        error_message = NULL,
        code_scaffold_json = NULL,
        reproducibility_json = NULL,
        flowchart_json = NULL,
        notebook_json = NULL,
        sanity_status = 'pending',
        sanity_details_json = NULL,
        failed_at = NULL,
        first_processed_at = now()
    WHERE pa.analysis_id = p_analysis_id;

    RETURN TRUE;
END;
$$;

-- Multiple schedulers may call this simultaneously. SKIP LOCKED ensures each
-- failed user link is refunded and hidden once, even across service instances.
CREATE OR REPLACE FUNCTION cleanup_failed_paper_entries(
    p_grace_minutes INT DEFAULT 10
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    link_row RECORD;
    cleaned_count INT := 0;
BEGIN
    FOR link_row IN
        SELECT up.id, up.user_id, up.credit_consumed
        FROM user_papers up
        JOIN paper_analyses pa ON pa.analysis_id = up.analysis_id
        WHERE up.deleted_at IS NULL
          AND pa.status = 'failed'
          AND pa.failed_at <= now() - make_interval(mins => GREATEST(p_grace_minutes, 1))
        FOR UPDATE OF up SKIP LOCKED
    LOOP
        IF link_row.credit_consumed AND link_row.user_id IS NOT NULL THEN
            UPDATE users u
            SET credits = COALESCE(u.credits, 0) + 1
            WHERE u.id = link_row.user_id;
        END IF;

        UPDATE user_papers up
        SET deleted_at = now(), credit_consumed = FALSE
        WHERE up.id = link_row.id;

        cleaned_count := cleaned_count + 1;
    END LOOP;

    RETURN cleaned_count;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_paper_analysis(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION link_paper_and_consume_credit(TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_analysis_rerun(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_failed_paper_entries(INT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION get_or_create_paper_analysis(UUID, TEXT, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION link_paper_and_consume_credit(TEXT, UUID, UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION claim_analysis_rerun(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION cleanup_failed_paper_entries(INT) TO service_role;
    END IF;
END $$;
