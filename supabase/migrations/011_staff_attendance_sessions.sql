-- ============================================================
-- AI Institution Management — Staff Attendance Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Update users table role constraint to include 'staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role in ('owner', 'admin', 'teacher', 'staff', 'parent'));

-- 2. Create staff_attendance_sessions table
CREATE TABLE IF NOT EXISTS staff_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  check_in_time timestamptz NOT NULL,
  check_out_time timestamptz,
  duration float, -- Duration in hours
  created_at timestamptz DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_staff_attendance_sessions_user_date ON staff_attendance_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_sessions_inst_date ON staff_attendance_sessions(institution_id, date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE staff_attendance_sessions ENABLE ROW LEVEL SECURITY;

-- 1. Admin/Owner can view all attendance for their institution
CREATE POLICY "Admins and Owners can view all attendance in their institution" 
ON staff_attendance_sessions FOR SELECT 
USING (
  institution_id IN (
    SELECT institution_id FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- 2. Staff and Teachers can view their own attendance
CREATE POLICY "Staff and Teachers can view own attendance" 
ON staff_attendance_sessions FOR SELECT 
USING (
  user_id = auth.uid()
);

-- 3. Admins can insert/update/delete records
CREATE POLICY "Admins can manage attendance records" 
ON staff_attendance_sessions FOR ALL 
USING (
  institution_id IN (
    SELECT institution_id FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Staff and Teachers can insert (check-in) their own records
CREATE POLICY "Staff and Teachers can insert own records" 
ON staff_attendance_sessions FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  institution_id IN (
    SELECT institution_id FROM users 
    WHERE id = auth.uid() AND role IN ('teacher', 'staff')
  )
);

-- 5. Staff and Teachers can update (check-out) their own records
CREATE POLICY "Staff and Teachers can update own records" 
ON staff_attendance_sessions FOR UPDATE 
USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);
