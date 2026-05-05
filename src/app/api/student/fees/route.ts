import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/student/fees
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: student } = await supabaseAdmin
      .from('students').select('id, institution_id').eq('user_id', user.id).single()
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

    const { data: fees } = await supabaseAdmin
      .from('fees')
      .select('id, month, amount_due, amount_paid, status, due_date, paid_on')
      .eq('student_id', student.id)
      .eq('institution_id', student.institution_id)
      .order('month', { ascending: true })

    const { data: payments } = await supabaseAdmin
      .from('fee_payments')
      .select('id, amount, date, method, note')
      .eq('student_id', student.id)
      .order('date', { ascending: false })

    const totalDue  = (fees || []).reduce((s, f) => s + Number(f.amount_due), 0)
    const totalPaid = (fees || []).reduce((s, f) => s + Number(f.amount_paid), 0)
    const balance   = totalPaid - totalDue // negative = owes money

    return NextResponse.json({
      total_due: totalDue,
      total_paid: totalPaid,
      balance,
      monthly_breakdown: fees || [],
      payment_history: payments || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
