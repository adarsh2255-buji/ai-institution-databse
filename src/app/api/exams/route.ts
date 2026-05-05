import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET: List Exams ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from('users').select('role, institution_id').eq('id', user.id).single()
    
    if (!caller || !['admin', 'teacher'].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: exams, error } = await supabaseAdmin
      .from('exams')
      .select('*, batches(name)')
      .eq('institution_id', caller.institution_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(exams)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: Create Exam + Subjects + Grades ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from('users').select('role, institution_id').eq('id', user.id).single()
    
    if (!caller || !['admin', 'teacher'].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = await req.json()
    const { batch_id, name, date, duration, pass_percentage, subjects, grades } = payload

    if (!batch_id || !name || !date || !duration || pass_percentage == null) {
      return NextResponse.json({ error: "Missing required exam fields" }, { status: 400 })
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json({ error: "At least one subject is required" }, { status: 400 })
    }

    // Verify batch
    const { data: batch } = await supabaseAdmin
      .from('batches').select('id, institution_id').eq('id', batch_id).single()
    if (!batch || batch.institution_id !== caller.institution_id) {
      return NextResponse.json({ error: "Batch not found or unauthorized" }, { status: 403 })
    }

    // Create Exam
    const { data: exam, error: examErr } = await supabaseAdmin
      .from('exams')
      .insert({
        institution_id: caller.institution_id,
        batch_id,
        name,
        date,
        duration,
        pass_percentage,
        status: 'draft',
        created_by: user.id
      })
      .select('id').single()

    if (examErr || !exam) {
      // Catch unique constraint collision
      if (examErr?.code === '23505') {
        return NextResponse.json({ error: `An exam named "${name}" already exists for this batch on ${date}.` }, { status: 400 })
      }
      return NextResponse.json({ error: examErr?.message || "Failed to create exam" }, { status: 500 })
    }

    // Insert Subjects
    const subjectInserts = subjects.map((sub: any) => ({
      exam_id: exam.id,
      subject_name: sub.name,
      total_marks: sub.total_marks
    }))
    await supabaseAdmin.from('exam_subjects').insert(subjectInserts)

    // Insert Grades (if provided)
    if (Array.isArray(grades) && grades.length > 0) {
      const gradeInserts = grades.map((g: any) => ({
        exam_id: exam.id,
        grade: g.grade,
        min_percentage: g.min,
        max_percentage: g.max
      }))
      await supabaseAdmin.from('exam_grades').insert(gradeInserts)
    }

    return NextResponse.json({ success: true, exam_id: exam.id, message: "Exam created successfully" })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
