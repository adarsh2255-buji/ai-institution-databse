import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DELETE /api/admin/fee-plans/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('id, role, institution_id').eq('id', user.id).single()
    if (!userRecord || userRecord.role !== 'admin')
      return NextResponse.json({ error: "Only admins can delete fee plans" }, { status: 403 })

    // Confirm plan belongs to this institution
    const { data: plan } = await supabaseAdmin
      .from('fee_plans')
      .select('id, plan_name')
      .eq('id', id)
      .eq('institution_id', userRecord.institution_id)
      .single()

    if (!plan) return NextResponse.json({ error: "Fee plan not found" }, { status: 404 })

    // Delete all monthly fee records linked to this plan
    const { error: feesDelErr } = await supabaseAdmin
      .from('fees')
      .delete()
      .eq('fee_plan_id', id)

    if (feesDelErr) return NextResponse.json({ error: `Failed to delete fee records: ${feesDelErr.message}` }, { status: 500 })

    // Delete the plan itself
    const { error: delErr } = await supabaseAdmin
      .from('fee_plans')
      .delete()
      .eq('id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ success: true, message: `"${plan.plan_name}" and all associated dues deleted` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
