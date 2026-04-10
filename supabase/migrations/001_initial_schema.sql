-- ============================================================
-- AI Institution Management — Full Supabase Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- CENTERS (tenants)
create table if not exists centers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

-- USERS → CENTER mapping with roles
create table if not exists center_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  center_id  uuid references centers on delete cascade not null,
  role       text check (role in ('admin','teacher','parent')) not null,
  student_id uuid,   -- populated for parent role: links to their child
  created_at timestamptz default now(),
  unique (user_id, center_id)
);

-- BATCHES / CLASSES
create table if not exists batches (
  id         uuid primary key default gen_random_uuid(),
  center_id  uuid references centers on delete cascade not null,
  name       text not null,
  teacher_id uuid references center_users,
  created_at timestamptz default now()
);

-- STUDENTS
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid references centers on delete cascade not null,
  name        text not null,
  email       text,
  phone       text,
  batch_id    uuid references batches,
  enrolled_at date,
  created_at  timestamptz default now()
);

-- Add FK constraint after students table exists
alter table center_users
  add constraint fk_center_users_student
  foreign key (student_id) references students(id) on delete set null
  not valid;

-- SUBJECTS
create table if not exists subjects (
  id        uuid primary key default gen_random_uuid(),
  center_id uuid references centers on delete cascade not null,
  name      text not null,
  batch_id  uuid references batches,
  created_at timestamptz default now()
);

-- EXAMS
create table if not exists exams (
  id         uuid primary key default gen_random_uuid(),
  center_id  uuid references centers on delete cascade not null,
  subject_id uuid references subjects on delete cascade not null,
  batch_id   uuid references batches on delete cascade not null,
  name       text not null,
  max_marks  numeric not null,
  held_on    date not null,
  created_at timestamptz default now()
);

-- MARKS
create table if not exists marks (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid references centers on delete cascade not null,
  exam_id         uuid references exams on delete cascade not null,
  student_id      uuid references students on delete cascade not null,
  marks_obtained  numeric,
  absent          boolean default false,
  created_at      timestamptz default now(),
  unique (exam_id, student_id)
);

-- ATTENDANCE
create table if not exists attendance (
  id         uuid primary key default gen_random_uuid(),
  center_id  uuid references centers on delete cascade not null,
  batch_id   uuid references batches on delete cascade not null,
  student_id uuid references students on delete cascade not null,
  date       date not null,
  status     text check (status in ('present','absent','late')) not null,
  created_at timestamptz default now(),
  unique (batch_id, student_id, date)
);

-- FEES
create table if not exists fees (
  id           uuid primary key default gen_random_uuid(),
  center_id    uuid references centers on delete cascade not null,
  student_id   uuid references students on delete cascade not null,
  month        text not null,
  amount_due   numeric not null,
  amount_paid  numeric default 0,
  due_date     date,
  paid_on      date,
  status       text check (status in ('paid','partial','pending','overdue')) default 'pending',
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table centers       enable row level security;
alter table center_users  enable row level security;
alter table batches        enable row level security;
alter table students       enable row level security;
alter table subjects       enable row level security;
alter table exams          enable row level security;
alter table marks          enable row level security;
alter table attendance     enable row level security;
alter table fees           enable row level security;

-- Helper function: get caller's center_id
create or replace function get_my_center_id()
returns uuid language sql security definer stable as $$
  select center_id from center_users where user_id = auth.uid() limit 1;
$$;

-- Helper function: get caller's role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from center_users where user_id = auth.uid() limit 1;
$$;

-- Helper function: get parent's linked student_id
create or replace function get_my_student_id()
returns uuid language sql security definer stable as $$
  select student_id from center_users where user_id = auth.uid() and role = 'parent' limit 1;
$$;

-- Centers: users can read their own center
create policy "centers_select" on centers
  for select using (id = get_my_center_id());

-- Center users: can see members of own center
create policy "center_users_select" on center_users
  for select using (center_id = get_my_center_id());
create policy "center_users_insert" on center_users
  for insert with check (center_id = get_my_center_id() and get_my_role() = 'admin');

-- Batches
create policy "batches_select" on batches
  for select using (center_id = get_my_center_id());
create policy "batches_insert" on batches
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "batches_update" on batches
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "batches_delete" on batches
  for delete using (center_id = get_my_center_id() and get_my_role() = 'admin');

-- Students
create policy "students_select" on students
  for select using (
    center_id = get_my_center_id() and (
      get_my_role() in ('admin','teacher') or
      id = get_my_student_id()
    )
  );
create policy "students_insert" on students
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "students_update" on students
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "students_delete" on students
  for delete using (center_id = get_my_center_id() and get_my_role() = 'admin');

-- Subjects
create policy "subjects_select" on subjects
  for select using (center_id = get_my_center_id());
create policy "subjects_insert" on subjects
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "subjects_update" on subjects
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "subjects_delete" on subjects
  for delete using (center_id = get_my_center_id() and get_my_role() = 'admin');

-- Exams
create policy "exams_select" on exams
  for select using (center_id = get_my_center_id());
create policy "exams_insert" on exams
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "exams_update" on exams
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "exams_delete" on exams
  for delete using (center_id = get_my_center_id() and get_my_role() = 'admin');

-- Marks
create policy "marks_select" on marks
  for select using (
    center_id = get_my_center_id() and (
      get_my_role() in ('admin','teacher') or
      student_id = get_my_student_id()
    )
  );
create policy "marks_insert" on marks
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "marks_update" on marks
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "marks_delete" on marks
  for delete using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));

-- Attendance
create policy "attendance_select" on attendance
  for select using (
    center_id = get_my_center_id() and (
      get_my_role() in ('admin','teacher') or
      student_id = get_my_student_id()
    )
  );
create policy "attendance_insert" on attendance
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "attendance_update" on attendance
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "attendance_delete" on attendance
  for delete using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));

-- Fees
create policy "fees_select" on fees
  for select using (
    center_id = get_my_center_id() and (
      get_my_role() in ('admin','teacher') or
      student_id = get_my_student_id()
    )
  );
create policy "fees_insert" on fees
  for insert with check (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "fees_update" on fees
  for update using (center_id = get_my_center_id() and get_my_role() in ('admin','teacher'));
create policy "fees_delete" on fees
  for delete using (center_id = get_my_center_id() and get_my_role() = 'admin');
