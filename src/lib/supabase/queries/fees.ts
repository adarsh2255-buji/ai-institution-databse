import { SupabaseClient } from "@supabase/supabase-js"

export async function getStudentFeesQuery(
  supabase: SupabaseClient,
  centerId: string,
  studentName: string,
  month?: string
) {
  let query = supabase
    .from("fees")
    .select(`
      month,
      amount_due,
      amount_paid,
      due_date,
      paid_on,
      status,
      students ( name )
    `)
    .eq("institution_id", centerId)
    .ilike("students.name", `%${studentName}%`)
    .order("month", { ascending: false })

  if (month) {
    query = query.eq("month", month)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const records = (data ?? []).filter((r) => r.students !== null)
  const totalDue = records.reduce((sum, r) => sum + Number(r.amount_due), 0)
  const totalPaid = records.reduce((sum, r) => sum + Number(r.amount_paid), 0)
  const totalPending = totalDue - totalPaid

  return {
    summary: { totalDue, totalPaid, totalPending },
    records,
  }
}

export async function getAllFeesQuery(
  supabase: SupabaseClient,
  centerId: string,
  status?: "paid" | "partial" | "pending" | "overdue"
) {
  let query = supabase
    .from("fees")
    .select(`
      month,
      amount_due,
      amount_paid,
      due_date,
      paid_on,
      status,
      students ( name, id )
    `)
    .eq("institution_id", centerId)
    .order("due_date", { ascending: true })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
