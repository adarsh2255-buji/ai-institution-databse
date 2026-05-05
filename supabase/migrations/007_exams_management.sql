-- Exam and Marks Management Schema

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    duration TEXT NOT NULL,
    pass_percentage NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate exam
    CONSTRAINT unique_exam UNIQUE (batch_id, name, date)
);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    total_marks NUMERIC NOT NULL CHECK (total_marks > 0),
    
    CONSTRAINT unique_exam_subject UNIQUE (exam_id, subject_name)
);

CREATE TABLE IF NOT EXISTS public.exam_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    grade TEXT NOT NULL,
    min_percentage NUMERIC NOT NULL,
    max_percentage NUMERIC NOT NULL,
    
    CONSTRAINT check_percentages CHECK (min_percentage <= max_percentage)
);

CREATE TABLE IF NOT EXISTS public.marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
    marks_obtained NUMERIC,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent')) DEFAULT 'present',
    grade TEXT,
    
    CONSTRAINT unique_student_subject_mark UNIQUE (exam_id, student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    total_marks NUMERIC,
    total_max_marks NUMERIC,
    percentage NUMERIC,
    result TEXT CHECK (result IN ('pass', 'fail')),
    status TEXT NOT NULL CHECK (status IN ('present', 'absent')) DEFAULT 'present',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_student_exam_result UNIQUE (exam_id, student_id)
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Read policies for institution admins and teachers
CREATE POLICY "Users can view exams for their institution" ON public.exams FOR SELECT USING (institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can view exam_subjects for their institution" ON public.exam_subjects FOR SELECT USING (exam_id IN (SELECT id FROM public.exams WHERE institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid())));
CREATE POLICY "Users can view exam_grades for their institution" ON public.exam_grades FOR SELECT USING (exam_id IN (SELECT id FROM public.exams WHERE institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid())));
CREATE POLICY "Users can view marks for their institution" ON public.marks FOR SELECT USING (exam_id IN (SELECT id FROM public.exams WHERE institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid())));
CREATE POLICY "Users can view exam_results for their institution" ON public.exam_results FOR SELECT USING (exam_id IN (SELECT id FROM public.exams WHERE institution_id IN (SELECT institution_id FROM public.users WHERE id = auth.uid())));
