import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatUI from '@/components/chat/ChatUI'

interface Props {
  params: Promise<{ institutionSlug: string }>
}

export default async function ChatPage({ params }: Props) {
  const { institutionSlug: centerSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('center_users')
    .select('role, center_id, centers(name, slug)')
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/login')

  const rawCenter = membership.centers
  const center = (Array.isArray(rawCenter) ? rawCenter[0] : rawCenter) as unknown as { name: string; slug: string } | null
  if (!center || center.slug !== centerSlug) redirect('/login')

  return (
    <ChatUI
      params={{ institutionSlug: centerSlug }}
      role={membership.role as 'admin' | 'teacher' | 'parent'}
      centerName={center.name}
    />
  )
}
