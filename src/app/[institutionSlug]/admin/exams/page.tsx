'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Batch {
  id: string
  name: string
  student_count: number
}

interface Exam {
  id: string
  name: string
  date: string
  status: string
  batches: { name: string, class: string }
}

export default function ExamsDashboard() {
  const router = useRouter()
  const { institutionSlug } = useParams()
  
  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // Create Modal State
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    batch_id: '',
    date: new Date().toISOString().split('T')[0],
    duration: '2 Hours',
    pass_percentage: '40'
  })
  
  const [subjects, setSubjects] = useState([{ name: '', total_marks: '100' }])
  const [grades, setGrades] = useState([
    { grade: 'A', min: 80, max: 100 },
    { grade: 'B', min: 60, max: 79 },
    { grade: 'C', min: 40, max: 59 },
    { grade: 'F', min: 0, max: 39 }
  ])

  const init = useCallback(async () => {
    try {
      const [resExams, resBatches] = await Promise.all([
        fetch('/api/exams'),
        fetch('/api/admin/batches')
      ])
      
      if (resExams.ok) setExams(await resExams.json())
      if (resBatches.ok) setBatches(await resBatches.json())
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { init() }, [init])

  const handleCreate = async () => {
    setError('')
    if (!form.name || !form.batch_id || !form.date) return setError("Please fill all raw exam details.")
    if (subjects.length === 0 || subjects.some(s => !s.name || !s.total_marks)) {
      return setError("All subjects must have valid names and total marks.")
    }
    
    setSubmitting(true)
    try {
      const payloadSubjects = subjects.map(s => ({
        name: s.name,
        total_marks: Number(s.total_marks)
      }))

      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pass_percentage: Number(form.pass_percentage), subjects: payloadSubjects, grades })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setShowCreate(false)
      init() // Refresh
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: '40px' }}><span className="spinner" /> Loading Exams...</div>

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Exams & Results</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Manage batch examinations, automated grading, and marks entry.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create New Exam
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {exams.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>No exams have been created yet.</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                <th>Exam Name</th>
                <th>Batch</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map(ex => (
                <tr key={ex.id}>
                  <td style={{ fontWeight: 600 }}>{ex.name}</td>
                  <td>{ex.batches?.name}</td>
                  <td>{new Date(ex.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${ex.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                      {ex.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                     <button 
                       className="btn btn-ghost btn-sm"
                       onClick={() => router.push(`/${institutionSlug}/admin/exams/${ex.id}`)}
                     >
                        {ex.status === 'published' ? 'View Results' : 'Enter Marks →'}
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>Create New Exam Configuration</h2>
            
            {error && <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>⚠️ {error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="form-group">
                <label className="form-label">Exam Name (e.g. Midterm 1)</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <select className="input" value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})}>
                  <option value="">Select Batch...</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Pass Percentage</label>
                <input type="number" className="input" value={form.pass_percentage} onChange={e => setForm({...form, pass_percentage: e.target.value})} />
              </div>
            </div>

            {/* SUBJECTS */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                 Subjects Configuration
                 <button className="btn btn-ghost btn-sm" onClick={() => setSubjects([...subjects, {name:'', total_marks: '100'}])}>+ Add Subject</button>
               </h3>
               {subjects.map((sub, i) => (
                 <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
                   <input className="input" placeholder="Subject Name" value={sub.name} onChange={e => {
                     const newSubs = [...subjects]; newSubs[i].name = e.target.value; setSubjects(newSubs);
                   }} style={{ flex: 2 }} />
                   <input type="number" className="input" placeholder="Total Marks" value={sub.total_marks} onChange={e => {
                     const newSubs = [...subjects]; newSubs[i].total_marks = e.target.value; setSubjects(newSubs);
                   }} style={{ flex: 1 }} />
                   {subjects.length > 1 && (
                     <button className="btn btn-ghost" style={{ padding: '8px', color: 'var(--danger)' }} onClick={() => {
                        const newSubs = subjects.filter((_, idx) => idx !== i);
                        setSubjects(newSubs);
                     }} title="Delete Subject">
                        ✖
                     </button>
                   )}
                 </div>
               ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Launch Exam Schema'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
