import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HALF_DAY_THRESHOLD = 2 // hours

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all sessions for this user
    const { data: sessions, error } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("institution_id", userRecord.institution_id)
      .order("check_in_time", { ascending: false })

    if (error) throw error

    // Group by date
    const dailyMap: Record<string, any> = {}

    sessions.forEach(session => {
      const date = session.date
      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          sessions: [],
          total_hours: 0,
          status: "absent"
        }
      }
      
      dailyMap[date].sessions.push(session)
      if (session.duration) {
        dailyMap[date].total_hours += session.duration
      }
    })

    // Calculate status for each day
    Object.values(dailyMap).forEach(day => {
      if (day.total_hours === 0) {
        day.status = "absent"
      } else if (day.total_hours < HALF_DAY_THRESHOLD) {
        day.status = "half-day"
      } else {
        day.status = "present"
      }
    })

    // Sort days descending
    const dailySummary = Object.values(dailyMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Find if there's an open session today
    const today = new Date().toISOString().split('T')[0]
    const openSession = sessions.find(s => s.date === today && s.check_out_time === null)

    return NextResponse.json({
      success: true,
      openSession: openSession || null,
      dailySummary
    })

  } catch (error: any) {
    console.error("My attendance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
