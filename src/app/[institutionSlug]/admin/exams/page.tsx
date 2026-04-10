'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Batch, Subject } from '@/types'

export default function ExamsPage() {
  const supabase = createClient()
  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [centerId, setCenterId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', batch_id: '', subject_id: '', max_marks: '', held_on: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('center_users').select('center_id').eq('user_id', user.id).single()
    if (!m) return
    setCenterId(m.center_id)
    const [eRes, bRes, sRes] = await Promise.all([
      supabase.from('exams').select('*, batches(name), subjects(name)').eq('center_id', m.center_id).order('held_on', { ascending: false }),
      supabase.from('batches').select('*').eq('center_id', m.center_id).order('name'),
      supabase.from('subjects').select('*').eq('center_id', m.center_id).order('name'),
    ])
    setExams(eRes.data ?? [])
    setBatches(bRes.data ?? [])
    setSubjects(sRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.batch_id || !form.subject_id) { setError('Please select batch and subject'); return }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('exams').insert({
      name: form.name, batch_id: form.batch_id, subject_id: form.subject_id,
      max_marks: Number(form.max_marks), held_on: form.held_on, center_id: centerId,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setForm({ name: '', batch_id: '', subject_id: '', max_marks: '', held_on: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  // Filter subjects for selected batch
  const filteredSubjects = form.batch_id
    ? subjects.filter((s) => !s.batch_id || s.batch_id === form.batch_id)
    : subjects

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Exams</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Schedule and track exam events</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Schedule Exam'}</button>
      </div>

      {showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>New Exam</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Exam Name *</label>
              <input id="exam-name" className="input" required placeholder="e.g. Unit Test 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch *</label>
              <select id="exam-batch" className="input" required value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value, subject_id: '' })}>
                <option value="">Select batch…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <select id="exam-subject" className="input" required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">Select subject…</option>
                {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max Marks *</label>
              <input id="exam-maxmarks" type="number" className="input" required placeholder="100" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Date Held *</label>
              <input id="exam-date" type="date" className="input" required value={form.held_on} onChange={(e) => setForm({ ...form, held_on: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
              <button id="exam-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Schedule'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead><tr><th>Exam Name</th><th>Batch</th><th>Subject</th><th>Max Marks</th><th>Date</th></tr></thead>
              <tbody>
                {exams.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No exams scheduled</td></tr>
                ) : exams.map((ex) => (
                  <tr key={ex.id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{ex.name}</td>
                    <td>{(ex.batches as { name: string } | null)?.name ?? '—'}</td>
                    <td>{(ex.subjects as { name: string } | null)?.name ?? '—'}</td>
                    <td>{ex.max_marks}</td>
                    <td>{new Date(ex.held_on).toLocaleDateString()}</td>
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
