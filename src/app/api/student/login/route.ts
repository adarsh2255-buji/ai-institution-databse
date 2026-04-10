import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { registrationNo, password, institutionSlug } = await req.json()

    if (!registrationNo || !password || !institutionSlug) {
      return NextResponse.json({ error: "Registration number, password, and institution are required." }, { status: 400 })
    }

    // ── Step 1: Resolve institution via slug ──────────────
    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .select("id, name, slug, status")
      .eq("slug", institutionSlug)
      .single()

    if (instError || !institution) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 })
    }
    if (institution.status !== "active") {
      return NextResponse.json({ error: "Institution is not active." }, { status: 403 })
    }

    // ── Step 2: Verify student exists with this reg number ─
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, name, registration_no, status, user_id, password_changed, profile_completed")
      .eq("institution_id", institution.id)
      .eq("registration_no", registrationNo.toUpperCase())
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: "Invalid registration number or password." }, { status: 401 })
    }

    // ── Step 3: Check approval status ─────────────────────
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("status")
      .eq("id", student.user_id)
      .single()

    if (!userRecord) {
      return NextResponse.json({ error: "Account not found." }, { status: 401 })
    }

    if (userRecord.status === "pending") {
      return NextResponse.json({
        error: "Your registration is pending admin approval. Please wait.",
        code: "STUDENT_PENDING",
      }, { status: 403 })
    }

    if (userRecord.status === "suspended") {
      return NextResponse.json({
        error: "Your account has been suspended. Contact the institution.",
        code: "STUDENT_SUSPENDED",
      }, { status: 403 })
    }

    // ── Step 4: Authenticate ───────────────────────────────
    const syntheticEmail = `${registrationNo.toLowerCase()}@${institutionSlug}`
    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid registration number or password." }, { status: 401 })
    }

    // ── Step 5: Return success with next-step flags ────────
    return NextResponse.json({
      success: true,
      studentName: student.name,
      registrationNo: student.registration_no,
      institutionSlug: institution.slug,
      institutionName: institution.name,
      passwordChanged: student.password_changed ?? false,
      profileCompleted: student.profile_completed ?? false,
    })

  } catch (e) {
    console.error("Student login error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
