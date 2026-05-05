'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Tab = 'overview' | 'attendance' | 'exams' | 'fees'

interface Props {
  student: {
    id: string; name: string; registration_no: string; student_class?: string
    photo_url?: string; gender?: string; dob?: string; school_name?: string
    medium?: string; father_name?: string; mother_name?: string
    phone?: string; email?: string; address?: string
  }
  institution: { name: string; slug: string } | null
  batch: { name: string } | null
  institutionSlug: string
  attendanceSummary: { present: number; absent: number; total: number; percentage: number }
  recentAttendance: { date: string; session: string; status: 'present' | 'absent' }[]
  examResults: {
    id: string; exam_name: string; exam_date: string; pass_percentage: number
    total_marks: number | null; total_max_marks: number | null
    percentage: number | null; result: 'pass' | 'fail' | null; status: 'present' | 'absent'
  }[]
  fees: {
    id: string; month: string; amount_due: number; amount_paid: number
    due_date?: string; paid_on?: string; status: 'paid' | 'partial' | 'pending' | 'overdue'
  }[]
  feesSummary: { totalDue: number; totalPaid: number; totalPending: number }
}

const SESSION_EMOJI: Record<string, string> = {
  morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙'
}

const FEE_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: 'rgba(16,185,129,0.1)', color: 'var(--success)' },
  partial: { bg: 'rgba(234,179,8,0.1)', color: '#B45309' },
  pending: { bg: 'rgba(99,102,241,0.1)', color: 'var(--accent)' },
  overdue: { bg: 'rgba(239,68,68,0.1)', color: 'var(--danger)' },
}

