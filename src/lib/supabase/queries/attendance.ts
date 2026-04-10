import { SupabaseClient } from "@supabase/supabase-js"

export async function getStudentAttendanceQuery(
  supabase: SupabaseClient,
  centerId: string,
  studentName: string,
  month?: string // format: "YYYY-MM"
) {
  let query = supabase
    .from("attendance")
    .select(`
      date,
      status,
      batches ( name ),
      students ( name )
    `)
    .eq("institution_id", centerId)
    .ilike("students.name", `%${studentName}%`)
    .order("date", { ascending: false })

  if (month) {
    const start = `${month}-01`
    const end = `${month}-31`
    query = query.gte("date", start).lte("date", end)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const records = (data ?? []).filter((r) => r.students !== null)
  const total = records.length
  const present = records.filter((r) => r.status === "present").length
  const absent = records.filter((r) => r.status === "absent").length
  const late = records.filter((r) => r.status === "late").length

  return {
    summary: { total, present, absent, late, percentage: total ? Math.round((present / total) * 100) : 0 },
    records,
  }
}

export async function getBatchAttendanceQuery(
  supabase: SupabaseClient,
  centerId: string,
  batchName: string,
  month?: string
) {
  let query = supabase
    .from("attendance")
    .select(`
      date,
      status,
      students ( name ),
      batches ( name )
    `)
    .eq("institution_id", centerId)
    .ilike("batches.name", `%${batchName}%`)
    .order("date", { ascending: false })

  if (month) {
    const start = `${month}-01`
    const end = `${month}-31`
    query = query.gte("date", start).lte("date", end)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const records = (data ?? []).filter((r) => r.batches !== null)

  // Group by student
  const byStudent: Record<string, { present: number; absent: number; late: number; total: number }> = {}
  for (const r of records) {
    const name = ((Array.isArray(r.students) ? r.students[0] : r.students) as unknown as { name: string } | null)?.name ?? "Unknown"
    if (!byStudent[name]) byStudent[name] = { present: 0, absent: 0, late: 0, total: 0 }
    byStudent[name].total++
    byStudent[name][r.status as "present" | "absent" | "late"]++
  }

  return {
    byStudent,
    totalRecords: records.length,
  }
}
