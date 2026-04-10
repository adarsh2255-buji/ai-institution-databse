'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Subject, Batch } from '@/types'

export default function SubjectsPage() {
  const supabase = createClient()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [centerId, setCenterId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', batch_id: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('center_users').select('center_id').eq('user_id', user.id).single()
    if (!m) return
    setCenterId(m.center_id)
    const [sRes, bRes] = await Promise.all([
      supabase.from('subjects').select('*, batches(name)').eq('center_id', m.center_id).order('name'),
      supabase.from('batches').select('*').eq('center_id', m.center_id).order('name'),
    ])
    setSubjects(sRes.data ?? [])
    setBatches(bRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('subjects').insert({ name: form.name, batch_id: form.batch_id || null, center_id: centerId })
    if (error) { setError(error.message); setSaving(false); return }
    setForm({ name: '', batch_id: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Subjects</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Subjects offered in your center</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Subject'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>New Subject</h2>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">Subject Name *</label>
              <input id="subject-name" className="input" required placeholder="e.g. Mathematics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">Batch (optional)</label>
              <select id="subject-batch" className="input" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">All batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button id="subject-save" type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-end' }}>{saving ? 'Saving…' : 'Add Subject'}</button>
          </form>
          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Batch</th></tr></thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No subjects yet</td></tr>
                ) : subjects.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{s.name}</td>
                    <td>{(s.batches as { name: string } | null)?.name ?? 'All batches'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
