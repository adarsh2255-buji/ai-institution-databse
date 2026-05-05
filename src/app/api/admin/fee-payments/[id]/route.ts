import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function allocatePayment(studentId: string, institutionId: string) {
  const { data: payments } = await supabaseAdmin
    .from('fee_payments')
    .select('amount')
    .eq('student_id', studentId)
    .eq('institution_id', institutionId)
    .order('date', { ascending: true })

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

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
      await supabaseAdmin.from('fees').update({ amount_paid: 0, status: 'pending', paid_on: null }).eq('id', due.id)
    } else if (remaining >= dueAmount) {
      await supabaseAdmin.from('fees').update({ amount_paid: dueAmount, status: 'paid', paid_on: new Date().toISOString().split('T')[0] }).eq('id', due.id)
      remaining -= dueAmount
    } else {
      await supabaseAdmin.from('fees').update({ amount_paid: remaining, status: 'partial', paid_on: null }).eq('id', due.id)
      remaining = 0
    }
  }
}

// DELETE /api/admin/fee-payments/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('id, role, institution_id').eq('id', user.id).single()

    if (!userRecord || userRecord.role !== 'admin') {
      return NextResponse.json({ error: "Only admins can delete payments" }, { status: 403 })
    }

    // Fetch the payment to confirm ownership and get student_id
    const { data: payment } = await supabaseAdmin
      .from('fee_payments')
      .select('id, student_id, amount, institution_id')
      .eq('id', id)
      .eq('institution_id', userRecord.institution_id)
      .single()

    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    // Delete the payment
    const { error: delErr } = await supabaseAdmin
      .from('fee_payments')
      .delete()
      .eq('id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Recalculate allocation for the student
    await allocatePayment(payment.student_id, userRecord.institution_id)

    return NextResponse.json({ success: true, message: `Payment of ₹${payment.amount} deleted and dues recalculated` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
