import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    // ── Step 1: Attempt sign-in ─────────────────────────────
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    const userId = authData.user.id

    // ── Step 2: Check if platform_admin ────────────────────
    const { data: platformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("id", userId)
      .maybeSingle()

    if (platformAdmin) {
      // Platform admin — direct access, no institution check
      return NextResponse.json({ success: true, role: "platform_admin" })
    }

    // ── Step 3: Fetch user record ───────────────────────────
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, status, institution_id, institutions(name, slug, status)")
      .eq("id", userId)
      .single()

    if (userError || !userRecord) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: "User record not found." }, { status: 403 })
    }

    // ── Step 4: Check user status ───────────────────────────
    if (userRecord.status !== "active") {
      await supabase.auth.signOut()
      return NextResponse.json({ error: "Your account has been suspended. Contact your institution." }, { status: 403 })
    }

    // ── Step 5: Resolve institution and status gate ─────────
    const rawInst = userRecord.institutions
    const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
      name: string; slug: string; status: string
    } | null

    if (!institution) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: "Institution not found." }, { status: 403 })
    }

    if (institution.status === "pending") {
      await supabase.auth.signOut()
      return NextResponse.json({
        error: "Your institution is pending approval. Please wait for the platform administrator to review your registration.",
        code: "INSTITUTION_PENDING",
      }, { status: 403 })
    }

    if (institution.status === "suspended") {
      await supabase.auth.signOut()
      return NextResponse.json({
        error: "Your institution has been suspended. Contact support.",
        code: "INSTITUTION_SUSPENDED",
      }, { status: 403 })
    }

    // ── Step 6: All checks passed — return session info ─────
    return NextResponse.json({
      success: true,
      role: userRecord.role,
      institutionSlug: institution.slug,
      institutionName: institution.name,
    })
  } catch (e) {
    console.error("Login error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
