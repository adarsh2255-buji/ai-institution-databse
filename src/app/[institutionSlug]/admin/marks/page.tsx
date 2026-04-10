'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Student, Batch, Mark } from '@/types'

export default function MarksPage() {
  const supabase = createClient()
  const [centerId, setCenterId] = useState('')
  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [existingMarks, setExistingMarks] = useState<Record<string, Partial<Mark>>>({})
  const [scores, setScores] = useState<Record<string, { value: string; absent: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const init = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('center_users').select('center_id').eq('user_id', user.id).single()
    if (!m) return
    setCenterId(m.center_id)
    const [bRes, eRes] = await Promise.all([
      supabase.from('batches').select('*').eq('center_id', m.center_id).order('name'),
      supabase.from('exams').select('*, batches(name), subjects(name)').eq('center_id', m.center_id).order('held_on', { ascending: false }),
    ])
    setBatches(bRes.data ?? [])
    setExams(eRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!selectedBatch) { setStudents([]); setScores({}); return }
    supabase.from('students').select('*').eq('center_id', centerId).eq('batch_id', selectedBatch).order('name')
      .then(({ data }) => {
        setStudents(data ?? [])
        const init: Record<string, { value: string; absent: boolean }> = {}
        ;(data ?? []).forEach((s) => { init[s.id] = { value: '', absent: false } })
        setScores(init)
      })
  }, [selectedBatch, centerId, supabase])

  useEffect(() => {
    if (!selectedExam || students.length === 0) return
    supabase.from('marks').select('*').eq('exam_id', selectedExam).in('student_id', students.map((s) => s.id))
      .then(({ data }) => {
        const existing: Record<string, Partial<Mark>> = {}
        ;(data ?? []).forEach((m) => { existing[m.student_id] = m })
        setExistingMarks(existing)
        const updated: Record<string, { value: string; absent: boolean }> = {}
        students.forEach((s) => {
          const ex = existing[s.id]
          updated[s.id] = { value: ex?.marks_obtained?.toString() ?? '', absent: ex?.absent ?? false }
        })
        setScores(updated)
      })
  }, [selectedExam, students, supabase])

  const selectedExamObj = exams.find((e) => e.id === selectedExam)

  async function handleSave() {
    if (!selectedExam) return
    setSaving(true)
    const upsertPayload = students.map((s) => ({
      center_id: centerId,
      exam_id: selectedExam,
      student_id: s.id,
      marks_obtained: scores[s.id]?.absent ? null : Number(scores[s.id]?.value) || null,
      absent: scores[s.id]?.absent ?? false,
      ...(existingMarks[s.id]?.id ? { id: existingMarks[s.id].id } : {}),
    }))
    await supabase.from('marks').upsert(upsertPayload, { onConflict: 'exam_id,student_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Marks Entry</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Enter exam scores for students</p>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
          <label className="form-label">Select Batch</label>
          <select id="marks-batch" className="input" value={selectedBatch} onChange={(e) => { setSelectedBatch(e.target.value); setSelectedExam('') }}>
            <option value="">Choose batch…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
          <label className="form-label">Select Exam</label>
          <select id="marks-exam" className="input" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled={!selectedBatch}>
            <option value="">Choose exam…</option>
            {exams.filter((e) => !selectedBatch || (e.batches as { name?: string } | null) && e.batch_id === selectedBatch)
              .map((e) => <option key={e.id} value={e.id}>{e.name} — {(e.subjects as {name:string}|null)?.name} ({new Date(e.held_on).toLocaleDateString()})</option>)}
          </select>
        </div>
      </div>

      {/* Marks table */}
      {selectedExam && selectedExamObj && students.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: '600' }}>{selectedExamObj.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '12px' }}>
                Max: {selectedExamObj.max_marks} marks · {students.length} students
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {saved && <span className="badge badge-success">✓ Saved</span>}
              <button id="marks-save" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save All Marks'}
              </button>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Student Name</th><th>Marks (/{selectedExamObj.max_marks})</th><th>Absent</th><th>%</th></tr></thead>
            <tbody>
              {students.map((student, idx) => {
                const sc = scores[student.id] ?? { value: '', absent: false }
                const pct = !sc.absent && sc.value ? Math.round((Number(sc.value) / selectedExamObj.max_marks) * 100) : null
                return (
                  <tr key={student.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.name}</td>
                    <td>
                      <input
                        type="number" min={0} max={selectedExamObj.max_marks}
                        className="input" style={{ width: '100px', padding: '8px 12px' }}
                        value={sc.value} disabled={sc.absent}
                        placeholder="—"
                        onChange={(e) => setScores((prev) => ({ ...prev, [student.id]: { ...sc, value: e.target.value } }))}
                      />
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sc.absent}
                          onChange={(e) => setScores((prev) => ({ ...prev, [student.id]: { value: '', absent: e.target.checked } }))} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Absent</span>
                      </label>
                    </td>
                    <td>
                      {sc.absent ? <span className="badge badge-danger">Absent</span>
                        : pct !== null ? <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>{pct}%</span>
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedExam && students.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>
          No students in selected batch. Add students first.
        </div>
      )}
    </div>
  )
}
