-- Migration 009 — Academic Year on Fee Plans
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.fee_plans
  ADD COLUMN IF NOT EXISTS year_start TEXT, -- YYYY-MM e.g. '2025-06'
  ADD COLUMN IF NOT EXISTS year_end   TEXT; -- YYYY-MM e.g. '2026-03'

-- Add joined_at to students if not already present (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'joined_at'
  ) THEN
    ALTER TABLE public.students ADD COLUMN joined_at DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
