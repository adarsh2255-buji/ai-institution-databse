import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ─────────────────────────────────────────────────────────
   Generates an array of YYYY-MM strings between start/end
   e.g. rangeMonths("2025-06", "2026-03") →
        ["2025-06","2025-07",...,"2026-03"]
───────────────────────────────────────────────────────── */
function rangeMonths(start: string, end: string): string[] {
  const result: string[] = []
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

/* Returns the later of two YYYY-MM strings */
function laterMonth(a: string, b: string) {
  return a >= b ? a : b
}

/* ─────────────────────────────────────────────────────────
   POST /api/admin/fee-plans/generate-dues
   Body: { fee_plan_id }
   Uses plan's year_start/year_end + student's joined_at
   to auto-calculate each student's personal months.
   Falls back to manual months[] if no year set on plan.
───────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('id, role, institution_id').eq('id', user.id).single()
    if (!userRecord || userRecord.role !== 'admin')
      return NextResponse.json({ error: "Only admins can generate dues" }, { status: 403 })

    const body = await req.json()
    const { fee_plan_id, months: manualMonths } = body   // manualMonths is fallback

    if (!fee_plan_id)
      return NextResponse.json({ error: "fee_plan_id required" }, { status: 400 })

    // Validate plan belongs to institution
    const { data: plan } = await supabaseAdmin
      .from('fee_plans').select('*')
      .eq('id', fee_plan_id)
      .eq('institution_id', userRecord.institution_id)
      .single()

    if (!plan) return NextResponse.json({ error: "Fee plan not found" }, { status: 404 })

    // Get students in the plan's batch (with joined_at)
    let studentQuery = supabaseAdmin
      .from('students')
      .select('id, joined_at')
      .eq('institution_id', userRecord.institution_id)
    if (plan.batch_id) studentQuery = studentQuery.eq('batch_id', plan.batch_id)

    const { data: students } = await studentQuery
    if (!students || students.length === 0)
      return NextResponse.json({ error: "No students found for this batch" }, { status: 400 })

    const hasAcademicYear = plan.year_start && plan.year_end
    const allMonthsForPlan = hasAcademicYear
      ? rangeMonths(plan.year_start, plan.year_end)
      : (Array.isArray(manualMonths) && manualMonths.length > 0
          ? manualMonths
          : null)

    if (!allMonthsForPlan)
      return NextResponse.json({ error: "Provide months[] or set year_start/year_end on plan" }, { status: 400 })

    const records: any[] = []
    let totalMonthsGenerated = 0

    for (const student of students) {
      let studentMonths: string[]

      if (hasAcademicYear && student.joined_at) {
        // Student's joining month (YYYY-MM)
        const joinedMonth = (student.joined_at as string).slice(0, 7)
        // Effective start = later of joined_month or year_start
        const effectiveStart = laterMonth(joinedMonth, plan.year_start)
        studentMonths = rangeMonths(effectiveStart, plan.year_end)
      } else {
        // Fallback: use the same months for everyone
        studentMonths = allMonthsForPlan
      }

      totalMonthsGenerated += studentMonths.length

      for (const month of studentMonths) {
        records.push({
          institution_id: userRecord.institution_id,
          student_id: student.id,
          month,
          amount_due: plan.monthly_fee,
          amount_paid: 0,
          status: 'pending',
          fee_plan_id: plan.id,
        })
      }
    }

    if (records.length === 0)
      return NextResponse.json({ error: "No fee records to generate (check joining dates)" }, { status: 400 })

    // Upsert — skip if already exists
    const { error: insertErr } = await supabaseAdmin
      .from('fees')
      .upsert(records, { onConflict: 'student_id,month', ignoreDuplicates: true })

    if (insertErr) {
      console.error('Generate dues error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Generated dues for ${students.length} student(s) — ${totalMonthsGenerated} total fee records`,
      students: students.length,
      total_records: totalMonthsGenerated,
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
