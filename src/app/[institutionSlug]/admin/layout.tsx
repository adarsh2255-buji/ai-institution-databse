import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdmin } from '@supabase/supabase-js'
import AdminSidebar from '@/components/admin/AdminSidebar'

interface Props {
  children: React.ReactNode
  params: Promise<{ institutionSlug: string }>
}

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminLayout({ children, params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('role, name, institutions(id, name, slug)')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['owner', 'admin', 'teacher'].includes(userRecord.role)) {
    redirect('/login')
  }

  const rawInst = userRecord.institutions
  const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as unknown as {
    id: string; name: string; slug: string
  } | null
  if (!institution || institution.slug !== institutionSlug) redirect('/login')

  // Fetch pending enrollment requests count (for admin/owner badge)
  let pendingRequests = 0
  if (['owner', 'admin'].includes(userRecord.role)) {
    const { count } = await supabaseAdmin
      .from('student_requests')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', institution.id)
      .eq('status', 'pending')
    pendingRequests = count ?? 0
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar
        institutionSlug={institutionSlug}
        centerName={institution.name}
        role={userRecord.role as 'owner' | 'admin' | 'teacher'}
        pendingRequests={pendingRequests}
        ownerName={userRecord.name}
      />
      <main style={{ flex: 1, marginLeft: '260px', padding: '32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
