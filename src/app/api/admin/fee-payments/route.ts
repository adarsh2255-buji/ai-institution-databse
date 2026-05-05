import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ─────────────────────────────────────────────────────────────────
   ALLOCATION ENGINE
   Given a student's pending dues (sorted oldest first) and a payment
   amount, allocates sequentially and returns updated fee records.
───────────────────────────────────────────────────────────────── */
async function allocatePayment(studentId: string, institutionId: string) {
  // Fetch all payments for student (oldest first)
  const { data: payments } = await supabaseAdmin
    .from('fee_payments')
    .select('amount')
    .eq('student_id', studentId)
    .eq('institution_id', institutionId)
    .order('date', { ascending: true })

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

  // Fetch all dues (oldest month first)
  const { data: dues } = await supabaseAdmin
    .from('fees')
    .select('id, month, amount_due')
    .eq('student_id', studentId)
    .eq('institution_id', institutionId)
    .order('month', { ascending: true })

  let remaining = totalPaid

  for (const due of (dues || [])) {
    const dueAmount = Number(due.amount_due)
    if (remaining <= 0) {
      // Nothing left to allocate
      await supabaseAdmin.from('fees').update({
        amount_paid: 0,
        status: 'pending',
      }).eq('id', due.id)
    } else if (remaining >= dueAmount) {
      // Fully pay this due
      await supabaseAdmin.from('fees').update({
        amount_paid: dueAmount,
        status: 'paid',
        paid_on: new Date().toISOString().split('T')[0],
      }).eq('id', due.id)
      remaining -= dueAmount
    } else {
      // Partial payment
      await supabaseAdmin.from('fees').update({
        amount_paid: remaining,
        status: 'partial',
      }).eq('id', due.id)
      remaining = 0
    }
  }
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/admin/fee-payments — Record a payment
───────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('id, role, institution_id').eq('id', user.id).single()

    if (!userRecord || userRecord.role !== 'admin') {
      return NextResponse.json({ error: "Only admins can record payments" }, { status: 403 })
    }

    const { student_id, amount, method, note, date } = await req.json()
    if (!student_id || !amount || amount <= 0) {
      return NextResponse.json({ error: "student_id and valid amount required" }, { status: 400 })
    }

    // Validate student belongs to institution
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, name')
      .eq('id', student_id)
      .eq('institution_id', userRecord.institution_id)
      .single()

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

    // Insert payment
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('fee_payments')
      .insert({
        institution_id: userRecord.institution_id,
        student_id,
        amount: Number(amount),
        date: date || new Date().toISOString().split('T')[0],
        method: method || 'cash',
        note: note || null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

    // Re-allocate all payments against dues
    await allocatePayment(student_id, userRecord.institution_id)

    return NextResponse.json({
      success: true,
      message: `Payment of ₹${amount} recorded for ${student.name}`,
      payment,
    })
  } catch (e: any) {
    console.error('Record payment error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/* ─────────────────────────────────────────────────────────────────
   GET /api/admin/fee-payments?student_id=xxx — Get payment history
───────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('institution_id, role').eq('id', user.id).single()
    if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('student_id')

    let query = supabaseAdmin
      .from('fee_payments')
      .select('*, students(name, registration_no), users(name)')
      .eq('institution_id', userRecord.institution_id)
      .order('date', { ascending: false })

    if (studentId) query = query.eq('student_id', studentId)

    const { data: payments } = await query

    // Also get the monthly dues for this student
    let feesData: any[] = []
    if (studentId) {
      const { data: fees } = await supabaseAdmin
        .from('fees')
        .select('*')
        .eq('student_id', studentId)
        .eq('institution_id', userRecord.institution_id)
        .order('month', { ascending: true })
      feesData = fees || []
    }

    return NextResponse.json({ payments: payments || [], fees: feesData })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
