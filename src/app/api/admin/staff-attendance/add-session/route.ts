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

    if (!userRecord || userRecord.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 })
    }

    const { user_id, date, check_in_time, check_out_time } = await req.json()

    if (!user_id || !date || !check_in_time || !check_out_time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify target user belongs to same institution
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("institution_id")
      .eq("id", user_id)
      .single()

    if (!targetUser || targetUser.institution_id !== userRecord.institution_id) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 })
    }

    const checkIn = new Date(check_in_time)
    const checkOut = new Date(check_out_time)
    
    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 })
    }

    const durationHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)

    // Ensure no overlapping sessions (simplified check: just prevent same exactly or completely inside)
    // For MVP, we insert it directly but robust apps would check `check_in_time < NewOut AND check_out_time > NewIn`
    const { data: overlapping } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .select("id")
      .eq("user_id", user_id)
      .eq("date", date)
      .lt("check_in_time", check_out_time)
      .gt("check_out_time", check_in_time)
      .limit(1)

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ error: "Overlapping session exists" }, { status: 400 })
    }

    const { data: newSession, error: insertError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .insert({
        user_id,
        institution_id: userRecord.institution_id,
        date,
        check_in_time,
        check_out_time,
        duration: durationHours
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, session: newSession })

  } catch (error: any) {
    console.error("Add session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
