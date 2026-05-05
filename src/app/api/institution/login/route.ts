import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { identifier, password, institutionSlug } = await req.json()

    if (!identifier || !password || !institutionSlug) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const isEmail = identifier.includes("@")

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
      return NextResponse.json({
        error: institution.status === "pending"
          ? "Your institution is pending approval by the platform administrator."
          : "Your institution has been suspended. Contact support.",
        code: institution.status === "pending" ? "INSTITUTION_PENDING" : "INSTITUTION_SUSPENDED",
      }, { status: 403 })
    }

    const supabase = await createClient()

    // ── Step 2: Handle STAFF (Email) Login ────────────────
    if (isEmail) {
      const email = identifier.toLowerCase().trim()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !authData.user) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
      }

      // Verify they belong to this institution
      const { data: userRecord, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, role, status, institution_id")
        .eq("id", authData.user.id)
        .single()

      if (userError || !userRecord) {
        // Might be a platform admin trying an institution URL, reject access for security isolation
        await supabase.auth.signOut()
        return NextResponse.json({ error: "Access denied. Are you a platform admin? Use the main portal." }, { status: 403 })
      }

      if (userRecord.institution_id !== institution.id && userRecord.role !== 'owner') {
        // Technically an owner could own multiple if they registered separately but let's stick to 1:1 if your schema does.
        if (userRecord.institution_id !== institution.id) {
           await supabase.auth.signOut()
           return NextResponse.json({ error: "You do not belong to this institution." }, { status: 403 })
        }
      }

      if (userRecord.status !== "active") {
        await supabase.auth.signOut()
        return NextResponse.json({ error: "Your account is suspended. Contact support." }, { status: 403 })
      }

      return NextResponse.json({
        success: true,
        role: userRecord.role,
        institutionSlug: institution.slug,
        institutionName: institution.name,
      })
    } 
    
    // ── Step 3: Handle STUDENT (Reg No) Login ──────────────
    else {
      const registrationNo = identifier.trim().toUpperCase()
      
      // Verify student exists directly
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .select("id, name, registration_no, status, user_id, password_changed, profile_completed")
        .eq("institution_id", institution.id)
        .eq("registration_no", registrationNo)
        .single()

      if (studentError || !student) {
        return NextResponse.json({ error: "Invalid registration number or password." }, { status: 401 })
      }

      // Check student approval status from main users table
      const { data: userRecord } = await supabaseAdmin
        .from("users")
        .select("status")
        .eq("id", student.user_id)
        .single()

      if (!userRecord) {
        return NextResponse.json({ error: "Account mapping error." }, { status: 500 })
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

      const syntheticEmail = `${registrationNo.toLowerCase()}@${institutionSlug}`
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      })

      if (authError || !authData.user) {
        return NextResponse.json({ error: "Invalid registration number or password." }, { status: 401 })
      }

      return NextResponse.json({
        success: true,
        role: "student",
        studentName: student.name,
        registrationNo: student.registration_no,
        institutionSlug: institution.slug,
        institutionName: institution.name,
        passwordChanged: student.password_changed ?? false,
        profileCompleted: student.profile_completed ?? false,
      })
    }
  } catch (e) {
    console.error("Unified login error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
