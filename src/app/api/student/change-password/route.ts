import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { newPassword, confirmPassword } = await req.json()

    // ── Validate ───────────────────────────────────────────
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      )
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      )
    }

    // ── Verify authenticated student ───────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    // ── Update password via Supabase Auth ──────────────────
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 })
    }

    // ── Mark password_changed = true in students table ─────
    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update({ password_changed: true })
      .eq("user_id", user.id)

    if (updateError) {
      console.error("students update error:", updateError)
      // Don't fail — password was changed successfully
    }

    return NextResponse.json({ success: true, message: "Password changed successfully." })
  } catch (e) {
    console.error("change-password error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
