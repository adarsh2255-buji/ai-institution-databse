import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Service role client — bypasses RLS (server only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (true) {
    const { data } = await supabaseAdmin
      .from("institutions")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (!data) return slug
    attempt++
    slug = `${base}-${attempt}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { institutionName, location, phone, ownerName, email, password } = body

    // ── Step 1: Validate input ──────────────────────────────
    if (!institutionName || !location || !phone || !ownerName || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    // ── Step 2: Create Auth User ────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can log in after approval
    })
    if (authError || !authData.user) {
      const msg = authError?.message ?? "Failed to create account."
      // Handle duplicate email
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const userId = authData.user.id

    // ── Step 3: Generate unique slug ────────────────────────
    const baseSlug = generateSlug(institutionName)
    const slug = await ensureUniqueSlug(baseSlug)

    // ── Step 4: Insert Institution (pending) ────────────────
    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .insert({
        name: institutionName,
        slug,
        location,
        phone,
        status: "pending",
        plan_type: "trial",
      })
      .select("id")
      .single()

    if (instError || !institution) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: instError?.message ?? "Failed to create institution." },
        { status: 500 }
      )
    }

    // ── Step 5: Insert Owner User ────────────────────────────
    const { error: userError } = await supabaseAdmin.from("users").insert({
      id: userId,
      institution_id: institution.id,
      role: "owner",
      name: ownerName,
      email,
      status: "active",
    })

    if (userError) {
      // Rollback both
      await supabaseAdmin.from("institutions").delete().eq("id", institution.id)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: userError.message ?? "Failed to create owner account." },
        { status: 500 }
      )
    }

    // ── Step 6: Return success ──────────────────────────────
    return NextResponse.json({
      success: true,
      message: "Registered successfully. Your institution is pending approval.",
      slug,
    })
  } catch (e) {
    console.error("Register error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
