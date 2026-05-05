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

    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("institution_id, role")
      .eq("id", user.id)
      .single()

    if (!userRecord || !["admin", "teacher", "staff"].includes(userRecord.role)) {
      return NextResponse.json({ error: "Forbidden: Invalid role for check-in" }, { status: 403 })
    }

    // Use server time for date and check_in_time
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Check for open session (check_out_time IS NULL)
    const { data: openSession } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .is("check_out_time", null)
      .maybeSingle()

    if (openSession) {
      return NextResponse.json({ error: "You already have an open session. Please check out first." }, { status: 400 })
    }

    // Insert new session
    const { data: newSession, error: insertError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .insert({
        user_id: user.id,
        institution_id: userRecord.institution_id,
        date: today,
        check_in_time: now.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, message: "Checked in successfully", session: newSession })

  } catch (error: any) {
    console.error("Check-in error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
