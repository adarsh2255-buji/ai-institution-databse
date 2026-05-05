import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── POST /api/admin/fee-plans — Create a fee plan ──
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('id, role, institution_id').eq('id', user.id).single()

    if (!userRecord || !['admin'].includes(userRecord.role)) {
      return NextResponse.json({ error: "Only admins can create fee plans" }, { status: 403 })
    }

    const { plan_name, batch_id, monthly_fee, year_start, year_end } = await req.json()
    if (!plan_name || !monthly_fee || monthly_fee <= 0) {
      return NextResponse.json({ error: "Plan name and valid monthly fee required" }, { status: 400 })
    }
    if (!year_start || !year_end || year_start >= year_end) {
      return NextResponse.json({ error: "Valid year_start and year_end (YYYY-MM) required" }, { status: 400 })
    }

    // Check for existing active plan for same batch
    if (batch_id) {
      const { data: existing } = await supabaseAdmin
        .from('fee_plans')
        .select('id')
        .eq('institution_id', userRecord.institution_id)
        .eq('batch_id', batch_id)
        .eq('is_active', true)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: "An active fee plan already exists for this batch. Deactivate it first." }, { status: 409 })
      }
    }

    const { data: plan, error } = await supabaseAdmin
      .from('fee_plans')
      .insert({
        institution_id: userRecord.institution_id,
        batch_id: batch_id || null,
        plan_name,
        monthly_fee: Number(monthly_fee),
        year_start,
        year_end,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, plan })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── GET /api/admin/fee-plans — List all fee plans ──
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from('users').select('institution_id').eq('id', user.id).single()
    if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 403 })

    const { data: plans } = await supabaseAdmin
      .from('fee_plans')
      .select('*, batches(name)')
      .eq('institution_id', userRecord.institution_id)
      .order('created_at', { ascending: false })

    return NextResponse.json(plans || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
