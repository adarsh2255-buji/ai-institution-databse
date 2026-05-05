import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Shared auth helper
async function getAdminUser(req?: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRecord } = await supabaseAdmin
    .from('users').select('id, role, institution_id').eq('id', user.id).single()

  if (!userRecord || !['admin', 'owner', 'teacher'].includes(userRecord.role)) return null
  return userRecord
}

// ── GET /api/admin/fees — Overview of all students' fee status ──
export async function GET(req: NextRequest) {
  try {
    const userRecord = await getAdminUser()
    if (!userRecord) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // 'pending' | 'partial' | 'paid' | null
    const batchFilter = searchParams.get('batch_id')

    // Fetch all students with their fee summaries
    let studentQuery = supabaseAdmin
      .from('students')
      .select('id, name, registration_no, batch_id, batches(name)')
      .eq('institution_id', userRecord.institution_id)
      .order('name')

    if (batchFilter) studentQuery = studentQuery.eq('batch_id', batchFilter)

    const { data: students } = await studentQuery

    if (!students || students.length === 0) {
      return NextResponse.json({ students: [], summary: { total_due: 0, total_paid: 0, total_balance: 0 } })
    }

    const studentIds = students.map(s => s.id)

    // Fetch all fee records for these students
    const { data: feeRecords } = await supabaseAdmin
      .from('fees')
      .select('student_id, amount_due, amount_paid, status, month')
      .in('student_id', studentIds)
      .eq('institution_id', userRecord.institution_id)

    // Fetch all payments for these students
    const { data: payments } = await supabaseAdmin
      .from('fee_payments')
      .select('student_id, amount, date, method, note, id')
      .in('student_id', studentIds)
      .eq('institution_id', userRecord.institution_id)
      .order('date', { ascending: false })

    // Aggregate per student
    const feeMap: Record<string, { total_due: number; total_paid: number; months: any[] }> = {}
    for (const f of (feeRecords || [])) {
      if (!feeMap[f.student_id]) feeMap[f.student_id] = { total_due: 0, total_paid: 0, months: [] }
      feeMap[f.student_id].total_due += Number(f.amount_due)
      feeMap[f.student_id].total_paid += Number(f.amount_paid)
      feeMap[f.student_id].months.push(f)
    }

    const paymentMap: Record<string, number> = {}
    for (const p of (payments || [])) {
      paymentMap[p.student_id] = (paymentMap[p.student_id] || 0) + Number(p.amount)
    }

    let result = students.map(s => {
      const fees = feeMap[s.id] || { total_due: 0, total_paid: 0, months: [] }
      const actualPaid = paymentMap[s.id] || 0  // actual money received
      const balance = actualPaid - fees.total_due // positive = advance, negative = owes
      const pendingMonths = fees.months.filter(m => m.status !== 'paid').length
      const overallStatus = fees.total_due === 0
        ? (actualPaid > 0 ? 'advance' : 'no_dues')
        : actualPaid >= fees.total_due ? 'paid'
        : actualPaid > 0 ? 'partial' : 'pending'

      return {
        id: s.id,
        name: s.name,
        registration_no: s.registration_no,
        batch_name: (s as any).batches?.name,
        total_due: fees.total_due,
        total_paid: actualPaid,
        balance,
        pending_months: pendingMonths,
        status: overallStatus,
      }
    })

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter)
    }

    const summary = result.reduce((acc, s) => ({
      total_due: acc.total_due + s.total_due,
      total_paid: acc.total_paid + s.total_paid,
      total_balance: acc.total_balance + s.balance,
    }), { total_due: 0, total_paid: 0, total_balance: 0 })

    // Fetch fee plans
    const { data: feePlans } = await supabaseAdmin
      .from('fee_plans')
      .select('*, batches(name)')
      .eq('institution_id', userRecord.institution_id)
      .eq('is_active', true)

    // Fetch batches
    const { data: batches } = await supabaseAdmin
      .from('batches')
      .select('id, name')
      .eq('institution_id', userRecord.institution_id)

    return NextResponse.json({ students: result, summary, feePlans: feePlans || [], batches: batches || [] })
  } catch (e: any) {
    console.error('Fees GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
