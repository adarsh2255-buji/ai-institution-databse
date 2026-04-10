-- ================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Adds student registration support to the students table
-- ================================================================

-- 0. Fix users.status to allow 'pending' (required for student approval flow)
--    The original schema only had 'active' and 'suspended'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'pending'));

-- 1. Extend users.role to include 'student'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner','admin','teacher','parent','student'));

-- 2. Add student-specific columns to students table
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registration_no text,
  ADD COLUMN IF NOT EXISTS dob            date,
  ADD COLUMN IF NOT EXISTS status         text
    CHECK (status IN ('pending','active','suspended'))
    DEFAULT 'pending';

-- 3. Unique registration number per institution (prevents duplicates)
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS uq_reg_no_per_inst;
ALTER TABLE students
  ADD CONSTRAINT uq_reg_no_per_inst
  UNIQUE (institution_id, registration_no);

-- Verify it worked
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;
