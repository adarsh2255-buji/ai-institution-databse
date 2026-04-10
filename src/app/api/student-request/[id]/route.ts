import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: requestId } = await params
    const supabase = await createClient()

    // Verify caller is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify caller is admin/owner
    const { data: reviewer } = await supabaseAdmin
      .from("users")
      .select("id, role, institution_id, name")
      .eq("id", user.id)
      .single()

    if (!reviewer || !["owner", "admin"].includes(reviewer.role)) {
      return NextResponse.json({ error: "Only admins and owners can review requests." }, { status: 403 })
    }

    // Fetch the request
    const { data: request, error: reqError } = await supabaseAdmin
      .from("student_requests")
      .select("*")
      .eq("id", requestId)
      .eq("institution_id", reviewer.institution_id) // tenant isolation
      .single()

    if (reqError || !request) {
      return NextResponse.json({ error: "Enrollment request not found." }, { status: 404 })
    }

    if (request.status !== "pending") {
      return NextResponse.json({ error: `Request has already been ${request.status}.` }, { status: 409 })
    }

    const { action, batchId } = await req.json() // action: "approve" | "reject"

    if (action === "reject") {
      await supabaseAdmin
        .from("student_requests")
        .update({ status: "rejected", reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
        .eq("id", requestId)

      return NextResponse.json({ success: true, message: "Enrollment request rejected." })
    }

    if (action === "approve") {
      // Create the student record
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          institution_id: reviewer.institution_id,
          name: request.student_name,
          email: request.parent_email,
          phone: request.parent_phone,
          batch_id: batchId || null,
          enrolled_at: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single()

      if (studentError || !student) {
        return NextResponse.json({ error: "Failed to create student record: " + studentError?.message }, { status: 500 })
      }

      // Update the request with approved status + student_id link
      await supabaseAdmin
        .from("student_requests")
        .update({
          status: "approved",
          reviewed_by: reviewer.id,
          reviewed_at: new Date().toISOString(),
          student_id: student.id,
        })
        .eq("id", requestId)

      return NextResponse.json({
        success: true,
        message: `${request.student_name} has been approved and added as a student.`,
        studentId: student.id,
      })
    }

    return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 })
  } catch (e) {
    console.error("Review request error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
