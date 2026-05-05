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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, check_in_time, check_out_time } = await req.json()

    if (!id || !check_in_time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const checkIn = new Date(check_in_time)
    let updateData: any = { check_in_time }

    if (check_out_time) {
      const checkOut = new Date(check_out_time)
      if (checkOut <= checkIn) {
        return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 })
      }
      updateData.check_out_time = check_out_time
      updateData.duration = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
    } else {
      updateData.check_out_time = null
      updateData.duration = null
    }

    // Verify session belongs to same institution
    const { data: session } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .select("institution_id")
      .eq("id", id)
      .single()

    if (!session || session.institution_id !== userRecord.institution_id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ success: true, session: updatedSession })

  } catch (error: any) {
    console.error("Update session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
