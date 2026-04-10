import { SupabaseClient } from "@supabase/supabase-js"

export async function findStudentByName(
  supabase: SupabaseClient,
  centerId: string,
  name: string
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, email, phone, enrolled_at, batches(name)")
    .eq("institution_id", centerId)
    .ilike("name", `%${name}%`)
    .limit(5)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listStudentsQuery(
  supabase: SupabaseClient,
  centerId: string,
  batchName?: string,
  searchQuery?: string
) {
  let query = supabase
    .from("students")
    .select("id, name, email, phone, enrolled_at, batches(id, name)")
    .eq("institution_id", centerId)
    .order("name", { ascending: true })

  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let results = data ?? []
  if (batchName) {
    results = results.filter((s) => {
      const batch = (Array.isArray(s.batches) ? s.batches[0] : s.batches) as unknown as { name: string } | null
      return batch?.name?.toLowerCase().includes(batchName.toLowerCase())
    })
  }

  return results
}
