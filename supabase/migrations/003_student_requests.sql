-- ============================================================
-- Migration 003 — Student Enrollment Requests
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists student_requests (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  student_name   text not null,
  parent_name    text not null,
  parent_email   text not null,
  parent_phone   text not null,
  batch_name     text,          -- desired batch (text, not FK — batch may not exist yet)
  date_of_birth  date,
  message        text,          -- any note from the parent
  status         text check (status in ('pending','approved','rejected')) default 'pending',
  reviewed_by    uuid references users on delete set null,
  reviewed_at    timestamptz,
  student_id     uuid references students on delete set null, -- set after approval
  created_at     timestamptz default now()
);

alter table student_requests enable row level security;

-- Admins/owners of the institution can read & update requests
create policy "req_select" on student_requests
  for select using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

create policy "req_update" on student_requests
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- Anyone can insert (public enrollment form — insert done via service role in API)
-- No public insert policy needed because we use service role in the API route
