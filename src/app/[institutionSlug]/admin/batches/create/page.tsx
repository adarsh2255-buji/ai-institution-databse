'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  registration_no: string | null
  student_class: string | null
  medium: string | null
  batch_id: string | null
  batches: { name: string } | null
}

const CLASS_OPTIONS = [
  'Class I','Class II','Class III','Class IV','Class V','Class VI',
  'Class VII','Class VIII','Class IX','Class X','Class XI','Class XII',
]
const MEDIUM_OPTIONS = ['English','Malayalam','CBSE','ICSE']

export default function CreateBatchPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()

  // Form state
  const [batchName, setBatchName] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedMedium, setSelectedMedium] = useState('')

  // Student list state
  const [students, setStudents] = useState<Student[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [hasFetched, setHasFetched] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Auto-fetch when both class + medium are chosen
  useEffect(() => {
    if (!selectedClass) {
      setStudents([])
      setSelectedIds(new Set())
      setHasFetched(false)
      return
    }
    fetchStudents()
  }, [selectedClass, selectedMedium])

  async function fetchStudents() {
    setFetching(true)
    setFetchError('')
    setSelectedIds(new Set())
    setHasFetched(false)
    try {
      const params = new URLSearchParams({ class: selectedClass })
      if (selectedMedium) params.set('medium', selectedMedium)
      const res = await fetch(`/api/admin/students/filter?${params}`)
      const data = await res.json()
      if (!res.ok) { setFetchError(data.error ?? 'Failed to load students.'); return }
      setStudents(data)
      setHasFetched(true)
    } catch {
      setFetchError('Network error. Try again.')
    } finally {
      setFetching(false)
    }
  }

  // ── Selection helpers ────────────────────────────────────────
  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(students.map(s => s.id)))
    }
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    if (!batchName.trim()) { setSubmitError('Please enter a batch name.'); return }
    if (selectedIds.size === 0) { setSubmitError('Select at least one student.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName.trim(),
          studentIds: Array.from(selectedIds),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? 'Failed to create batch.')
        return
      }
      router.push(`/${institutionSlug}/admin/batches`)
    } catch {
      setSubmitError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const allSelected = students.length > 0 && selectedIds.size === students.length
  const someSelected = selectedIds.size > 0 && !allSelected

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href={`/${institutionSlug}/admin/batches`} className="btn btn-ghost btn-sm">
          ← Back
        </Link>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '2px' }}>Create New Batch</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Name your batch, filter students, then select who to add.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Step 1: Batch Name ─────────────────────────────── */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Step 1 — Batch Name
          </p>
          <div style={{ maxWidth: '400px' }}>
            <label className="form-label" htmlFor="batchName">
              Batch Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="batchName"
              className="input"
              placeholder="e.g. X Boys, X Evening, Physics Batch, Class 10 A…"
              value={batchName}
              onChange={(e) => { setBatchName(e.target.value); setSubmitError('') }}
              required
              maxLength={100}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Be descriptive — include class, section, time, or subject.
            </span>
          </div>
        </div>

        {/* ── Step 2: Filter Students ────────────────────────── */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Step 2 — Filter Students
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', maxWidth: '480px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="classSelect">
                Class <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                id="classSelect"
                className="input"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">Select class…</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mediumSelect">Medium</label>
              <select
                id="mediumSelect"
                className="input"
                value={selectedMedium}
                onChange={(e) => setSelectedMedium(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">All mediums</option>
                {MEDIUM_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {fetchError && (
            <p style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '8px' }}>⚠️ {fetchError}</p>
          )}
        </div>

        {/* ── Step 3: Select Students ────────────────────────── */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Step 3 — Select Students
              {hasFetched && (
                <span style={{ marginLeft: '8px', fontWeight: '400', textTransform: 'none', color: 'var(--text-primary)' }}>
                  ({students.length} found
                  {selectedIds.size > 0 && `, ${selectedIds.size} selected`})
                </span>
              )}
            </p>

            {hasFetched && students.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleAll}
              >
                {allSelected ? '☑ Deselect All' : '☐ Select All'}
              </button>
            )}
          </div>

          {/* States */}
          {!selectedClass ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>👆</div>
              <p style={{ fontSize: '13px' }}>Select a class above to see available students.</p>
            </div>
          ) : fetching ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px', width: '22px', height: '22px', borderWidth: '3px' }} />
              Loading students…
            </div>
          ) : hasFetched && students.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>😶</div>
              <p style={{ fontSize: '13px' }}>
                No active students found for {selectedClass}
                {selectedMedium ? ` · ${selectedMedium}` : ''}.
              </p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>
                Make sure students are approved and have filled their profile with class and medium.
              </p>
            </div>
          ) : hasFetched ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {students.map((s) => {
                const checked = selectedIds.has(s.id)
                return (
                  <label
                    key={s.id}
                    htmlFor={`student-${s.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '12px 14px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${checked ? 'rgba(108,99,255,0.4)' : 'var(--border)'}`,
                      background: checked ? 'var(--accent-dim)' : 'var(--bg-card)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      id={`student-${s.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStudent(s.id)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    {/* Avatar */}
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      background: checked ? 'rgba(108,99,255,0.25)' : 'var(--bg-glass)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: '700', color: 'var(--accent-light)',
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: checked ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {s.registration_no ?? 'No reg no'} · {s.student_class ?? '—'} · {s.medium ?? '—'}
                      </div>
                    </div>

                    {s.batch_id && s.batches && (
                      <span style={{
                        fontSize: '10px', fontWeight: '600', padding: '2px 8px',
                        borderRadius: '20px', background: 'rgba(245,158,11,0.12)',
                        color: 'var(--warning)', flexShrink: 0,
                      }}>
                        In: {s.batches.name}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Error + Submit */}
        {submitError && (
          <div style={{ padding: '12px 14px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)' }}>
            ⚠️ {submitError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            id="create-batch-submit"
            type="submit"
            className="btn btn-primary"
            disabled={submitting || selectedIds.size === 0 || !batchName.trim()}
            style={{ padding: '12px 24px', fontSize: '14px' }}
          >
            {submitting
              ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="spinner" /> Creating…</span>
              : `Create Batch${selectedIds.size > 0 ? ` with ${selectedIds.size} student${selectedIds.size !== 1 ? 's' : ''}` : ''}`
            }
          </button>

          <Link href={`/${institutionSlug}/admin/batches`} className="btn btn-ghost" style={{ padding: '12px 20px' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
