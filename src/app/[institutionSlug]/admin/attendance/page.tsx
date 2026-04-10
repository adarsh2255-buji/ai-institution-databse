'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Student, Batch } from '@/types'

export default function AttendancePage() {
  const supabase = createClient()
  const [centerId, setCenterId] = useState('')
  const [batches, setBatches] = useState<Batch[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent' | 'late'>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const init = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('center_users').select('center_id').eq('user_id', user.id).single()
    if (!m) return
    setCenterId(m.center_id)
    const { data } = await supabase.from('batches').select('*').eq('center_id', m.center_id).order('name')
    setBatches(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!selectedBatch || !centerId) return
    supabase.from('students').select('*').eq('center_id', centerId).eq('batch_id', selectedBatch).order('name')
      .then(async ({ data: studs }) => {
        setStudents(studs ?? [])
        const init: Record<string, 'present' | 'absent' | 'late'> = {}
        ;(studs ?? []).forEach((s) => { init[s.id] = 'present' })

        // Load existing attendance for this date
        const { data: existing } = await supabase.from('attendance')
          .select('student_id, status')
          .eq('center_id', centerId)
          .eq('batch_id', selectedBatch)
          .eq('date', selectedDate)

        ;(existing ?? []).forEach((r) => { init[r.student_id] = r.status as 'present' | 'absent' | 'late' })
        setStatuses(init)
      })
  }, [selectedBatch, selectedDate, centerId, supabase])

  async function handleSave() {
    if (!selectedBatch) return
    setSaving(true)
    const payload = students.map((s) => ({
      center_id: centerId,
      batch_id: selectedBatch,
      student_id: s.id,
      date: selectedDate,
      status: statuses[s.id] ?? 'absent',
    }))
    await supabase.from('attendance').upsert(payload, { onConflict: 'batch_id,student_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const presentCount = Object.values(statuses).filter((s) => s === 'present').length
  const absentCount = Object.values(statuses).filter((s) => s === 'absent').length
  const lateCount = Object.values(statuses).filter((s) => s === 'late').length

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Mark Attendance</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Record daily attendance for each batch</p>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
          <label className="form-label">Batch</label>
          <select id="att-batch" className="input" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
            <option value="">Select batch…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">Date</label>
          <input id="att-date" type="date" className="input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </div>

      {/* Attendance table */}
      {selectedBatch && students.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="badge badge-success">✓ {presentCount} Present</span>
              <span className="badge badge-danger">✗ {absentCount} Absent</span>
              <span className="badge badge-warning">⏰ {lateCount} Late</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {saved && <span className="badge badge-success">✓ Saved</span>}
              <button id="att-mark-all-present" className="btn btn-ghost btn-sm" onClick={() => {
                const all: Record<string, 'present'> = {}
                students.forEach((s) => { all[s.id] = 'present' })
                setStatuses(all)
              }}>All Present</button>
              <button id="att-save" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>

          <table className="data-table">
            <thead><tr><th>#</th><th>Student Name</th><th>Status</th></tr></thead>
            <tbody>
              {students.map((student, idx) => {
                const status = statuses[student.id] ?? 'present'
                return (
                  <tr key={student.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(['present', 'absent', 'late'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: s }))}
                            className={`badge ${
                              s === 'present' ? 'badge-success' :
                              s === 'absent' ? 'badge-danger' : 'badge-warning'
                            }`}
                            style={{
                              border: status === s ? '2px solid currentColor' : '2px solid transparent',
                              cursor: 'pointer',
                              opacity: status === s ? 1 : 0.4,
                              transition: 'all 0.15s',
                            }}
                          >
                            {s === 'present' ? '✓ Present' : s === 'absent' ? '✗ Absent' : '⏰ Late'}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {selectedBatch && students.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>
          No students in this batch. Add students in the Students section.
        </div>
      )}
    </div>
  )
}
