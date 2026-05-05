import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/student-lookup?registration_no=BRI001
// Finds which institution a student belongs to by registration number
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const registration_no = searchParams.get('registration_no')?.trim().toUpperCase()

  if (!registration_no) {
    return NextResponse.json({ error: "Registration number is required" }, { status: 400 })
  }

  // Look up student by registration number
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, institution_id, institutions(slug, name, status)')
    .ilike('registration_no', registration_no)
    .maybeSingle()

  if (!student) {
    return NextResponse.json({
      error: "No student found with that registration number. Please check and try again."
    }, { status: 404 })
  }

  const institution = (student as any).institutions
  if (!institution) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 })
  }

  if (institution.status !== 'active') {
    return NextResponse.json({
      error: "Your institution is not yet active. Please contact your administrator."
    }, { status: 403 })
  }

  return NextResponse.json({
    found: true,
    student_name: student.name,
    institution_slug: institution.slug,
    institution_name: institution.name,
  })
}
