'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

/* ── Types ─────────────────────────────────────────────── */
interface SubjectPerf {
  subject: string
  average: number
  trend: 'improving' | 'declining' | 'stable'
}

interface RawMetrics {
  studentName: string
  className: string | null
  batchName: string | null
  attendancePct: number | null
  attendanceTrend: 'improving' | 'declining' | 'stable'
  subjects: SubjectPerf[]
  lastExamPct: number | null
  overallAvg: number | null
  overallTrend: 'improving' | 'declining' | 'stable'
  feesStatus: string
  totalDue: number
  totalPaid: number
  hasExamData: boolean
  hasAttendanceData: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

interface AIReport {
  id: string
  student_id: string
  summary: string
  risk_level: 'low' | 'medium' | 'high'
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  raw_metrics: RawMetrics
  generated_at: string
}

/* ── Static config ──────────────────────────────────────── */
const RISK_CONFIG = {
  low:    { label: 'LOW RISK',    bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  color: '#10B981', icon: '🟢' },
  medium: { label: 'MEDIUM RISK', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.35)',  color: '#EAB308', icon: '🟡' },
  high:   { label: 'HIGH RISK',   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)',  color: '#EF4444', icon: '🔴' },
}

const TREND_ICON: Record<string, string> = {
  improving: '↑',
  declining: '↓',
  stable:    '→',
}
const TREND_COLOR: Record<string, string> = {
  improving: '#10B981',
  declining: '#EF4444',
  stable:    '#94A3B8',
}

/* ── Styled SubSection ──────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '14px' }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────── */
export default function StudentAIAnalysisPage() {
  const { institutionSlug, studentId } = useParams<{ institutionSlug: string; studentId: string }>()
  const router = useRouter()

  const [report, setReport] = useState<AIReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [cached, setCached] = useState(false)

  const fetchReport = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const url = `/api/admin/students/${studentId}/ai-analysis${forceRefresh ? '?refresh=1' : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to generate analysis'); return }
      setReport(data.report)
      setCached(data.cached)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [studentId])

  useEffect(() => { fetchReport() }, [fetchReport])

  const m = report?.raw_metrics

  /* ── Loading state ── */
  if (loading) return (
    <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{ position: 'relative', width: '60px', height: '60px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.08)', borderTopColor: 'rgba(99,102,241,0.5)', animation: 'spin 1.4s linear infinite reverse' }} />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Generating AI analysis…</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '12px', opacity: 0.6 }}>Fetching attendance, exam data and running analysis</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  /* ── Error state ── */
  if (error) return (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
      <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '8px' }}>{error}</p>
      <button onClick={() => fetchReport()} className="btn btn-ghost btn-sm">Try Again</button>
    </div>
  )

  if (!report || !m) return null

  const risk = RISK_CONFIG[report.risk_level]

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>

      {/* ── Back + Refresh bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          onClick={() => router.push(`/${institutionSlug}/admin/students`)}
          className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          ← Back to Students
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {cached && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              Cached · {new Date(report.generated_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {refreshing ? <><span className="spinner" />Regenerating…</> : '🔄 Refresh Analysis'}
          </button>
        </div>
      </div>

      {/* ── 1. STUDENT HEADER ── */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '16px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '16px' }}>
                {m.studentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{m.studentName}</h1>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {[m.className && `Class ${m.className}`, m.batchName && `Batch: ${m.batchName}`].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          </div>
          {/* Risk badge */}
          <div style={{ padding: '8px 16px', borderRadius: '30px', background: risk.bg, border: `1px solid ${risk.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>{risk.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: risk.color, letterSpacing: '0.06em' }}>{risk.label}</span>
          </div>
        </div>

        {/* ── 2. AI SUMMARY ── */}
        <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: '10px', borderLeft: `3px solid ${risk.color}` }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>✨ AI Summary</div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)' }}>{report.summary}</p>
        </div>
      </div>

      {/* ── 3. SUPPORTING METRICS ── */}
      <Section title="Key Metrics" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          {/* Attendance */}
          <MetricCard
            label="Attendance"
            value={m.hasAttendanceData ? `${m.attendancePct}%` : '—'}
            sub={m.hasAttendanceData ? m.attendanceTrend : 'No data'}
            color={m.attendancePct === null ? undefined : m.attendancePct >= 75 ? '#10B981' : m.attendancePct >= 60 ? '#EAB308' : '#EF4444'}
            trend={m.hasAttendanceData ? m.attendanceTrend : undefined}
          />
          {/* Overall average */}
          <MetricCard
            label="Avg Score"
            value={m.hasExamData ? `${m.overallAvg}%` : '—'}
            sub={m.hasExamData ? m.overallTrend : 'No exams'}
            color={m.overallAvg === null ? undefined : m.overallAvg >= 70 ? '#10B981' : m.overallAvg >= 50 ? '#EAB308' : '#EF4444'}
            trend={m.hasExamData ? m.overallTrend : undefined}
          />
          {/* Last exam */}
          <MetricCard
            label="Last Exam"
            value={m.lastExamPct !== null ? `${m.lastExamPct}%` : '—'}
            sub={m.lastExamPct !== null ? (m.lastExamPct >= 70 ? 'Good' : m.lastExamPct >= 50 ? 'Average' : 'Needs work') : 'No data'}
            color={m.lastExamPct === null ? undefined : m.lastExamPct >= 70 ? '#10B981' : m.lastExamPct >= 50 ? '#EAB308' : '#EF4444'}
          />
          {/* Fees */}
          <MetricCard
            label="Fees"
            value={m.feesStatus === 'paid' ? 'Paid' : m.feesStatus === 'pending' ? 'Pending' : 'No Dues'}
            sub={m.totalDue > 0 ? `₹${(m.totalDue - m.totalPaid).toLocaleString('en-IN')} balance` : ''}
            color={m.feesStatus === 'paid' ? '#10B981' : m.feesStatus === 'pending' ? '#EF4444' : '#94A3B8'}
          />
        </div>
      </Section>

      {/* ── 4. SUBJECT ANALYSIS ── */}
      <Section title="Subject Performance" icon="📚">
        {!m.hasExamData ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No exam data available for this student
          </div>
        ) : m.subjects.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No subject-wise data found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {m.subjects.map(s => (
              <div key={s.subject}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                {/* Subject name */}
                <div style={{ minWidth: '110px', fontWeight: 600, fontSize: '13px' }}>{s.subject}</div>
                {/* Progress bar */}
                <div style={{ flex: 1, height: '6px', background: 'rgba(148,163,184,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${s.average}%`,
                    borderRadius: '3px',
                    background: s.average >= 70 ? '#10B981' : s.average >= 50 ? '#EAB308' : '#EF4444',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                {/* Percentage */}
                <div style={{ minWidth: '42px', textAlign: 'right', fontWeight: 700, fontSize: '14px',
                  color: s.average >= 70 ? '#10B981' : s.average >= 50 ? '#EAB308' : '#EF4444' }}>
                  {s.average}%
                </div>
                {/* Trend */}
                <div style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontSize: '16px', color: TREND_COLOR[s.trend] }}
                  title={s.trend}>
                  {TREND_ICON[s.trend]}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>↑ Improving</span><span>→ Stable</span><span>↓ Declining</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 5. STRENGTHS & WEAKNESSES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', marginBottom: '12px' }}>
            💪 Strengths
          </div>
          {report.strengths.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No notable strengths identified</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.strengths.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
                  <span style={{ color: '#10B981', fontSize: '14px', flexShrink: 0 }}>✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EF4444', marginBottom: '12px' }}>
            ⚠️ Weaknesses
          </div>
          {report.weaknesses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No major weaknesses detected</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.weaknesses.map((w, i) => (
                <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
                  <span style={{ color: '#EF4444', fontSize: '14px', flexShrink: 0 }}>!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── 6. ACTIONABLE SUGGESTIONS ── */}
      <Section title="Actionable Suggestions" icon="🎯">
        {report.suggestions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No suggestions available</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {report.suggestions.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', alignItems: 'flex-start' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: '13px', lineHeight: 1.6 }}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '32px' }}>
        AI-generated analysis · Last updated {new Date(report.generated_at).toLocaleString('en-IN')}
        {cached && ' · Cached report'}
      </div>
    </div>
  )
}

/* ── MetricCard sub-component ─────────────────────────── */
function MetricCard({ label, value, sub, color, trend }: {
  label: string; value: string; sub: string; color?: string; trend?: string
}) {
  return (
    <div style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: color ?? 'var(--text-primary)' }}>
        {trend && <span style={{ fontSize: '14px', marginRight: '2px', color: TREND_COLOR[trend] }}>{TREND_ICON[trend]}</span>}
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>{sub}</div>}
    </div>
  )
}
