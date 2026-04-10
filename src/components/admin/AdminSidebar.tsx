'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'owner' | 'admin' | 'teacher'

interface Props {
  institutionSlug: string
  centerName: string
  role: Role
  pendingRequests?: number // badge count for admin
  ownerName?: string
}

interface NavItem {
  href: string
  icon: string
  label: string
  roles: Role[]          // which roles can see this item
  badge?: number         // notification count
  section?: string       // section header label
}

const ROLE_BADGE: Record<Role, { label: string; cls: string }> = {
  owner:   { label: 'Owner',   cls: 'badge-accent' },
  admin:   { label: 'Admin',   cls: 'badge-info'   },
  teacher: { label: 'Teacher', cls: 'badge-success' },
}

export default function AdminSidebar({
  institutionSlug,
  centerName,
  role,
  pendingRequests = 0,
  ownerName,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const base = `/${institutionSlug}/admin`

  const navItems: NavItem[] = [
    // ── Overview ──────────────────────────────────────────
    {
      href: base,
      icon: '📊',
      label: 'Dashboard',
      roles: ['owner', 'admin', 'teacher'],
      section: 'Overview',
    },

    // ── Students & Enrollment ──────────────────────────────
    {
      href: `${base}/requests`,
      icon: '📨',
      label: 'Enrollment Requests',
      roles: ['owner', 'admin'],
      badge: pendingRequests || undefined,
      section: 'Students',
    },
    {
      href: `${base}/students`,
      icon: '👤',
      label: 'Students',
      roles: ['owner', 'admin'],
    },

    // ── Academic ───────────────────────────────────────────
    {
      href: `${base}/batches`,
      icon: '🏫',
      label: 'Batches',
      roles: ['owner', 'admin', 'teacher'],
      section: 'Academic',
    },
    {
      href: `${base}/subjects`,
      icon: '📚',
      label: 'Subjects',
      roles: ['owner', 'admin', 'teacher'],
    },
    {
      href: `${base}/exams`,
      icon: '📝',
      label: 'Exams',
      roles: ['owner', 'admin', 'teacher'],
    },
    {
      href: `${base}/marks`,
      icon: '🏆',
      label: 'Marks Entry',
      roles: ['owner', 'admin', 'teacher'],
    },
    {
      href: `${base}/attendance`,
      icon: '📅',
      label: 'Attendance',
      roles: ['owner', 'admin', 'teacher'],
    },

    // ── Finance ────────────────────────────────────────────
    {
      href: `${base}/fees`,
      icon: '💰',
      label: 'Fees',
      roles: ['owner', 'admin'],
      section: 'Finance',
    },

    // ── AI ────────────────────────────────────────────────
    {
      href: `/${institutionSlug}/chat`,
      icon: '💬',
      label: 'AI Assistant',
      roles: ['owner', 'admin', 'teacher'],
      section: 'Tools',
    },
  ]

  // Owner also gets a link back to their dashboard
  const ownerLinks: NavItem[] = role === 'owner' ? [
    {
      href: `/${institutionSlug}/owner/dashboard`,
      icon: '🏠',
      label: 'Owner Dashboard',
      roles: ['owner'],
      section: 'Institution',
    },
  ] : []

  const allItems = [...ownerLinks, ...navItems].filter((item) => item.roles.includes(role))

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Group items by section
  const sections: { title: string; items: NavItem[] }[] = []
  let currentSection = { title: '', items: [] as NavItem[] }

  for (const item of allItems) {
    if (item.section && item.section !== currentSection.title) {
      if (currentSection.items.length > 0) sections.push({ ...currentSection })
      currentSection = { title: item.section, items: [item] }
    } else {
      currentSection.items.push(item)
    }
  }
  if (currentSection.items.length > 0) sections.push(currentSection)

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px' }}>🎓</span>
          <span style={{ fontWeight: '700', fontSize: '15px' }}>EduAI</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {centerName}
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {sections.map((section) => (
          <div key={section.title}>
            {section.title && (
              <p style={{ padding: '10px 10px 4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== base && item.href !== `/${institutionSlug}/owner/dashboard` && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span style={{
                      background: 'var(--danger)', color: 'white',
                      borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                      padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                    }}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        {ownerName && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ownerName}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className={`badge ${ROLE_BADGE[role].cls}`} style={{ fontSize: '11px' }}>
            {ROLE_BADGE[role].label}
          </span>
          <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
