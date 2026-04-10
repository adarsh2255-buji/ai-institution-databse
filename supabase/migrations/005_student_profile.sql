-- ================================================================
-- Migration 005 — Student Profile & Password Change flags
-- Run in Supabase Dashboard → SQL Editor
-- ================================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS medium            text CHECK (medium IN ('English','Malayalam','CBSE','ICSE')),
  ADD COLUMN IF NOT EXISTS photo_url         text,
  ADD COLUMN IF NOT EXISTS gender            text CHECK (gender IN ('Male','Female','Other')),
  ADD COLUMN IF NOT EXISTS school_name       text,
  ADD COLUMN IF NOT EXISTS father_name       text,
  ADD COLUMN IF NOT EXISTS mother_name       text,
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS whatsapp_number   text,
  ADD COLUMN IF NOT EXISTS password_changed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Supabase Storage bucket for student photos
-- Go to Supabase → Storage → Create bucket named: student-photos
-- Set to PUBLIC so photos are accessible without auth
-- Then run:
INSERT INTO storage.buckets (id, name, public)
  VALUES ('student-photos', 'student-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS: students can upload to their own folder
CREATE POLICY IF NOT EXISTS "student_photo_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'student-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "student_photo_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'student-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY IF NOT EXISTS "student_photo_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');
