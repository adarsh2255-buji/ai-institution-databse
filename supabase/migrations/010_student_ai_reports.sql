-- Migration 010: Student AI Reports table
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.student_ai_reports (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  summary         TEXT NOT NULL,
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  strengths       JSONB NOT NULL DEFAULT '[]',
  weaknesses      JSONB NOT NULL DEFAULT '[]',
  suggestions     JSONB NOT NULL DEFAULT '[]',
  raw_metrics     JSONB NOT NULL DEFAULT '{}',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id)
);

ALTER TABLE public.student_ai_reports ENABLE ROW LEVEL SECURITY;

-- Service role has full access; authenticated users can read reports in their institution
CREATE POLICY "service_role_all" ON public.student_ai_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON public.student_ai_reports
  FOR SELECT TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM public.users WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS student_ai_reports_student_idx ON public.student_ai_reports (student_id);
CREATE INDEX IF NOT EXISTS student_ai_reports_institution_idx ON public.student_ai_reports (institution_id);

NOTIFY pgrst, 'reload schema';
