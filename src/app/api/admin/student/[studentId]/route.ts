import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Params { params: Promise<{ studentId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify caller is owner or admin
    const { data: caller } = await supabaseAdmin
      .from("users")
      .select("role, institution_id")
      .eq("id", user.id)
      .single()

    if (!caller || !["owner", "admin"].includes(caller.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const { action } = await req.json() // "approve" | "suspend" | "reject"

    // Fetch student — enforce tenant isolation
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, user_id, name, institution_id, status")
      .eq("id", studentId)
      .eq("institution_id", caller.institution_id)
      .single()

    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 })

    const newStudentStatus = action === "approve" ? "active" : "suspended"
    const newUserStatus = action === "approve" ? "active" : "suspended"

    // Update both students and users tables
    await Promise.all([
      supabaseAdmin.from("students").update({ status: newStudentStatus }).eq("id", studentId),
      student.user_id
        ? supabaseAdmin.from("users").update({ status: newUserStatus }).eq("id", student.user_id)
        : Promise.resolve(),
    ])

    const label = action === "approve" ? "approved" : "suspended"
    return NextResponse.json({ success: true, message: `${student.name} has been ${label}.` })
  } catch (e) {
    console.error("Student approve error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
