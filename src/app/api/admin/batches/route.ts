import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_CLASSES = [
  "Class I","Class II","Class III","Class IV","Class V","Class VI",
  "Class VII","Class VIII","Class IX","Class X","Class XI","Class XII",
]
const VALID_MEDIUMS = ["English","Malayalam","CBSE","ICSE"]

// ── GET — list batches with student counts ───────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: caller } = await supabaseAdmin
      .from("users").select("institution_id, role").eq("id", user.id).single()
    if (!caller || !["owner","admin","teacher"].includes(caller.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Fetch batches
    const { data: batches, error } = await supabaseAdmin
      .from("batches")
      .select("id, name, created_at")
      .eq("institution_id", caller.institution_id)
      .order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch student counts per batch (single query, efficient)
    const { data: studentRows } = await supabaseAdmin
      .from("students")
      .select("batch_id")
      .eq("institution_id", caller.institution_id)
      .not("batch_id", "is", null)

    const countMap: Record<string, number> = {}
    for (const s of studentRows ?? []) {
      if (s.batch_id) countMap[s.batch_id] = (countMap[s.batch_id] ?? 0) + 1
    }

    const result = (batches ?? []).map(b => ({
      ...b,
      student_count: countMap[b.id] ?? 0,
    }))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST — create a batch and assign students ────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify caller is owner or admin (never trust institution_id from frontend)
    const { data: caller } = await supabaseAdmin
      .from("users").select("institution_id, role").eq("id", user.id).single()
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["owner","admin"].includes(caller.role))
      return NextResponse.json({ error: "Only admins and owners can create batches." }, { status: 403 })

    const { name, studentIds } = await req.json()

    // Validate batch name
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Batch name is required." }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Batch name must be under 100 characters." }, { status: 400 })
    }

    // Validate studentIds
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "Select at least one student for the batch." }, { status: 400 })
    }

    // Check duplicate batch name within institution
    const { data: existing } = await supabaseAdmin
      .from("batches")
      .select("id")
      .eq("institution_id", caller.institution_id)
      .ilike("name", name.trim())
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: `A batch named "${name.trim()}" already exists in this institution.` },
        { status: 400 }
      )
    }

    // Create batch — institution_id derived from authenticated user, never from frontend
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("batches")
      .insert({ institution_id: caller.institution_id, name: name.trim() })
      .select("id, name")
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: batchError?.message ?? "Failed to create batch." }, { status: 500 })
    }

    // Assign students — the institution_id filter prevents cross-tenant assignment
    const { error: assignError, count } = await supabaseAdmin
      .from("students")
      .update({ batch_id: batch.id })
      .in("id", studentIds)
      .eq("institution_id", caller.institution_id)   // cross-tenant guard
      .eq("status", "active")                         // only active students

    if (assignError) {
      // Rollback batch creation
      await supabaseAdmin.from("batches").delete().eq("id", batch.id)
      return NextResponse.json({ error: "Failed to assign students: " + assignError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      batch: { id: batch.id, name: batch.name },
      studentsAssigned: count ?? studentIds.length,
      message: `Batch "${batch.name}" created with ${count ?? studentIds.length} student(s).`,
    })
  } catch (e) {
    console.error("create batch error:", e)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
