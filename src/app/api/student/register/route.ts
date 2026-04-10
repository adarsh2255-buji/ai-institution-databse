import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Generates the 3-letter prefix from institution name ──────
function buildPrefix(institutionName: string): string {
  return institutionName
    .replace(/[^A-Za-z]/g, "")   // strip non-alpha
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X")               // pad if name is < 3 chars
}

// ── Pure-JS registration number generator ───────────────────
// Reads existing reg numbers for this institution and increments
// the highest one. The UNIQUE constraint in the DB is the final
// safety net against races.
async function generateRegNo(
  institutionId: string,
  institutionName: string
): Promise<{ regNo: string; error?: string }> {
  const prefix = buildPrefix(institutionName)

  // Fetch all existing reg numbers for this institution
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("registration_no")
    .eq("institution_id", institutionId)
    .not("registration_no", "is", null)

  if (error) {
    return { regNo: "", error: error.message }
  }

  // Find the current highest sequence number
  let maxNum = 0
  for (const row of data ?? []) {
    if (!row.registration_no) continue
    // Strip the prefix (any leading letters) and parse the digits
    const digits = row.registration_no.replace(/^[A-Z]+/, "")
    const n = parseInt(digits, 10)
    if (!isNaN(n) && n > maxNum) maxNum = n
  }

  const nextNum = maxNum + 1
  const padded = nextNum < 100
    ? String(nextNum).padStart(2, "0")   // 01, 02…99
    : String(nextNum)                     // 100, 101…

  return { regNo: `${prefix}${padded}` }
}

// ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, dob, institution_slug, student_class } = body

    // ── Step 1: Validate inputs ────────────────────────────
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Student name is required (min 2 characters)." },
        { status: 400 }
      )
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return NextResponse.json(
        { error: "A valid date of birth (YYYY-MM-DD) is required." },
        { status: 400 }
      )
    }
    if (!institution_slug || typeof institution_slug !== "string") {
      return NextResponse.json(
        { error: "Institution slug is required." },
        { status: 400 }
      )
    }
    const dobDate = new Date(dob)
    if (isNaN(dobDate.getTime()) || dobDate >= new Date()) {
      return NextResponse.json(
        { error: "Date of birth must be a valid past date." },
        { status: 400 }
      )
    }

    // ── Step 2: Resolve institution by slug (never trust frontend ID) ──
    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .select("id, name, status")
      .eq("slug", institution_slug)
      .single()

    if (instError || !institution) {
      return NextResponse.json(
        { error: "Institution not found. Check your registration link." },
        { status: 404 }
      )
    }
    if (institution.status !== "active") {
      return NextResponse.json(
        { error: "This institution is not accepting registrations at this time." },
        { status: 403 }
      )
    }

    // ── Step 3: Generate registration number in JS ─────────
    const { regNo, error: regError } = await generateRegNo(institution.id, institution.name)
    if (regError || !regNo) {
      console.error("generateRegNo error:", regError)
      return NextResponse.json(
        { error: "Failed to generate registration number. Try again." },
        { status: 500 }
      )
    }

    // ── Step 4: Generate default password ─────────────────
    // Format: lowercase(firstname) + last 2 digits of birth year
    // e.g. Rahul born 2005 → rahul05
    const firstName = name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "")
    const last2Year = dob.slice(2, 4)   // "2005" → "05"
    const defaultPassword = `${firstName}${last2Year}`

    // ── Step 5: Create Supabase Auth user ─────────────────
    // Synthetic email guaranteed unique: regNo@institutionSlug
    const syntheticEmail = `${regNo.toLowerCase()}@${institution_slug}`

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: defaultPassword,
      email_confirm: true,
    })

    if (authError || !authData?.user) {
      console.error("Auth create error:", authError)
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create account." },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // ── Step 6: Insert into users table (role=student, status=pending) ──
    const { error: userInsertError } = await supabaseAdmin.from("users").insert({
      id: userId,
      institution_id: institution.id,
      role: "student",
      name: name.trim(),
      email: syntheticEmail,
      status: "pending",
    })

    if (userInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)   // rollback
      console.error("users insert error:", userInsertError)
      return NextResponse.json(
        { error: "Failed to create user record: " + userInsertError.message },
        { status: 500 }
      )
    }

    // ── Step 7: Insert into students table ─────────────────
    const { error: studentInsertError } = await supabaseAdmin.from("students").insert({
      institution_id: institution.id,
      user_id: userId,
      name: name.trim(),
      registration_no: regNo,
      dob: dob,
      student_class: student_class ?? null,
      status: "pending",
      enrolled_at: new Date().toISOString().slice(0, 10),
    })

    if (studentInsertError) {
      // Rollback both
      await supabaseAdmin.from("users").delete().eq("id", userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error("students insert error:", studentInsertError)

      // If it's a unique violation on reg_no, retry is safe
      if (studentInsertError.code === "23505") {
        return NextResponse.json(
          { error: "Registration number conflict. Please try again." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Failed to create student profile: " + studentInsertError.message },
        { status: 500 }
      )
    }

    // ── Step 8: Return credentials ─────────────────────────
    return NextResponse.json({
      success: true,
      message: "Registration submitted. Waiting for admin approval.",
      registration_no: regNo,
      default_password: defaultPassword,
    })

  } catch (e) {
    console.error("Student register unexpected error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
