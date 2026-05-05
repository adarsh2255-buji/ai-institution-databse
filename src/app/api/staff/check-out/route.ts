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
      return NextResponse.json({ error: "Forbidden: Invalid role for check-out" }, { status: 403 })
    }

    // Use server time
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Find the latest open session for today
    const { data: openSession, error: fetchError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .select("id, check_in_time")
      .eq("user_id", user.id)
      .eq("date", today)
      .is("check_out_time", null)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError || !openSession) {
      return NextResponse.json({ error: "No open session found to check out from." }, { status: 400 })
    }

    const checkInTime = new Date(openSession.check_in_time)
    const durationHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // Update the session
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .update({
        check_out_time: now.toISOString(),
        duration: durationHours
      })
      .eq("id", openSession.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, message: "Checked out successfully", session: updatedSession })

  } catch (error: any) {
    console.error("Check-out error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
