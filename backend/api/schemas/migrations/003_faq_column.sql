-- Migration 003: Add faq_json column to papers table
-- Stores 5 pre-generated Q&A pairs generated at upload time.
-- Run with: python -m api.scripts.migrate

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS faq_json jsonb;
