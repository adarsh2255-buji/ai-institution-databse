'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type RequestStatus = 'pending' | 'approved' | 'rejected'

interface EnrollmentRequest {
  id: string
  student_name: string
  parent_name: string
  parent_email: string
  parent_phone: string
  batch_name: string | null
  date_of_birth: string | null
  message: string | null
  status: RequestStatus
  created_at: string
}

interface Batch {
  id: string
  name: string
}

const STATUS_STYLE: Record<RequestStatus, { color: string; bg: string; label: string }> = {
  pending:  { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',     label: 'Pending'  },
  approved: { color: '#10B981', bg: 'rgba(16,185,129,0.12)',    label: 'Approved' },
  rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',      label: 'Rejected' },
}

export default function StudentRequestsPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()

  const [requests, setRequests] = useState<EnrollmentRequest[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [filter, setFilter] = useState<'all' | RequestStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [reqRes, batchRes] = await Promise.all([
      fetch(`/api/student-request?institutionSlug=${institutionSlug}`),
      fetch(`/api/batches?institutionSlug=${institutionSlug}`),
    ])
    if (reqRes.ok) setRequests(await reqRes.json())
    if (batchRes.ok) setBatches(await batchRes.json())
    setLoading(false)
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setProcessingId(id)
    setFlash(null)
    try {
      const res = await fetch(`/api/student-request/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, batchId: selectedBatch[id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFlash({ message: data.error ?? 'Action failed.', type: 'error' })
        return
      }
      setFlash({ message: data.message, type: 'success' })
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r))
      )
    } catch {
      setFlash({ message: 'Network error. Please try again.', type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Enrollment Requests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Review and manage student enrollment applications.
        </p>
      </div>

      {/* Flash message */}
      {flash && (
        <div style={{
          padding: '12px 16px', marginBottom: '20px', borderRadius: 'var(--radius-md)', fontSize: '14px',
          background: flash.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${flash.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: flash.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{flash.type === 'success' ? '✅' : '⚠️'} {flash.message}</span>
          <button onClick={() => setFlash(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => {
          const count = f === 'all' ? requests.length : requests.filter((r) => r.status === f).length
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
                  background: 'var(--warning)', color: 'black',
                  borderRadius: '50%', width: '18px', height: '18px',
                  fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        <div style={{ marginLeft: 'auto' }}>
          <a
            href={`/${institutionSlug}/enroll`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            🔗 Enrollment Link
          </a>
        </div>
      </div>

      {/* Requests list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: '24px', height: '24px', borderWidth: '3px' }} />
          Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <p style={{ fontSize: '15px' }}>No {filter !== 'all' ? filter : ''} enrollment requests.</p>
          {filter === 'pending' && (
            <p style={{ fontSize: '13px', marginTop: '6px' }}>
              Share the enrollment link with parents: <code style={{ color: 'var(--accent)' }}>/{institutionSlug}/enroll</code>
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((req) => {
            const isExpanded = expandedId === req.id
            const style = STATUS_STYLE[req.status]

            return (
              <div key={req.id} className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: '700', color: 'var(--accent-light)',
                  }}>
                    {req.student_name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{req.student_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Parent: {req.parent_name} · {req.parent_email} · {req.parent_phone}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {req.batch_name && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Batch: <strong>{req.batch_name}</strong>
                      </span>
                    )}
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      background: style.bg, color: style.color,
                    }}>
                      {style.label}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Date of Birth', value: req.date_of_birth ? new Date(req.date_of_birth).toLocaleDateString('en-IN') : '—' },
                        { label: 'Requested Batch', value: req.batch_name || '—' },
                        { label: 'Submitted', value: new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                      ].map((item) => (
                        <div key={item.label}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{item.label}</p>
                          <p style={{ fontSize: '13px' }}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {req.message && (
                      <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        💬 {req.message}
                      </div>
                    )}

                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Batch selector for approval */}
                        {batches.length > 0 && (
                          <select
                            className="input"
                            style={{ maxWidth: '220px', padding: '8px 12px', fontSize: '13px' }}
                            value={selectedBatch[req.id] ?? ''}
                            onChange={(e) => setSelectedBatch((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          >
                            <option value="">Assign to batch (optional)</option>
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        )}

                        <button
                          className="btn btn-success btn-sm"
                          disabled={processingId === req.id}
                          onClick={() => handleAction(req.id, 'approve')}
                          style={{ padding: '8px 18px' }}
                        >
                          {processingId === req.id ? <span className="spinner" /> : '✅ Approve & Admit'}
                        </button>

                        <button
                          className="btn btn-sm"
                          disabled={processingId === req.id}
                          onClick={() => handleAction(req.id, 'reject')}
                          style={{ padding: '8px 18px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          {processingId === req.id ? <span className="spinner" /> : '❌ Reject'}
                        </button>
                      </div>
                    )}

                    {req.status === 'approved' && (
                      <div style={{ fontSize: '13px', color: 'var(--success)' }}>
                        ✅ Student has been admitted and added to the students database.
                      </div>
                    )}
                    {req.status === 'rejected' && (
                      <div style={{ fontSize: '13px', color: 'var(--danger)' }}>
                        ❌ This enrollment request was rejected.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
