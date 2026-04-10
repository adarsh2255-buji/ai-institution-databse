import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdmin } from '@supabase/supabase-js'

interface Props {
  params: Promise<{ institutionSlug: string }>
}

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function DashboardRouter({ params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('role, status, institution_id, institutions(slug, status)')
    .eq('id', user.id)
    .single()

  if (!userRecord) redirect('/login')

  const rawInst = userRecord.institutions
  const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
    slug: string; status: string
  } | null

  if (!institution || institution.status !== 'active') redirect('/login')
  if (institution.slug !== institutionSlug) redirect('/login')

  // Route by role
  switch (userRecord.role) {
    case 'owner':
      redirect(`/${institutionSlug}/owner/dashboard`)
    case 'admin':
    case 'teacher':
      redirect(`/${institutionSlug}/admin`)
    case 'parent':
      redirect(`/${institutionSlug}/parent`)
    default:
      redirect('/login')
  }
}
