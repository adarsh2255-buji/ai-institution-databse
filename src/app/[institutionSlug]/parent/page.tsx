import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatUI from '@/components/chat/ChatUI'

interface Props {
  params: Promise<{ institutionSlug: string }>
}

export default async function ParentPage({ params }: Props) {
  const { institutionSlug: centerSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('center_users')
    .select('role, center_id, student_id, centers(name, slug), students(name)')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'parent') redirect('/login')

  const center = (Array.isArray(membership.centers) ? membership.centers[0] : membership.centers) as unknown as { name: string; slug: string } | null
  if (!center || center.slug !== centerSlug) redirect('/login')

  const childName = ((Array.isArray(membership.students) ? membership.students[0] : membership.students) as unknown as { name: string } | null)?.name ?? 'your child'

  return (
    <div>
      {/* Parent-specific banner at top */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(108,99,255,0.1), rgba(56,189,248,0.1))',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <span>👦</span>
        <strong style={{ color: 'var(--text-primary)' }}>Parent View</strong>
        <span>·</span>
        <span>You can ask about <strong style={{ color: 'var(--accent-light)' }}>{childName}</strong>'s marks, attendance, and fees.</span>
      </div>
      <ChatUI
        params={{ institutionSlug: centerSlug }}
        role="parent"
        centerName={center.name}
      />
    </div>
  )
}
