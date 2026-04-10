import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify caller is a platform admin
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
    )

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminCheck } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json({ error: "Forbidden: Platform admin access required." }, { status: 403 })
    }

    const { institution_id, action } = await req.json()
    if (!institution_id) {
      return NextResponse.json({ error: "institution_id is required." }, { status: 400 })
    }

    const newStatus = action === "suspend" ? "suspended" : "active"

    const { data, error } = await supabaseAdmin
      .from("institutions")
      .update({ status: newStatus })
      .eq("id", institution_id)
      .select("id, name, slug, status")
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Institution not found." }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Institution "${data.name}" is now ${newStatus}.`,
      institution: data,
    })
  } catch (e) {
    console.error("Approve error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
