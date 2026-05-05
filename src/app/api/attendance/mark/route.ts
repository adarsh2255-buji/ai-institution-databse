import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { batch_id, date, session, start_time, end_time, absent_student_ids } = await req.json()

    if (!batch_id || !date || !session || !start_time || !end_time || !Array.isArray(absent_student_ids)) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 })
    }

    const validSessions = ['morning', 'afternoon', 'evening', 'night']
    if (!validSessions.includes(session)) {
      return NextResponse.json({ error: "Invalid session type" }, { status: 400 })
    }

    if (start_time >= end_time) {
      return NextResponse.json({ error: "Start time must be before end time" }, { status: 400 })
    }

    // ── 1. Validate User Role ────────────────────
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'teacher'].includes(userRecord.role)) {
      return NextResponse.json({ error: "Forbidden: Only admins and teachers can mark attendance" }, { status: 403 })
    }

    const institutionId = userRecord.institution_id

    // ── 2. Validate Batch ────────────────────
    const { data: batch } = await supabaseAdmin
      .from('batches')
      .select('id, institution_id')
      .eq('id', batch_id)
      .single()

    if (!batch || batch.institution_id !== institutionId) {
      return NextResponse.json({ error: "Batch not found or unauthorized" }, { status: 403 })
    }

    // ── 3. Validate Students ────────────────────
    const { data: batchStudents } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('batch_id', batch_id)
      .eq('status', 'active')

    if (!batchStudents || batchStudents.length === 0) {
      return NextResponse.json({ error: "Cannot mark attendance for an empty batch" }, { status: 400 })
    }

    const validStudentIds = batchStudents.map(bs => bs.id)

    for (const id of absent_student_ids) {
      if (!validStudentIds.includes(id)) {
        return NextResponse.json({ error: `Student ID ${id} does not belong to this batch` }, { status: 400 })
      }
    }

    // ── 4. Strict Duplicate Check ────────────────────
    const { data: existingSession } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id')
      .eq('batch_id', batch_id)
      .eq('date', date)
      .eq('session', session)
      .maybeSingle()

    if (existingSession) {
      // Strict duplicate — do NOT allow editing via this endpoint
      return NextResponse.json({
        error: `Attendance for this batch, date, and session has already been recorded.`
      }, { status: 409 })
    }

    // ── 5. Create Session ────────────────────
    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('attendance_sessions')
      .insert({
        institution_id: institutionId,
        batch_id,
        date,
        session,
        start_time,
        end_time,
        marked_by: user.id
      })
      .select('id')
      .single()

    if (sessionError || !newSession) {
      console.error("Failed to create attendance session:", sessionError)
      return NextResponse.json({ error: "Failed to save attendance session" }, { status: 500 })
    }

    // ── 6. Insert Absent Records ────────────────────
    if (absent_student_ids.length > 0) {
      const recordsToInsert = absent_student_ids.map((studentId: string) => ({
        session_id: newSession.id,
        student_id: studentId,
        status: 'absent'
      }))

      const { error: recordsError } = await supabaseAdmin
        .from('attendance_records')
        .insert(recordsToInsert)

      if (recordsError) {
        console.error("Failed to insert attendance records:", recordsError)
        return NextResponse.json({ error: "Failed to save absentees." }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Attendance marked successfully"
    })

  } catch (error) {
    console.error("Attendance mark API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
