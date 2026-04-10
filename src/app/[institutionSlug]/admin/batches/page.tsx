'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Batch {
  id: string
  name: string
  created_at: string
  student_count: number
}

export default function BatchesPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/batches')
    if (res.ok) setBatches(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = batches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Batches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {batches.length} batch{batches.length !== 1 ? 'es' : ''} — organise students by class, section, or subject.
          </p>
        </div>
        <Link href={`/${institutionSlug}/admin/batches/create`} className="btn btn-primary">
          + Create Batch
        </Link>
      </div>

      {batches.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <input className="input" placeholder="🔍  Search batches…" value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: '280px' }} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: '24px', height: '24px', borderWidth: '3px' }} />
          Loading batches…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '14px' }}>🏫</div>
          <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px' }}>
            {search ? 'No batches match your search' : 'No batches yet'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            {!search && 'Create your first batch to organise approved students into groups.'}
          </p>
          {!search && (
            <Link href={`/${institutionSlug}/admin/batches/create`} className="btn btn-primary" style={{ display: 'inline-flex' }}>
              + Create First Batch
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {filtered.map((b) => (
            <div key={b.id} className="glass-card stat-card animate-fade-in" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '18px',
                }}>🏷️</div>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-light)' }}>
                  {b.student_count}
                  <span style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '3px' }}>
                    student{b.student_count !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{b.name}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Created {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
