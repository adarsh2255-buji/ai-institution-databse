'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fee } from '@/types'

interface StudentOption { id: string; name: string }

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, i, 1)
  return { value: `2025-${String(i + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'long', year: 'numeric' }) }
})

export default function FeesPage() {
  const supabase = createClient()
  const [centerId, setCenterId] = useState('')
  const [fees, setFees] = useState<Fee[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ student_id: '', month: '', amount_due: '', amount_paid: '0', due_date: '', paid_on: '', status: 'pending' })
  const [filterStatus, setFilterStatus] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('center_users').select('center_id').eq('user_id', user.id).single()
    if (!m) return
    setCenterId(m.center_id)
    const [fRes, sRes] = await Promise.all([
      supabase.from('fees').select('*, students(name)').eq('center_id', m.center_id).order('month', { ascending: false }),
      supabase.from('students').select('id, name').eq('center_id', m.center_id).order('name'),
    ])
    setFees(fRes.data ?? [])
    setStudents(sRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('fees').insert({
      center_id: centerId,
      student_id: form.student_id,
      month: form.month,
      amount_due: Number(form.amount_due),
      amount_paid: Number(form.amount_paid),
      due_date: form.due_date || null,
      paid_on: form.paid_on || null,
      status: form.status,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setForm({ student_id: '', month: '', amount_due: '', amount_paid: '0', due_date: '', paid_on: '', status: 'pending' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const filtered = fees.filter((f) => !filterStatus || f.status === filterStatus)
  const totalPending = fees.filter((f) => f.status !== 'paid').reduce((s, f) => s + Number(f.amount_due) - Number(f.amount_paid), 0)

  const STATUS_BADGE: Record<string, string> = {
    paid: 'badge-success', partial: 'badge-warning', pending: 'badge-info', overdue: 'badge-danger',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Fee Management</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Total pending: <strong style={{ color: 'var(--warning)' }}>₹{totalPending.toLocaleString()}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Record Fee'}</button>
      </div>

      {showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Record Fee</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Student *</label>
              <select id="fee-student" className="input" required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select student…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Month *</label>
              <select id="fee-month" className="input" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                <option value="">Select month…</option>
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount Due (₹) *</label>
              <input id="fee-due" type="number" className="input" required placeholder="e.g. 5000" value={form.amount_due} onChange={(e) => setForm({ ...form, amount_due: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount Paid (₹)</label>
              <input id="fee-paid" type="number" className="input" placeholder="0" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status *</label>
              <select id="fee-status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input id="fee-duedate" type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Paid On</label>
              <input id="fee-paidon" type="date" className="input" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
              <button id="fee-save" type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Record'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter + Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          {['', 'pending', 'partial', 'overdue', 'paid'].map((s) => (
            <button key={s} className={`badge ${s ? STATUS_BADGE[s] : 'badge-info'}`}
              style={{ cursor: 'pointer', border: filterStatus === s ? '2px solid currentColor' : '2px solid transparent', opacity: filterStatus === s || filterStatus === '' && s === '' ? 1 : 0.5 }}
              onClick={() => setFilterStatus(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead><tr><th>Student</th><th>Month</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th><th>Due Date</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No records found</td></tr>
                ) : filtered.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{(f.students as { name: string } | null)?.name ?? '—'}</td>
                    <td>{f.month}</td>
                    <td>₹{Number(f.amount_due).toLocaleString()}</td>
                    <td>₹{Number(f.amount_paid).toLocaleString()}</td>
                    <td style={{ color: Number(f.amount_due) - Number(f.amount_paid) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      ₹{(Number(f.amount_due) - Number(f.amount_paid)).toLocaleString()}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[f.status] ?? 'badge-info'}`}>{f.status}</span></td>
                    <td>{f.due_date ?? '—'}</td>
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
