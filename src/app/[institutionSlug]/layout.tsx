import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdmin } from '@supabase/supabase-js'

interface Props {
  children: React.ReactNode
  params: Promise<{ institutionSlug: string }>
}

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function InstitutionLayout({ children, params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check platform admin
  const { data: isPlatformAdmin } = await supabaseAdmin
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (isPlatformAdmin) return <>{children}</>

  // Verify institution membership and slug
  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('role, status, institutions(slug, status)')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.status !== 'active') redirect('/login')

  const rawInst = userRecord.institutions
  const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
    slug: string; status: string
  } | null

  if (!institution || institution.status !== 'active') redirect('/login')
  if (institution.slug !== institutionSlug) redirect('/login')

  return <>{children}</>
}