export default function StudentDashboardClient({
  student, institution, batch, institutionSlug,
  attendanceSummary, recentAttendance, examResults, fees, feesSummary
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  async function signOut() {
    await supabase.auth.signOut()
    router.push(`/${institutionSlug}/login`)
  }

  const attendanceColor = attendanceSummary.percentage >= 75
    ? 'var(--success)' : attendanceSummary.percentage >= 50
    ? '#F59E0B' : 'var(--danger)'

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    { id: 'exams', label: 'Exams & Marks', icon: '📝' },
    { id: 'fees', label: 'Fees', icon: '💳' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(108,99,255,0.12), transparent)', zIndex: 0 }} />

      {/* ── Top Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-glass)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🎓</span>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{institution?.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{student.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{student.registration_no}</div>
          </div>
          <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>

        {/* ── Profile Hero ── */}
        <div className="glass-card animate-fade-in" style={{ padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
              border: '3px solid rgba(108,99,255,0.35)',
              background: student.photo_url ? 'transparent' : 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: '28px', color: 'var(--accent-light)',
              boxShadow: '0 0 24px rgba(108,99,255,0.2)',
            }}>
              {student.photo_url
                ? <img src={student.photo_url} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : student.name?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>{student.name}</h1>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {student.student_class && <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid rgba(108,99,255,0.2)' }}>📖 {student.student_class}</span>}
                {batch && <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>👥 {batch.name}</span>}
                <span className="badge" style={{ fontFamily: 'monospace', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{student.registration_no}</span>
                <span className="badge badge-success">✅ Active</span>
              </div>
            </div>
            <Link href={`/register/${institutionSlug}/setup-profile`} className="btn btn-ghost btn-sm">✏️ Edit Profile</Link>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {/* Attendance */}
          <div className="glass-card" style={{ padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: attendanceColor }}>{attendanceSummary.percentage}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Attendance</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{attendanceSummary.present}/{attendanceSummary.total} sessions</div>
          </div>
          {/* Exams */}
          <div className="glass-card" style={{ padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent)' }}>{examResults.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Exams Taken</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {examResults.filter(e => e.result === 'pass').length} passed
            </div>
          </div>
          {/* Fees */}
          <div className="glass-card" style={{ padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: feesSummary.totalPending > 0 ? 'var(--danger)' : 'var(--success)' }}>
              ₹{feesSummary.totalPending.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Fee Due</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹{feesSummary.totalPaid.toLocaleString('en-IN')} paid</div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px', marginBottom: '20px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, minWidth: '90px', padding: '9px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s',
                background: activeTab === t.id ? 'var(--accent)' : 'transparent',
                color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            {/* Profile Details */}
            <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '14px' }}>Profile Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {[
                  { icon: '🏫', label: 'School', value: student.school_name },
                  { icon: '📚', label: 'Medium', value: student.medium },
                  { icon: '🧍', label: 'Gender', value: student.gender },
                  { icon: '🎂', label: 'DOB', value: student.dob ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null },
                  { icon: '👨', label: 'Father', value: student.father_name },
                  { icon: '👩', label: 'Mother', value: student.mother_name },
                  { icon: '📞', label: 'Phone', value: student.phone },
                  { icon: '✉️', label: 'Email', value: student.email },
                  { icon: '🏠', label: 'Address', value: student.address },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance Preview */}
            {recentAttendance.length > 0 && (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Recent Attendance</div>
                  <button onClick={() => setActiveTab('attendance')} className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>View All →</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentAttendance.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px' }}>{SESSION_EMOJI[r.session] || '📅'} {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} — <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{r.session}</span></span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: r.status === 'present' ? 'var(--success)' : 'var(--danger)' }}>
                        {r.status === 'present' ? '🟢 Present' : '🔴 Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ ATTENDANCE TAB ══════════ */}
        {activeTab === 'attendance' && (
          <div className="animate-fade-in">
            {/* Summary Ring */}
            <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '16px' }}>This Month's Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
                {[
                  { label: 'Total Sessions', value: attendanceSummary.total, color: 'var(--text-primary)' },
                  { label: 'Present', value: attendanceSummary.present, color: 'var(--success)' },
                  { label: 'Absent', value: attendanceSummary.absent, color: 'var(--danger)' },
                  { label: 'Percentage', value: `${attendanceSummary.percentage}%`, color: attendanceColor },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Attendance Rate</span>
                  <span style={{ color: attendanceColor, fontWeight: 700 }}>{attendanceSummary.percentage}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${attendanceSummary.percentage}%`, background: attendanceColor, borderRadius: '99px', transition: 'width 0.6s ease' }} />
                </div>
                {attendanceSummary.percentage < 75 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#B45309', padding: '8px 12px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px' }}>
                    ⚠️ Attendance below 75%. Please attend regularly to avoid issues.
                  </div>
                )}
              </div>
            </div>

            {/* Session Log */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
                Session Log
              </div>
              {recentAttendance.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No attendance sessions recorded this month.</div>
              ) : (
                recentAttendance.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < recentAttendance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px' }}>{SESSION_EMOJI[r.session] || '📅'}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.session} session</div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: r.status === 'present' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: r.status === 'present' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {r.status === 'present' ? '🟢 Present' : '🔴 Absent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══════════ EXAMS TAB ══════════ */}
        {activeTab === 'exams' && (
          <div className="animate-fade-in">
            {examResults.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No exam results published yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {examResults.map(r => (
                  <div key={r.id} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{r.exam_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {r.exam_date ? new Date(r.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      {r.status === 'absent' ? (
                        <span className="badge badge-danger">ABSENT</span>
                      ) : r.result ? (
                        <span className={`badge ${r.result === 'pass' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
                          {r.result === 'pass' ? '✅ PASS' : '❌ FAIL'}
                        </span>
                      ) : null}
                    </div>

                    {r.status !== 'absent' && r.percentage !== null && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                        {[
                          { label: 'Marks Obtained', value: `${r.total_marks ?? '-'} / ${r.total_max_marks ?? '-'}` },
                          { label: 'Percentage', value: `${Number(r.percentage).toFixed(1)}%` },
                          { label: 'Pass Mark', value: `${r.pass_percentage}%` },
                        ].map(stat => (
                          <div key={stat.label} style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: stat.label === 'Percentage' ? (r.result === 'pass' ? 'var(--success)' : 'var(--danger)') : 'var(--text-primary)' }}>{stat.value}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Percentage bar */}
                    {r.percentage !== null && r.status !== 'absent' && (
                      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(r.percentage, 100)}%`, background: r.result === 'pass' ? 'var(--success)' : 'var(--danger)', borderRadius: '99px' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ FEES TAB ══════════ */}
        {activeTab === 'fees' && (
          <div className="animate-fade-in">
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Total Due', value: feesSummary.totalDue, color: 'var(--text-primary)' },
                { label: 'Total Paid', value: feesSummary.totalPaid, color: 'var(--success)' },
                { label: 'Balance Due', value: feesSummary.totalPending, color: feesSummary.totalPending > 0 ? 'var(--danger)' : 'var(--success)' },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: stat.color }}>₹{stat.value.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Fee Records */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {fees.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No fee records found.</div>
              ) : (
                fees.map((fee, i) => (
                  <div key={fee.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < fees.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{fee.month}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Due: ₹{Number(fee.amount_due).toLocaleString('en-IN')}
                        {fee.due_date && ` · By ${new Date(fee.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>₹{Number(fee.amount_paid).toLocaleString('en-IN')} paid</div>
                      <span style={{
                        display: 'inline-block', marginTop: '4px',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize',
                        ...FEE_STATUS_STYLE[fee.status],
                      }}>
                        {fee.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
