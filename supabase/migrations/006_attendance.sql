-- Attendance Management Schema

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    session TEXT NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening', 'night')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    marked_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate sessions for same batch, date, and part of day
    CONSTRAINT unique_attendance_session UNIQUE (batch_id, date, session)
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status = 'absent') DEFAULT 'absent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We only store absent students. Total present is derived dynamically by counting total students in the batch minus those in the attendance_records for the session.

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- We rely on the backend API with the Service Role key to insert and update these records securely.
-- RLS policies for read access (Teachers and Admins) to view attendance.
CREATE POLICY "Users can view attendance sessions for their institution"
    ON public.attendance_sessions
    FOR SELECT
    USING (
        institution_id IN (
            SELECT institution_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view attendance records for their institution"
    ON public.attendance_records
    FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM public.attendance_sessions
            WHERE institution_id IN (
                SELECT institution_id FROM public.users WHERE id = auth.uid()
            )
        )
    );

-- Add 'joined_at' functionality for students to accurately calculate possible attended days.
-- If joined_at already exists, this does nothing.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'joined_at') THEN
        ALTER TABLE public.students Add COLUMN joined_at DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;
