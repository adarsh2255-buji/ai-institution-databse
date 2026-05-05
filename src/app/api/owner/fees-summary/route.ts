import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/owner/fees-summary
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('role, institution_id').eq('id', user.id).single()
    if (!userRecord || !['owner', 'admin'].includes(userRecord.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const institutionId = userRecord.institution_id

    // Total collected from payments
    const { data: payments } = await supabaseAdmin
      .from('fee_payments')
      .select('amount, date, method')
      .eq('institution_id', institutionId)

    const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount), 0)

    // Total dues
    const { data: dues } = await supabaseAdmin
      .from('fees')
      .select('amount_due, amount_paid, status, month')
      .eq('institution_id', institutionId)

    const totalDue     = (dues || []).reduce((s, d) => s + Number(d.amount_due), 0)
    const totalPaid    = (dues || []).reduce((s, d) => s + Number(d.amount_paid), 0)
    const totalPending = totalDue - totalPaid

    // Monthly collection breakdown
    const monthlyMap: Record<string, number> = {}
    for (const p of (payments || [])) {
      const month = p.date?.slice(0, 7) // YYYY-MM
      if (month) monthlyMap[month] = (monthlyMap[month] || 0) + Number(p.amount)
    }
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, collected]) => ({ month, collected }))

    // Status breakdown
    const statusCounts = { paid: 0, partial: 0, pending: 0, overdue: 0 }
    for (const d of (dues || [])) {
      if (d.status in statusCounts) statusCounts[d.status as keyof typeof statusCounts]++
    }

    // Payment method breakdown
    const methodMap: Record<string, number> = {}
    for (const p of (payments || [])) {
      methodMap[p.method] = (methodMap[p.method] || 0) + Number(p.amount)
    }

    return NextResponse.json({
      totalCollected,
      totalDue,
      totalPaid,
      totalPending,
      monthlyTrend,
      statusCounts,
      methodBreakdown: methodMap,
      totalPayments: payments?.length ?? 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
