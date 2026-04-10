import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("role, institution_id")
      .eq("id", user.id)
      .single()

    if (!userRecord || !["owner", "admin", "teacher"].includes(userRecord.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id, name, registration_no, student_class, dob, email, phone, status, enrolled_at, batches(name)")
      .eq("institution_id", userRecord.institution_id)
      .order("enrolled_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
