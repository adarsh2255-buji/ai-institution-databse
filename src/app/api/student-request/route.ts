import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET — list all requests (authenticated admin/owner) ──────
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

    if (!userRecord || !["owner", "admin"].includes(userRecord.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("student_requests")
      .select("id, student_name, parent_name, parent_email, parent_phone, batch_name, date_of_birth, message, status, created_at")
      .eq("institution_id", userRecord.institution_id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST — public enrollment submission (no auth required) ───
export async function POST(req: NextRequest) {
  try {
    const {
      institutionSlug,
      studentName,
      parentName,
      parentEmail,
      parentPhone,
      batchName,
      dateOfBirth,
      message,
    } = await req.json()

    if (!institutionSlug || !studentName || !parentName || !parentEmail || !parentPhone) {
      return NextResponse.json({ error: "Student name, parent name, email, and phone are required." }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 })
    }

    const { data: institution } = await supabaseAdmin
      .from("institutions")
      .select("id, status")
      .eq("slug", institutionSlug)
      .single()

    if (!institution) return NextResponse.json({ error: "Institution not found." }, { status: 404 })
    if (institution.status !== "active") {
      return NextResponse.json({ error: "This institution is not accepting requests at this time." }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from("student_requests").insert({
      institution_id: institution.id,
      student_name: studentName,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      batch_name: batchName || null,
      date_of_birth: dateOfBirth || null,
      message: message || null,
      status: "pending",
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Enrollment request submitted." })
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
