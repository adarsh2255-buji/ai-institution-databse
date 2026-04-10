'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Institution = {
  id: string; name: string; slug: string; location: string; phone: string
  status: 'pending' | 'active' | 'suspended'; plan_type: string; created_at: string
}

interface Props {
  adminEmail: string
  institutions: Institution[]
  stats: { pending: number; active: number; suspended: number }
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308',
  active: '#10B981',
  suspended: '#EF4444',
}

const STATUS_BG: Record<string, string> = {
  pending: 'rgba(234,179,8,0.12)',
  active: 'rgba(16,185,129,0.12)',
  suspended: 'rgba(239,68,68,0.1)',
}

export default function PlatformDashboardClient({ adminEmail, institutions, stats }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [localData, setLocalData] = useState<Institution[]>(institutions)

  const filtered = filter === 'all' ? localData : localData.filter((i) => i.status === filter)

  async function handleAction(id: string, action: 'approve' | 'suspend') {
    setLoading(id)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/approve-institution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          institution_id: id,
          action: action === 'approve' ? 'approve' : 'suspend',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMessage(`Error: ${data.error}`)
        return
      }
      setMessage(data.message)
      setLocalData((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: action === 'approve' ? 'active' : 'suspended' }
            : i
        )
      )
    } catch {
      setMessage('Network error.')
    } finally {
      setLoading(null)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>🔴</span>
          <div>
            <span style={{ fontWeight: '700', fontSize: '16px' }}>EduAI Platform Admin</span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{adminEmail}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn btn-ghost btn-sm">Sign out</button>
      </header>

      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Pending Approval', value: stats.pending, color: '#EAB308', icon: '⏳' },
            { label: 'Active Institutions', value: stats.active, color: '#10B981', icon: '✅' },
            { label: 'Suspended', value: stats.suspended, color: '#EF4444', icon: '🚫' },
          ].map((s) => (
            <div key={s.label} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '22px' }}>{s.icon}</span>
                <span style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Flash message */}
        {message && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px',
            background: message.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${message.startsWith('Error') ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
            borderRadius: 'var(--radius-md)', fontSize: '14px',
            color: message.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
          }}>
            {message}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['all', 'pending', 'active', 'suspended'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '7px 16px', fontSize: '13px', textTransform: 'capitalize' }}
            >
              {f} {f !== 'all' && `(${localData.filter((i) => i.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Institutions table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Institution', 'Location', 'Phone', 'Plan', 'Status', 'Registered', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    No institutions found.
                  </td>
                </tr>
              ) : filtered.map((inst) => (
                <tr key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: '600' }}>{inst.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/{inst.slug}</div>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{inst.location}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{inst.phone}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{inst.plan_type}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      background: STATUS_BG[inst.status], color: STATUS_COLORS[inst.status],
                      textTransform: 'capitalize',
                    }}>
                      {inst.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(inst.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {inst.status !== 'active' && (
                        <button
                          onClick={() => handleAction(inst.id, 'approve')}
                          disabled={loading === inst.id}
                          className="btn btn-success btn-sm"
                          style={{ padding: '5px 12px', fontSize: '12px' }}
                        >
                          {loading === inst.id ? '…' : '✅ Approve'}
                        </button>
                      )}
                      {inst.status !== 'suspended' && (
                        <button
                          onClick={() => handleAction(inst.id, 'suspend')}
                          disabled={loading === inst.id}
                          className="btn btn-sm"
                          style={{ padding: '5px 12px', fontSize: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          {loading === inst.id ? '…' : '🚫 Suspend'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
