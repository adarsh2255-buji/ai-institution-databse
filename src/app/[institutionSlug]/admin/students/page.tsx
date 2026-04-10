'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Student {
  id: string
  name: string
  registration_no: string | null
  student_class: string | null
  dob: string | null
  email: string | null
  phone: string | null
  status: 'pending' | 'active' | 'suspended' | null
  enrolled_at: string | null
  batches: { name: string } | null
}

interface Batch { id: string; name: string }

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',     label: 'Pending'   },
  active:    { color: '#10B981', bg: 'rgba(16,185,129,0.12)',    label: 'Active'    },
  suspended: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',      label: 'Suspended' },
}

export default function StudentsPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()

  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, bRes] = await Promise.all([
      fetch('/api/admin/students'),
      fetch(`/api/batches?institutionSlug=${institutionSlug}`),
    ])
    if (sRes.ok) setStudents(await sRes.json())
    if (bRes.ok) setBatches(await bRes.json())
    setLoading(false)
  }, [institutionSlug])

  useEffect(() => { load() }, [load])

  async function handleApproval(studentId: string, action: 'approve' | 'suspend') {
    setProcessingId(studentId)
    setFlash(null)
    try {
      const res = await fetch(`/api/admin/student/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFlash({ message: data.error ?? 'Action failed.', type: 'error' })
        return
      }
      setFlash({ message: data.message, type: 'success' })
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, status: action === 'approve' ? 'active' : 'suspended' } : s
        )
      )
    } catch {
      setFlash({ message: 'Network error.', type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const pendingCount = students.filter((s) => s.status === 'pending').length

  const filtered = students
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registration_no ?? '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Students</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {students.length} total
            {pendingCount > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--warning)', fontWeight: '600' }}>
                · {pendingCount} pending approval
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a
            href={`/register/${institutionSlug}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            🔗 Registration Link
          </a>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{
          padding: '12px 16px', marginBottom: '18px', borderRadius: 'var(--radius-md)', fontSize: '13px',
          background: flash.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${flash.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: flash.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{flash.type === 'success' ? '✅' : '⚠️'} {flash.message}</span>
          <button onClick={() => setFlash(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-muted)' }}>×</button>
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center' }}>
        {(['all', 'pending', 'active', 'suspended'] as const).map((f) => {
          const count = f === 'all' ? students.length : students.filter((s) => s.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize', position: 'relative' }}
            >
              {f} ({count})
              {f === 'pending' && count > 0 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  background: 'var(--warning)', color: 'black', borderRadius: '50%',
                  width: '16px', height: '16px', fontSize: '9px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{count}</span>
              )}
            </button>
          )
        })}
        <input
          className="input"
          placeholder="🔍 Search name or reg. no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '240px', marginLeft: 'auto' }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px', width: '22px', height: '22px', borderWidth: '3px' }} />
            Loading students…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
            <p>No {filter !== 'all' ? filter : ''} students found.</p>
            {filter === 'all' && (
              <p style={{ fontSize: '12px', marginTop: '6px' }}>
                Share the registration link: <code style={{ color: 'var(--accent-light)' }}>/register/{institutionSlug}</code>
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Reg. No.</th>
                  <th>Class</th>
                  <th>Date of Birth</th>
                  <th>Batch</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const statusStyle = STATUS_STYLE[s.status ?? 'pending']
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--accent-light)',
                          }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{s.name}</span>
                        </div>
                      </td>
                      <td>
                        {s.registration_no ? (
                          <code style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '13px', fontWeight: '700',
                            color: 'var(--accent-light)',
                            background: 'var(--accent-dim)',
                            padding: '2px 8px', borderRadius: '4px',
                          }}>{s.registration_no}</code>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '13px' }}>{s.student_class ?? '—'}</td>
                      <td>
                        {s.dob
                          ? new Date(s.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>{s.batches?.name ?? '—'}</td>
                      <td style={{ fontSize: '12px' }}>
                        {s.enrolled_at
                          ? new Date(s.enrolled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                          background: statusStyle.bg, color: statusStyle.color,
                        }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(s.status === 'pending' || s.status === 'suspended') && (
                            <button
                              className="btn btn-success btn-sm"
                              disabled={processingId === s.id}
                              onClick={() => handleApproval(s.id, 'approve')}
                              style={{ fontSize: '11px', padding: '5px 10px' }}
                            >
                              {processingId === s.id ? <span className="spinner" /> : '✅ Approve'}
                            </button>
                          )}
                          {s.status === 'active' && (
                            <button
                              className="btn btn-sm"
                              disabled={processingId === s.id}
                              onClick={() => handleApproval(s.id, 'suspend')}
                              style={{ fontSize: '11px', padding: '5px 10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                            >
                              {processingId === s.id ? <span className="spinner" /> : '🚫 Suspend'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
