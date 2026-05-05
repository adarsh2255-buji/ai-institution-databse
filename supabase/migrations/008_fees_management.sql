-- ================================================================
-- Migration 008 — Fees Management Module
-- Run in Supabase Dashboard → SQL Editor
-- ================================================================

-- Fee Plans (one plan per batch, defines monthly rate)
CREATE TABLE IF NOT EXISTS public.fee_plans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  batch_id       UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  plan_name      TEXT NOT NULL,
  monthly_fee    NUMERIC NOT NULL CHECK (monthly_fee > 0),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active_plan_per_batch UNIQUE (institution_id, batch_id, is_active)
);

-- Fee Payments (actual money received from students)
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  method         TEXT NOT NULL CHECK (method IN ('cash','upi','online','bank_transfer')) DEFAULT 'cash',
  note           TEXT,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Re-use existing fees table as student_fees (monthly dues per student)
-- Add missing columns if needed
ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS fee_plan_id UUID REFERENCES public.fee_plans(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_month ON public.fees(month);
CREATE INDEX IF NOT EXISTS idx_fees_institution ON public.fees(institution_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_institution ON public.fee_payments(institution_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_institution ON public.fee_plans(institution_id);

-- RLS
ALTER TABLE public.fee_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- fee_plans policies
CREATE POLICY "fee_plans_select" ON public.fee_plans
  FOR SELECT USING (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "fee_plans_insert" ON public.fee_plans
  FOR INSERT WITH CHECK (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "fee_plans_update" ON public.fee_plans
  FOR UPDATE USING (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

-- fee_payments policies
CREATE POLICY "fee_payments_select" ON public.fee_payments
  FOR SELECT USING (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "fee_payments_insert" ON public.fee_payments
  FOR INSERT WITH CHECK (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "fee_payments_delete" ON public.fee_payments
  FOR DELETE USING (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
