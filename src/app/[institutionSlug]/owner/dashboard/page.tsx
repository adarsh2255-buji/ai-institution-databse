import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdmin } from '@supabase/supabase-js'
import OwnerDashboardClient from '@/components/owner/OwnerDashboardClient'

interface Props {
  params: Promise<{ institutionSlug: string }>
}

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function OwnerDashboardPage({ params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify owner role
  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('id, name, role, institution_id, institutions(id, name, slug, location, phone, status, plan_type, created_at)')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['owner'].includes(userRecord.role)) redirect('/login')

  const rawInst = userRecord.institutions
  const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
    id: string; name: string; slug: string; location: string; phone: string
    status: string; plan_type: string; created_at: string
  } | null

  if (!institution || institution.slug !== institutionSlug || institution.status !== 'active') {
    redirect('/login')
  }

  // Fetch counts for overview
  const [
    { count: studentCount },
    { count: adminCount },
    { count: teacherCount },
    { count: parentCount },
  ] = await Promise.all([
    supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', institution.id),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('institution_id', institution.id).eq('role', 'admin'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('institution_id', institution.id).eq('role', 'teacher'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('institution_id', institution.id).eq('role', 'parent'),
  ])

  return (
    <OwnerDashboardClient
      institution={institution}
      ownerName={userRecord.name}
      stats={{ students: studentCount ?? 0, admins: adminCount ?? 0, teachers: teacherCount ?? 0, parents: parentCount ?? 0 }}
    />
  )
}
