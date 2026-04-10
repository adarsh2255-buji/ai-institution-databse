import { SupabaseClient } from "@supabase/supabase-js"

export async function getStudentMarksQuery(
  supabase: SupabaseClient,
  centerId: string,
  studentName: string,
  subjectName?: string
) {
  let query = supabase
    .from("marks")
    .select(`
      marks_obtained,
      absent,
      exams (
        name,
        max_marks,
        held_on,
        subjects ( name ),
        batches ( name )
      ),
      students ( name )
    `)
    .eq("institution_id", centerId)
    .ilike("students.name", `%${studentName}%`)
    .order("exams(held_on)", { ascending: true })

  if (subjectName) {
    query = query.ilike("exams.subjects.name", `%${subjectName}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Filter out nulls from student name join
  return (data ?? []).filter((r) => r.students !== null)
}

export async function getBatchMarksQuery(
  supabase: SupabaseClient,
  centerId: string,
  batchName: string,
  examName?: string
) {
  let query = supabase
    .from("marks")
    .select(`
      marks_obtained,
      absent,
      students ( name ),
      exams (
        name,
        max_marks,
        held_on,
        subjects ( name ),
        batches ( name )
      )
    `)
    .eq("institution_id", centerId)
    .ilike("exams.batches.name", `%${batchName}%`)

  if (examName) {
    query = query.ilike("exams.name", `%${examName}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).filter((r) => r.exams !== null)
}
