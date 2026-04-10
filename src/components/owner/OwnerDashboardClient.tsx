'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Institution {
  id: string; name: string; slug: string; location: string; phone: string
  status: string; plan_type: string; created_at: string
}

interface Props {
  institution: Institution
  ownerName: string
  stats: { students: number; admins: number; teachers: number; parents: number }
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--accent)',
  teacher: 'var(--info)',
  parent: 'var(--success)',
}

export default function OwnerDashboardClient({ institution, ownerName, stats }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const slug = institution.slug

  const [showAddUser, setShowAddUser] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')
    setAddLoading(true)

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, institutionId: institution.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setAddError(data.error ?? 'Failed to create user.')
        return
      }
      setAddSuccess(`${addForm.role.charAt(0).toUpperCase() + addForm.role.slice(1)} "${addForm.name}" created successfully.`)
      setAddForm({ name: '', email: '', password: '', role: 'admin' })
    } catch {
      setAddError('Network error.')
    } finally {
      setAddLoading(false)
    }
  }

  const navLinks = [
    { href: `/${slug}/owner/dashboard`, label: 'Dashboard', icon: '📊', active: true },
    { href: `/${slug}/admin/students`, label: 'Students', icon: '👨‍🎓' },
    { href: `/${slug}/admin/batches`, label: 'Batches', icon: '📚' },
    { href: `/${slug}/admin/subjects`, label: 'Subjects', icon: '📖' },
    { href: `/${slug}/admin/exams`, label: 'Exams', icon: '📝' },
    { href: `/${slug}/admin/marks`, label: 'Marks', icon: '🏆' },
    { href: `/${slug}/admin/attendance`, label: 'Attendance', icon: '📅' },
    { href: `/${slug}/admin/fees`, label: 'Fees', icon: '💰' },
    { href: `/${slug}/chat`, label: 'AI Chat', icon: '💬' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px', background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)', display: 'flex',
        flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px' }}>🎓</span>
            <span style={{ fontWeight: '700', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {institution.name}
            </span>
          </div>
          <div style={{ marginLeft: '32px' }}>
            <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 7px' }}>
              {institution.plan_type.toUpperCase()}
            </span>
            <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {institution.location}
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-item${link.active ? ' active' : ''}`}
            >
              <span>{link.icon}</span> {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '10px' }}>
            <span className="badge badge-accent" style={{ fontSize: '11px', padding: '2px 8px' }}>Owner</span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ownerName}
            </p>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: '12px' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>
            Welcome back, {ownerName.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {institution.name} · {institution.location} · {institution.phone}
          </p>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Students', value: stats.students, icon: '👨‍🎓', color: 'var(--accent)' },
            { label: 'Admins', value: stats.admins, icon: '🛡️', color: 'var(--info)' },
            { label: 'Teachers', value: stats.teachers, icon: '👩‍🏫', color: '#10B981' },
            { label: 'Parents', value: stats.parents, icon: '👪', color: '#F59E0B' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>{stat.icon}</span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: stat.color }}>{stat.value}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Quick Actions */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Add New Student', href: `/${slug}/admin/students`, icon: '➕' },
                { label: 'Mark Attendance', href: `/${slug}/admin/attendance`, icon: '📅' },
                { label: 'Enter Exam Marks', href: `/${slug}/admin/marks`, icon: '📝' },
                { label: 'Manage Fees', href: `/${slug}/admin/fees`, icon: '💰' },
                { label: 'Ask AI Assistant', href: `/${slug}/chat`, icon: '💬' },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="nav-item" style={{ padding: '10px 14px' }}>
                  <span>{a.icon}</span> {a.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Add Team Member */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Add Team Member</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowAddUser(!showAddUser); setAddError(''); setAddSuccess('') }}
                style={{ fontSize: '12px' }}
              >
                {showAddUser ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {!showAddUser ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Add admins, teachers, and parents to your institution. Each member gets their own login credentials and role-based access.
              </p>
            ) : (
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {addError && (
                  <p style={{ fontSize: '13px', color: 'var(--danger)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠️ {addError}
                  </p>
                )}
                {addSuccess && (
                  <p style={{ fontSize: '13px', color: 'var(--success)', padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    ✅ {addSuccess}
                  </p>
                )}

                <select
                  className="input"
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  style={{ fontSize: '13px', padding: '10px' }}
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                </select>

                <input
                  className="input"
                  placeholder="Full Name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Temporary password (min 8 chars)"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />

                <button type="submit" className="btn btn-primary btn-sm" disabled={addLoading}>
                  {addLoading ? 'Creating…' : `Create ${addForm.role.charAt(0).toUpperCase() + addForm.role.slice(1)}`}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Institution Info */}
        <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Institution Info</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Institution Name', value: institution.name },
              { label: 'Slug / URL', value: `/${institution.slug}` },
              { label: 'Location', value: institution.location },
              { label: 'Phone', value: institution.phone },
              { label: 'Plan', value: institution.plan_type.charAt(0).toUpperCase() + institution.plan_type.slice(1) },
              { label: 'Registered', value: new Date(institution.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: '14px', fontWeight: '500' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
