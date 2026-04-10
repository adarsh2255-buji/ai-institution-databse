import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Link from 'next/link'

interface StatCard {
  icon: string
  label: string
  value: number | string
  href: string
  accent?: string
}

interface QuickAction {
  icon: string
  label: string
  href: string
  highlight?: boolean
}

interface Props {
  params: Promise<{ institutionSlug: string }>
}

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminDashboard({ params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('institution_id, role, name')
    .eq('id', user!.id)
    .single()

  const institutionId = userRecord?.institution_id
  const role = userRecord?.role as 'owner' | 'admin' | 'teacher'
  const firstName = (userRecord?.name ?? '').split(' ')[0]

  // ── Fetch data relevant to the role ───────────────────────
  const [studentsRes, batchesRes, pendingReqRes, pendingFeesRes] = await Promise.all([
    supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
    supabaseAdmin.from('batches').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
    ['owner', 'admin'].includes(role)
      ? supabaseAdmin.from('student_requests').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    ['owner', 'admin'].includes(role)
      ? supabaseAdmin.from('fees').select('amount_due, amount_paid').eq('institution_id', institutionId).in('status', ['pending', 'overdue'])
      : Promise.resolve({ data: [] }),
  ])

  const totalStudents = studentsRes.count ?? 0
  const totalBatches = batchesRes.count ?? 0
  const pendingRequests = (pendingReqRes as { count: number | null }).count ?? 0
  const pendingFeeAmount = ((pendingFeesRes as { data: { amount_due: number; amount_paid: number }[] | null }).data ?? [])
    .reduce((sum, f) => sum + Number(f.amount_due) - Number(f.amount_paid), 0)

  const base = `/${institutionSlug}/admin`

  // ── Role-based stat cards ──────────────────────────────────
  const adminStats: StatCard[] = [
    { icon: '📨', label: 'Pending Requests', value: pendingRequests, href: `${base}/requests`, accent: pendingRequests > 0 ? 'var(--warning)' : undefined },
    { icon: '👤', label: 'Total Students',   value: totalStudents,   href: `${base}/students`  },
    { icon: '🏫', label: 'Active Batches',   value: totalBatches,    href: `${base}/batches`   },
    { icon: '💰', label: 'Pending Dues',     value: `₹${pendingFeeAmount.toLocaleString('en-IN')}`, href: `${base}/fees`, accent: pendingFeeAmount > 0 ? 'var(--danger)' : undefined },
  ]

  const teacherStats: StatCard[] = [
    { icon: '👤', label: 'Total Students', value: totalStudents, href: `${base}/students`   },
    { icon: '🏫', label: 'My Batches',     value: totalBatches,  href: `${base}/batches`    },
    { icon: '💬', label: 'AI Assistant',   value: 'Ask anything', href: `/${institutionSlug}/chat` },
  ]

  const stats: StatCard[] = ['owner', 'admin'].includes(role) ? adminStats : teacherStats

  // ── Role-based quick actions ───────────────────────────────
  const adminQuickActions: QuickAction[] = [
    { icon: '📨', label: 'Review Requests',  href: `${base}/requests`,   highlight: pendingRequests > 0 },
    { icon: '📅', label: 'Take Attendance',  href: `${base}/attendance`  },
    { icon: '💰', label: 'Collect Fee',      href: `${base}/fees`        },
    { icon: '🏆', label: 'Enter Marks',      href: `${base}/marks`       },
  ]

  const teacherQuickActions: QuickAction[] = [
    { icon: '📅', label: 'Take Attendance',  href: `${base}/attendance` },
    { icon: '📝', label: 'Create Exam',      href: `${base}/exams`      },
    { icon: '🏆', label: 'Enter Marks',      href: `${base}/marks`      },
    { icon: '💬', label: 'AI Assistant',     href: `/${institutionSlug}/chat` },
  ]

  const quickActions: QuickAction[] = ['owner', 'admin'].includes(role) ? adminQuickActions : teacherQuickActions

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    admin: 'Administrator',
    teacher: 'Teacher',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
          Welcome back, {firstName} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          {roleLabel[role]} dashboard — here&apos;s a quick overview.
        </p>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {stats.map((s, i) => (
          <Link
            key={i}
            href={s.href}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, textDecoration: 'none', position: 'relative' }}
          >
            {s.accent && (
              <div style={{ position: 'absolute', top: '12px', right: '14px', width: '8px', height: '8px', borderRadius: '50%', background: s.accent }} />
            )}
            <div style={{ fontSize: '26px', marginBottom: '12px' }}>{s.icon}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px', color: s.accent ?? 'var(--text-primary)' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {quickActions.map((q, i) => (
            <Link
              key={i}
              href={q.href}
              className="btn btn-ghost"
              style={{
                justifyContent: 'flex-start',
                padding: '14px 16px',
                border: `1px solid ${q.highlight ? 'var(--warning)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: q.highlight ? 'rgba(245,158,11,0.08)' : undefined,
              }}
            >
              <span style={{ fontSize: '18px' }}>{q.icon}</span>
              <span style={{ fontSize: '13px' }}>{q.label}</span>
              {q.highlight && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', color: 'var(--warning)' }}>
                  NEW
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Teacher-specific note */}
      {role === 'teacher' && (
        <div style={{
          padding: '16px 20px',
          background: 'var(--info-dim)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--info)',
        }}>
          💡 As a teacher you can manage your batches, record attendance, create exams, and enter marks. Use the AI Assistant to get quick insights about student performance.
        </div>
      )}
    </div>
  )
}
