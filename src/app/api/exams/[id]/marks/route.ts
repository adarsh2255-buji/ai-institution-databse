import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper: Calculate grade based on percentage
function calculateGrade(percentage: number, gradesRules: any[]) {
  // If no grading system is set, return null
  if (!gradesRules || gradesRules.length === 0) return null
  
  for (const rule of gradesRules) {
    if (percentage >= rule.min_percentage && percentage <= rule.max_percentage) {
      return rule.grade
    }
  }
  return null // Lowest fallback can be defined later if not covered
}

// ── GET: Fetch structural data for exam entry table ────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    // Fetch Exam securely
    const { data: exam, error: examError } = await supabaseAdmin.from('exams').select('*').eq('id', id).single()
    if (examError) console.error('Exam fetch error:', examError.message)
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })

    // Fetch subjects & grades
    const { data: subjects } = await supabaseAdmin.from('exam_subjects').select('*').eq('exam_id', id)
    const { data: grades } = await supabaseAdmin.from('exam_grades').select('*').eq('exam_id', id).order('min_percentage', { ascending: false })
    
    // Fetch students in batch
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, registration_no, status')
      .eq('batch_id', exam.batch_id)
      .eq('status', 'active')
      .order('name')

    // Fetch existing drafted marks
    const { data: marks } = await supabaseAdmin.from('marks').select('*').eq('exam_id', id)
    
    // Fetch results (if published)
    const { data: results } = await supabaseAdmin.from('exam_results').select('*').eq('exam_id', id)

    return NextResponse.json({
      exam,
      subjects: subjects || [],
      grades: grades || [],
      students: students || [],
      marks: marks || [],
      results: results || []
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: Save Draft OR Final Submit ────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Parse URL params for action
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'draft' // 'draft' | 'submit'

    const payload = await req.json()
    const marksData = payload.marks || []

    const { data: exam } = await supabaseAdmin.from('exams').select('*').eq('id', id).single()
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })

    if (exam.status === 'published') {
      return NextResponse.json({ error: "This exam has already been published. Marks cannot be edited." }, { status: 400 })
    }

    const { data: subjects } = await supabaseAdmin.from('exam_subjects').select('*').eq('exam_id', id)
    const { data: grades } = await supabaseAdmin.from('exam_grades').select('*').eq('exam_id', id).order('min_percentage', { ascending: false })
    const { data: students } = await supabaseAdmin.from('students').select('id').eq('batch_id', exam.batch_id).eq('status', 'active')

    // Prepare Map to cross-validate marks against total limits
    const subjectMap = new Map((subjects || []).map(s => [s.id, s.total_marks]))
    const studentSet = new Set((students || []).map(s => s.id))

    // 1. Process draft inserts/updates
    const upsertPayload = []
    
    for (const m of marksData) {
       // Validate basics
       if (!studentSet.has(m.student_id)) continue;
       if (!subjectMap.has(m.subject_id)) continue;

       const subTotal = subjectMap.get(m.subject_id)
       let marksObtained = m.marks_obtained
       let status = m.status || 'present'
       let grade = null
       
       if (status === 'absent') {
         marksObtained = 0
         // Logic lowest grade later during calculation
       } else {
         if (marksObtained > subTotal) {
           return NextResponse.json({ error: `Marks obtained cannot exceed total marks (${subTotal}) for subject.` }, { status: 400 })
         }
         if (grades && grades.length > 0) {
           const percentage = (marksObtained / subTotal) * 100
           grade = calculateGrade(percentage, grades)
         }
       }

       upsertPayload.push({
         exam_id: exam.id,
         student_id: m.student_id,
         subject_id: m.subject_id,
         marks_obtained: marksObtained,
         status,
         grade
       })
    }

    // Force UPSERT into marks table safely
    if (upsertPayload.length > 0) {
      const { error: upsertErr } = await supabaseAdmin.from('marks').upsert(upsertPayload, { onConflict: 'exam_id,student_id,subject_id' })
      if (upsertErr) console.error('Marks upsert error:', upsertErr.message)
    }

    // 2. Final Submit Logic 
    if (action === 'submit') {
       // Verify no missing marks
       const { data: allMarks } = await supabaseAdmin.from('marks').select('*').eq('exam_id', id)
       
       // Build dynamic hash to check coverage
       const coverage = new Map() // student_id -> Set of subject_ids
       allMarks?.forEach(m => {
          if (!coverage.has(m.student_id)) coverage.set(m.student_id, new Set())
          coverage.get(m.student_id).add(m.subject_id)
       })

       for (const st of (students || [])) {
         const studentCoverage = coverage.get(st.id)
         if (!studentCoverage || studentCoverage.size < (subjects?.length || 0)) {
           return NextResponse.json({ error: `Missing marks for student ID: ${st.id}. Cannot submit final.` }, { status: 400 })
         }
       }

       // Generate Results Snapshot
       const resultsPayload = []
       for (const st of (students || [])) {
          const studentMarks = allMarks?.filter(x => x.student_id === st.id) || []
          
          const isFullyAbsent = studentMarks.every(x => x.status === 'absent')
          if (isFullyAbsent) {
            resultsPayload.push({
              exam_id: exam.id,
              student_id: st.id,
              total_marks: null,
              total_max_marks: null,
              percentage: null,
              result: null,
              status: 'absent'
            })
            continue;
          }

          let obtainedSum = 0
          let maxSum = 0
          let hasFailedSubject = false

          for (const sm of studentMarks) {
             const maxMarks = subjectMap.get(sm.subject_id) || 0
             maxSum += maxMarks
             
             if (sm.status === 'absent') {
               hasFailedSubject = true // absent automatic zero and usually fail
               continue;
             }
             
             obtainedSum += Number(sm.marks_obtained || 0)
             const subPercent = (Number(sm.marks_obtained || 0) / maxMarks) * 100
             if (subPercent < exam.pass_percentage) hasFailedSubject = true
          }

          const percentage = (obtainedSum / maxSum) * 100
          resultsPayload.push({
            exam_id: exam.id,
            student_id: st.id,
            total_marks: obtainedSum,
            total_max_marks: maxSum,
            percentage,
            result: hasFailedSubject ? 'fail' : 'pass',
            status: 'present'
          })
       }

       if (resultsPayload.length > 0) {
          await supabaseAdmin.from('exam_results').upsert(resultsPayload, { onConflict: 'exam_id,student_id' })
       }

       // Mark exam as published
       await supabaseAdmin.from('exams').update({ status: 'published' }).eq('id', id)
    }

    return NextResponse.json({ success: true, message: action === 'submit' ? "Exam published successfully" : "Draft saved successfully" })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
