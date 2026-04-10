-- ============================================================
-- AI Institution Management — Schema v2 (Full Redesign)
-- Run this in your Supabase SQL Editor (fresh database)
-- ============================================================

-- ============================================================
-- CORE TABLES
-- ============================================================

-- INSTITUTIONS (tenants)
create table if not exists institutions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  location   text,
  phone      text,
  status     text check (status in ('pending','active','suspended')) default 'pending',
  plan_type  text check (plan_type in ('trial','basic','premium')) default 'trial',
  created_at timestamptz default now()
);

-- PLATFORM ADMINS (superusers – not tenants)
create table if not exists platform_admins (
  id         uuid primary key references auth.users on delete cascade,
  email      text unique not null,
  created_at timestamptz default now()
);

-- USERS (institution members)
create table if not exists users (
  id             uuid primary key references auth.users on delete cascade,
  institution_id uuid references institutions on delete cascade not null,
  role           text check (role in ('owner','admin','teacher','parent')) not null,
  name           text not null,
  email          text not null,
  status         text check (status in ('active','suspended')) default 'active',
  student_id     uuid,   -- populated for parent role: links to their child
  created_at     timestamptz default now()
);

-- BATCHES / CLASSES
create table if not exists batches (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  name           text not null,
  teacher_id     uuid references users,
  created_at     timestamptz default now()
);

-- STUDENTS
create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  name           text not null,
  email          text,
  phone          text,
  batch_id       uuid references batches,
  enrolled_at    date,
  created_at     timestamptz default now()
);

-- Add FK: parent → their child student
alter table users
  add constraint fk_users_student
  foreign key (student_id) references students(id) on delete set null
  not valid;

-- SUBJECTS
create table if not exists subjects (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  name           text not null,
  batch_id       uuid references batches,
  created_at     timestamptz default now()
);

-- EXAMS
create table if not exists exams (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  subject_id     uuid references subjects on delete cascade not null,
  batch_id       uuid references batches on delete cascade not null,
  name           text not null,
  max_marks      numeric not null,
  held_on        date not null,
  created_at     timestamptz default now()
);

-- MARKS
create table if not exists marks (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  exam_id        uuid references exams on delete cascade not null,
  student_id     uuid references students on delete cascade not null,
  marks_obtained numeric,
  absent         boolean default false,
  created_at     timestamptz default now(),
  unique (exam_id, student_id)
);

-- ATTENDANCE
create table if not exists attendance (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  batch_id       uuid references batches on delete cascade not null,
  student_id     uuid references students on delete cascade not null,
  date           date not null,
  status         text check (status in ('present','absent','late')) not null,
  created_at     timestamptz default now(),
  unique (batch_id, student_id, date)
);

-- FEES
create table if not exists fees (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions on delete cascade not null,
  student_id     uuid references students on delete cascade not null,
  month          text not null,
  amount_due     numeric not null,
  amount_paid    numeric default 0,
  due_date       date,
  paid_on        date,
  status         text check (status in ('paid','partial','pending','overdue')) default 'pending',
  created_at     timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table institutions   enable row level security;
alter table platform_admins enable row level security;
alter table users           enable row level security;
alter table batches         enable row level security;
alter table students        enable row level security;
alter table subjects        enable row level security;
alter table exams           enable row level security;
alter table marks           enable row level security;
alter table attendance      enable row level security;
alter table fees            enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (security definer — runs as superuser)
-- ============================================================

-- Get caller's institution_id
create or replace function get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id from users where id = auth.uid() limit 1;
$$;

-- Get caller's role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from users where id = auth.uid() limit 1;
$$;

-- Get parent's linked student_id
create or replace function get_my_student_id()
returns uuid language sql security definer stable as $$
  select student_id from users where id = auth.uid() and role = 'parent' limit 1;
$$;

-- Check if current user is a platform admin
create or replace function is_platform_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from platform_admins where id = auth.uid());
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Institutions: members can read their own
create policy "inst_select_own" on institutions
  for select using (
    id = get_my_institution_id() or is_platform_admin()
  );

-- Platform admins can update institutions (for approval)
create policy "inst_update_admin" on institutions
  for update using (is_platform_admin());

-- Platform admins
create policy "platform_admins_self" on platform_admins
  for select using (id = auth.uid());

-- Users: see members of your institution
create policy "users_select" on users
  for select using (institution_id = get_my_institution_id() or is_platform_admin());
create policy "users_insert" on users
  for insert with check (
    institution_id = get_my_institution_id() and get_my_role() in ('owner','admin')
  );
create policy "users_update" on users
  for update using (
    institution_id = get_my_institution_id() and get_my_role() in ('owner','admin')
  );

-- Batches
create policy "batches_select" on batches
  for select using (institution_id = get_my_institution_id());
create policy "batches_insert" on batches
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "batches_update" on batches
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "batches_delete" on batches
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- Students
create policy "students_select" on students
  for select using (
    institution_id = get_my_institution_id() and (
      get_my_role() in ('owner','admin','teacher') or id = get_my_student_id()
    )
  );
create policy "students_insert" on students
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "students_update" on students
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "students_delete" on students
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- Subjects
create policy "subjects_select" on subjects
  for select using (institution_id = get_my_institution_id());
create policy "subjects_insert" on subjects
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "subjects_update" on subjects
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "subjects_delete" on subjects
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- Exams
create policy "exams_select" on exams
  for select using (institution_id = get_my_institution_id());
create policy "exams_insert" on exams
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "exams_update" on exams
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "exams_delete" on exams
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- Marks
create policy "marks_select" on marks
  for select using (
    institution_id = get_my_institution_id() and (
      get_my_role() in ('owner','admin','teacher') or student_id = get_my_student_id()
    )
  );
create policy "marks_insert" on marks
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "marks_update" on marks
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "marks_delete" on marks
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));

-- Attendance
create policy "attendance_select" on attendance
  for select using (
    institution_id = get_my_institution_id() and (
      get_my_role() in ('owner','admin','teacher') or student_id = get_my_student_id()
    )
  );
create policy "attendance_insert" on attendance
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "attendance_update" on attendance
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "attendance_delete" on attendance
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));

-- Fees
create policy "fees_select" on fees
  for select using (
    institution_id = get_my_institution_id() and (
      get_my_role() in ('owner','admin','teacher') or student_id = get_my_student_id()
    )
  );
create policy "fees_insert" on fees
  for insert with check (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "fees_update" on fees
  for update using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin','teacher'));
create policy "fees_delete" on fees
  for delete using (institution_id = get_my_institution_id() and get_my_role() in ('owner','admin'));

-- ============================================================
-- PLATFORM ADMIN SEED (replace with your actual admin email after setup)
-- INSERT INTO platform_admins (id, email) VALUES ('<auth.user.id>', 'admin@yourdomain.com');
-- ============================================================
