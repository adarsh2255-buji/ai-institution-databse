import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_CLASSES = [
  "Class I","Class II","Class III","Class IV","Class V","Class VI",
  "Class VII","Class VIII","Class IX","Class X","Class XI","Class XII",
]
const VALID_MEDIUMS = ["English","Malayalam","CBSE","ICSE"]

// GET /api/admin/students/filter?class=Class+X&medium=English
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studentClass = searchParams.get("class") ?? ""
    const medium       = searchParams.get("medium") ?? ""

    // Validate inputs
    if (!studentClass) {
      return NextResponse.json({ error: "Class is required." }, { status: 400 })
    }
    if (!VALID_CLASSES.includes(studentClass)) {
      return NextResponse.json({ error: "Invalid class." }, { status: 400 })
    }
    if (medium && !VALID_MEDIUMS.includes(medium)) {
      return NextResponse.json({ error: "Invalid medium." }, { status: 400 })
    }

    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from("users").select("institution_id, role").eq("id", user.id).single()
    if (!caller || !["owner","admin"].includes(caller.role))
      return NextResponse.json({ error: "Only admins and owners can filter students." }, { status: 403 })

    // Build query — institution_id always from auth, never from frontend
    let query = supabaseAdmin
      .from("students")
      .select("id, name, registration_no, student_class, medium, batch_id, batches(name)")
      .eq("institution_id", caller.institution_id)
      .eq("status", "active")                  // only approved students
      .eq("student_class", studentClass)
      .order("name", { ascending: true })

    if (medium) {
      query = query.eq("medium", medium)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
