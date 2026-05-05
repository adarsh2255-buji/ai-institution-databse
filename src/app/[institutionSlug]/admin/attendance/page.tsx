'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface Batch { id: string; name: string; student_count: number }
interface Student { id: string; name: string; registration_no: string }
interface SessionRecord { id: string; session: string; start_time: string; end_time: string; batch_id: string; batch_name?: string; absent_count: number }

const SESSIONS = ['morning', 'afternoon', 'evening', 'night'] as const
type SessionType = typeof SESSIONS[number]

const SESSION_COLORS: Record<SessionType, string> = {
  morning: '#F59E0B',
  afternoon: '#3B82F6',
  evening: '#8B5CF6',
  night: '#1E293B',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function AttendancePage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const supabase = createClient()

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar data: which dates have sessions recorded
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionRecord[]>>({})

  // Popup state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupSessions, setPopupSessions] = useState<SessionRecord[]>([])
  const [showMarkForm, setShowMarkForm] = useState(false)

  // Mark form state
  const [selectedBatch, setSelectedBatch] = useState('')
  const [session, setSession] = useState<SessionType>('morning')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [students, setStudents] = useState<Student[]>([])
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set())
  const [fetchingStudents, setFetchingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Check if already taken (for current form selections)
  const [alreadyTaken, setAlreadyTaken] = useState(false)

  const fetchMonthSessions = useCallback(async (year: number, month: number) => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`

    const { data } = await supabase
      .from('attendance_sessions')
      .select('id, date, session, start_time, end_time, batch_id, batches(name), attendance_records(count)')
      .gte('date', startDate)
      .lte('date', endDate)

    if (!data) return

    const grouped: Record<string, SessionRecord[]> = {}
    for (const s of data as any[]) {
      const d = s.date
      if (!grouped[d]) grouped[d] = []
      grouped[d].push({
        id: s.id,
        session: s.session,
        start_time: s.start_time,
        end_time: s.end_time,
        batch_id: s.batch_id,
        batch_name: s.batches?.name,
        absent_count: s.attendance_records?.[0]?.count ?? 0
      })
    }
    setSessionsByDate(grouped)
  }, [supabase])

  const init = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/batches')
      if (res.ok) setBatches(await res.json())
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { init() }, [init])
  useEffect(() => { fetchMonthSessions(viewYear, viewMonth) }, [viewYear, viewMonth, fetchMonthSessions])

  // When batch+session+date changes, check if already taken
  useEffect(() => {
    if (!selectedDate || !selectedBatch || !session) { setAlreadyTaken(false); return }
    const dateSessions = sessionsByDate[selectedDate] || []
    const taken = dateSessions.some(s => s.batch_id === selectedBatch && s.session === session)
    setAlreadyTaken(taken)
  }, [selectedDate, selectedBatch, session, sessionsByDate])

  // Load students when batch selected
  useEffect(() => {
    if (!selectedBatch) { setStudents([]); setAbsentIds(new Set()); return }
    async function load() {
      setFetchingStudents(true)
      const { data } = await supabase
        .from('students')
        .select('id, name, registration_no')
        .eq('batch_id', selectedBatch)
        .eq('status', 'active')
      if (data) {
        const sorted = [...(data as Student[])].sort((a, b) => a.name.localeCompare(b.name))
        setStudents(sorted)
      }
      setFetchingStudents(false)
    }
    load()
  }, [selectedBatch, supabase])

  const openDayPopup = (dateStr: string) => {
    const isFuture = dateStr > today.toISOString().split('T')[0]
    if (isFuture) return // Don't allow future dates
    setSelectedDate(dateStr)
    setPopupSessions(sessionsByDate[dateStr] || [])
    setShowMarkForm(false)
    setError('')
    setSuccessMsg('')
    setSelectedBatch('')
    setSession('morning')
    setStartTime('09:00')
    setEndTime('11:00')
    setAbsentIds(new Set())
    setAlreadyTaken(false)
  }

  const handleSubmit = async () => {
    setError('')
    if (!selectedBatch) return setError('Please select a batch.')
    if (startTime >= endTime) return setError('Start time must be before end time.')
    if (students.length === 0) return setError('No students in this batch.')
    if (alreadyTaken) return setError('Attendance already taken for this batch/session.')

    setSubmitting(true)
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: selectedBatch,
          date: selectedDate,
          session,
          start_time: startTime,
          end_time: endTime,
          absent_student_ids: Array.from(absentIds)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSuccessMsg(data.message)
      setShowMarkForm(false)
      await fetchMonthSessions(viewYear, viewMonth)
      // close popup after short delay
      setTimeout(() => { setSelectedDate(null); setSuccessMsg('') }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const todayStr = today.toISOString().split('T')[0]
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    const now = new Date()
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}><span className="spinner" /> Loading Attendance...</div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Attendance</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Tap a date to record or view attendance for that day.</p>
      </div>

      {/* Calendar Card */}
      <div className="card" style={{ padding: '24px' }}>
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹ Prev</button>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{monthName}</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={nextMonth}
            disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
          >Next ›</button>
        </div>

        {/* Day Labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px' }}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {/* Empty cells for first day */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isFuture = dateStr > todayStr
            const hasSessions = (sessionsByDate[dateStr] || []).length > 0
            const sessions = sessionsByDate[dateStr] || []

            return (
              <div
                key={day}
                onClick={() => !isFuture && openDayPopup(dateStr)}
                style={{
                  position: 'relative',
                  minHeight: '64px',
                  padding: '6px',
                  borderRadius: '10px',
                  border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: isToday ? 'rgba(99,102,241,0.08)' : isFuture ? 'transparent' : 'var(--bg-card)',
                  cursor: isFuture ? 'default' : 'pointer',
                  opacity: isFuture ? 0.3 : 1,
                  transition: 'all 0.15s',
                }}
                className={!isFuture ? 'calendar-day' : ''}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: isToday ? 700 : 400,
                  marginBottom: '4px'
                }}>
                  {day}
                </div>
                {/* Session dots */}
                {sessions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        title={`${s.session} — ${s.batch_name}`}
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: SESSION_COLORS[s.session as SessionType] || '#64748B'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          {(Object.entries(SESSION_COLORS) as [SessionType, string][]).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Day Popup */}
      {selectedDate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedDate(null); setSuccessMsg('') } }}
        >
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '560px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {popupSessions.length === 0 ? 'No attendance recorded' : `${popupSessions.length} session(s) recorded`}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedDate(null); setSuccessMsg('') }}>✕</button>
            </div>

            {/* Already taken sessions */}
            {popupSessions.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Recorded Sessions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {popupSessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: SESSION_COLORS[s.session as SessionType] || '#64748B' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>{s.session} — {s.batch_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.start_time} – {s.end_time}</div>
                        </div>
                      </div>
                      <span className="badge badge-danger" style={{ fontSize: '11px' }}>{s.absent_count} absent</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                ✅ {successMsg}
              </div>
            )}

            {/* Mark New Attendance Button / Form */}
            {!showMarkForm ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowMarkForm(true)}>
                + Mark New Attendance Session
              </button>
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Mark Attendance</h3>

                {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>⚠️ {error}</div>}

                {alreadyTaken && (
                  <div style={{ padding: '10px', background: 'rgba(234,179,8,0.1)', color: '#B45309', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                    ⚠️ Attendance already taken for this batch and session on this date.
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Batch</label>
                    <select className="input" value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
                      <option value="">Select batch...</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.student_count} students)</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Session</label>
                    <select className="input" value={session} onChange={e => setSession(e.target.value as SessionType)}>
                      {SESSIONS.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input type="time" className="input" value={endTime} onChange={e => setEndTime(e.target.value)} />
                  </div>
                </div>

                {/* Student List */}
                {fetchingStudents ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}><span className="spinner" /> Loading students...</div>
                ) : students.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Students ({students.length})
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--success)' }}>🟢 {students.length - absentIds.size} Present</span>
                        <span style={{ color: 'var(--danger)' }}>🔴 {absentIds.size} Absent</span>
                      </div>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {students.map((st, idx) => {
                        const isAbsent = absentIds.has(st.id)
                        return (
                          <div key={st.id} onClick={() => {
                            const next = new Set(absentIds)
                            if (next.has(st.id)) { next.delete(st.id) } else { next.add(st.id) }
                            setAbsentIds(next)
                          }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: idx < students.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: isAbsent ? 0.7 : 1, background: isAbsent ? 'rgba(239,68,68,0.04)' : 'transparent', transition: 'all 0.15s' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>{st.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{st.registration_no}</div>
                            </div>
                            <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: isAbsent ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: isAbsent ? 'var(--danger)' : 'var(--success)' }}>
                              {isAbsent ? 'Absent' : 'Present'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowMarkForm(false); setError('') }}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting || alreadyTaken || !selectedBatch}>
                    {submitting ? 'Saving...' : 'Confirm & Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .calendar-day:hover { transform: scale(1.04); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
      `}</style>
    </div>
  )
}
