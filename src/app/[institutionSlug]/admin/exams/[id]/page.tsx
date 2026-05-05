'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Subject {
  id: string
  subject_name: string
  total_marks: number
}

interface Student {
  id: string
  name: string
  registration_no: string
}

interface MarkData {
  student_id: string
  subject_id: string
  marks_obtained: number
  status: 'present' | 'absent'
}

export default function ExamMarksEntryPage() {
  const router = useRouter()
  const { institutionSlug, id } = useParams()
  
  const [exam, setExam] = useState<any>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  // marksState: key is `${student_id}_${subject_id}`
  const [marksState, setMarksState] = useState<Record<string, { marks: number | '', absent: boolean }>>({})
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Results
  const [results, setResults] = useState<any[]>([])

  const init = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/${id}/marks`)
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setExam(data.exam)
      setSubjects(data.subjects)
      setStudents(data.students)
      setResults(data.results || [])
      
      const newMarksState: Record<string, any> = {}
      data.marks?.forEach((m: any) => {
         newMarksState[`${m.student_id}_${m.subject_id}`] = {
           marks: m.status === 'absent' ? '' : m.marks_obtained,
           absent: m.status === 'absent'
         }
      })
      
      setMarksState(newMarksState)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { init() }, [init])

  const handleMarkChange = (studentId: string, subjectId: string, val: string) => {
    setMarksState(prev => {
      const key = `${studentId}_${subjectId}`
      const existing = prev[key] || { absent: false }
      return {
        ...prev,
        [key]: { ...existing, marks: val === '' ? '' : Number(val) }
      }
    })
  }

  const handleAbsentToggle = (studentId: string, subjectId: string) => {
    setMarksState(prev => {
      const key = `${studentId}_${subjectId}`
      const existing = prev[key] || { marks: '' }
      return {
        ...prev,
        [key]: { ...existing, absent: !existing.absent, marks: !existing.absent ? '' : existing.marks }
      }
    })
  }

  const preparePayload = () => {
    const payload: MarkData[] = []
    students.forEach(st => {
      subjects.forEach(su => {
         const cell = marksState[`${st.id}_${su.id}`]
         if (cell && (cell.marks !== '' || cell.absent)) {
           payload.push({
             student_id: st.id,
             subject_id: su.id,
             marks_obtained: cell.absent ? 0 : Number(cell.marks),
             status: cell.absent ? 'absent' : 'present'
           })
         }
      })
    })
    return payload
  }

  const handleSubmit = async (action: 'draft' | 'submit') => {
    setError('')
    setSuccess('')
    if (action === 'submit') {
       if (!confirm("Are you sure? Once published, marks cannot be edited.")) return;
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/exams/${id}/marks?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks: preparePayload() })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setSuccess(data.message)
      if (action === 'submit') init() // Refresh to show results
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '40px' }}><span className="spinner" /> Loading Exam Details...</div>

  const isPublished = exam?.status === 'published'

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/${institutionSlug}/admin/exams`)} style={{ marginBottom: '16px' }}>
         ← Back to Exams
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>{exam?.name}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Batch Entry — {new Date(exam?.date).toLocaleDateString()}</p>
        </div>
        <div>
          {isPublished && <span className="badge badge-success" style={{ padding: '8px 16px' }}>PUBLISHED</span>}
          {!isPublished && <span className="badge badge-warning" style={{ padding: '8px 16px' }}>DRAFT MODE</span>}
        </div>
      </div>

      {error && <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '16px' }}>⚠️ {error}</div>}
      {success && <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', borderRadius: '8px', marginBottom: '16px' }}>✅ {success}</div>}

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)' }}>
              <th style={{ minWidth: '200px', borderRight: '1px solid var(--border)' }}>Student</th>
              {subjects.map(su => (
                <th key={su.id} style={{ textAlign: 'center', minWidth: '150px' }}>
                  {su.subject_name}<br/>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Max: {su.total_marks}</span>
                </th>
              ))}
              {isPublished && (
                <th style={{ background: 'var(--bg-primary)' }}>Final Result</th>
              )}
            </tr>
          </thead>
          <tbody>
            {students.map(st => {
               const stResult = results.find(r => r.student_id === st.id)
               
               return (
              <tr key={st.id}>
                <td style={{ fontWeight: 600, borderRight: '1px solid var(--border)' }}>
                  {st.name}<br/>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{st.registration_no}</span>
                </td>
                {subjects.map(su => {
                  const key = `${st.id}_${su.id}`
                  const state = marksState[key] || { marks: '', absent: false }
                  return (
                    <td key={su.id} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <input 
                          type="number"
                          className="input"
                          style={{ width: '70px', padding: '6px', textAlign: 'center', opacity: state.absent ? 0.3 : 1 }}
                          value={state.marks}
                          onChange={e => handleMarkChange(st.id, su.id, e.target.value)}
                          disabled={isPublished || state.absent}
                          placeholder="-"
                        />
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: isPublished ? 'default' : 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={state.absent}
                            onChange={() => handleAbsentToggle(st.id, su.id)}
                            disabled={isPublished}
                          />
                          AB
                        </label>
                      </div>
                    </td>
                  )
                })}
                {isPublished && (
                  <td style={{ background: 'var(--bg-primary)' }}>
                     {stResult ? (
                       stResult.status === 'absent' ? (
                         <span className="badge badge-danger">ABSENT</span>
                       ) : (
                         <div style={{ fontSize: '13px' }}>
                           <span className={`badge ${stResult.result === 'pass' ? 'badge-success' : 'badge-danger'}`} style={{ marginRight: '8px' }}>
                             {stResult.result?.toUpperCase()}
                           </span>
                           <strong>{stResult.percentage?.toFixed(2)}%</strong>
                           <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>
                             ({stResult.total_marks}/{stResult.total_max_marks})
                           </span>
                         </div>
                       )
                     ) : (
                       <span style={{ color: 'var(--text-muted)' }}>-</span>
                     )}
                  </td>
                )}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {!isPublished && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '16px', zIndex: 10 }}>
           <button className="btn btn-ghost" onClick={() => handleSubmit('draft')} disabled={saving || students.length === 0}>
             {saving ? 'Saving...' : '💾 Save Draft'}
           </button>
           <button className="btn btn-primary" onClick={() => handleSubmit('submit')} disabled={saving || students.length === 0}>
             {saving ? 'Publishing...' : '🚀 Submit Finals & Publish'}
           </button>
        </div>
      )}
    </div>
  )
}
