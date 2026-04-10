import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdmin } from '@supabase/supabase-js'
import PlatformDashboardClient from '@/components/platform/PlatformDashboardClient'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function PlatformDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Must be a platform admin
  const { data: adminCheck } = await supabaseAdmin
    .from('platform_admins')
    .select('id, email')
    .eq('id', user.id)
    .single()

  if (!adminCheck) redirect('/login')

  // Fetch all institutions
  const { data: allInstitutions } = await supabaseAdmin
    .from('institutions')
    .select('id, name, slug, location, phone, status, plan_type, created_at')
    .order('created_at', { ascending: false })

  const institutions = allInstitutions ?? []

  const pending = institutions.filter((i) => i.status === 'pending')
  const active = institutions.filter((i) => i.status === 'active')
  const suspended = institutions.filter((i) => i.status === 'suspended')

  return (
    <PlatformDashboardClient
      adminEmail={adminCheck.email}
      institutions={institutions}
      stats={{ pending: pending.length, active: active.length, suspended: suspended.length }}
    />
  )
}
