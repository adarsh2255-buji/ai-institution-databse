import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HALF_DAY_THRESHOLD = 2

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

    if (!userRecord || userRecord.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const dateQuery = searchParams.get("date")

    const { data: staffList, error: staffError } = await supabaseAdmin
      .from("users")
      .select("id, name, role, email")
      .eq("institution_id", userRecord.institution_id)
      .in("role", ["admin", "teacher", "staff"])
      .order("name")

    if (staffError) throw staffError

    let query = supabaseAdmin
      .from("staff_attendance_sessions")
      .select("*")
      .eq("institution_id", userRecord.institution_id)
      .order("check_in_time", { ascending: true })

    if (dateQuery) {
      query = query.eq("date", dateQuery)
    }

    const { data: sessions, error: sessionsError } = await query
    if (sessionsError) throw sessionsError

    const userAttendanceMap: Record<string, Record<string, any>> = {}

    sessions.forEach(session => {
      const uid = session.user_id
      const date = session.date

      if (!userAttendanceMap[uid]) userAttendanceMap[uid] = {}
      if (!userAttendanceMap[uid][date]) {
        userAttendanceMap[uid][date] = {
          date,
          total_hours: 0,
          status: "absent",
          sessions: []
        }
      }

      userAttendanceMap[uid][date].sessions.push(session)
      if (session.duration) {
        userAttendanceMap[uid][date].total_hours += session.duration
      }
    })

    Object.keys(userAttendanceMap).forEach(uid => {
      Object.keys(userAttendanceMap[uid]).forEach(date => {
        const day = userAttendanceMap[uid][date]
        if (day.total_hours === 0) {
          day.status = "absent"
        } else if (day.total_hours < HALF_DAY_THRESHOLD) {
          day.status = "half-day"
        } else {
          day.status = "present"
        }
      })
    })

    const result = staffList.map(staff => {
      const attendanceByDate = userAttendanceMap[staff.id] || {}
      return {
        ...staff,
        attendance: attendanceByDate
      }
    })

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error("Owner staff attendance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
