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

    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 })
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

    const { error: deleteError } = await supabaseAdmin
      .from("staff_attendance_sessions")
      .delete()
      .eq("id", id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Delete session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
