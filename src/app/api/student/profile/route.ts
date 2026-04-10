import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── GET — fetch current student's profile ────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from("students")
      .select(`
        id, name, registration_no, student_class, dob, status,
        medium, photo_url, gender, school_name,
        father_name, mother_name, address, phone, whatsapp_number, email,
        password_changed, profile_completed, institution_id,
        institutions(name, slug)
      `)
      .eq("user_id", user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}

// ── PUT — update editable profile fields ─────────────────────
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const body = await req.json()

    // Only allow safe fields to be updated (never name/dob/class from this endpoint)
    const allowedFields = [
      "medium", "photo_url", "gender", "school_name",
      "father_name", "mother_name", "address",
      "phone", "whatsapp_number", "email",
    ]

    const updates: Record<string, string | null> = {}
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key] ?? null
      }
    }

    // Check if this is a first-time profile completion (mark flag)
    const { data: current } = await supabaseAdmin
      .from("students")
      .select("profile_completed")
      .eq("user_id", user.id)
      .single()

    // Mark profile_completed if core fields are filled
    const isCompleting = !current?.profile_completed
    if (isCompleting) {
      updates.profile_completed = "true" as unknown as string
    }

    const { error } = await supabaseAdmin
      .from("students")
      .update({ ...updates, profile_completed: true })
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Profile updated." })
  } catch (e) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
