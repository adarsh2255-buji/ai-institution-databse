import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify caller is owner or admin of the institution
    const { data: caller } = await supabaseAdmin
      .from("users")
      .select("role, institution_id, status")
      .eq("id", user.id)
      .single()

    if (!caller || !["owner", "admin"].includes(caller.role) || caller.status !== "active") {
      return NextResponse.json({ error: "Only owners or admins can create users." }, { status: 403 })
    }

    const { name, email, password, role, institutionId } = await req.json()

    // Ensure they're creating within their own institution
    if (institutionId !== caller.institution_id) {
      return NextResponse.json({ error: "Forbidden: Cross-institution user creation not allowed." }, { status: 403 })
    }

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Name, email, password, and role are required." }, { status: 400 })
    }

    const allowedRoles = caller.role === "owner"
      ? ["admin", "teacher", "parent"]
      : ["teacher", "parent"]

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: `Role '${role}' cannot be assigned by a ${caller.role}.` }, { status: 403 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      const msg = authError?.message ?? "Failed to create account."
      if (msg.includes("already registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const newUserId = authData.user.id

    // Insert into users table
    const { error: userInsertError } = await supabaseAdmin.from("users").insert({
      id: newUserId,
      institution_id: institutionId,
      role,
      name,
      email,
      status: "active",
    })

    if (userInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: userInsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `${role} created successfully.` })
  } catch (e) {
    console.error("Create user error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
