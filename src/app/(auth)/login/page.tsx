'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Tab = 'staff' | 'student'

// ── Student login: 3 steps ────────────────────────────────
// Step 1: enter registration number → lookup institution
// Step 2: confirm "Found: Name at Institution" → show password
// Step 3: redirect to /{slug}/login with credentials auto-submitted
// (We actually redirect to the institution login page and let it handle auth)

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('staff')

  // ── Staff state ──────────────────────────
  const [email, setEmail] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [showStaffPass, setShowStaffPass] = useState(false)

  // ── Student state ──────────────────────────
  const [regNo, setRegNo] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<{ student_name: string; institution_slug: string; institution_name: string } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentError, setStudentError] = useState('')
  const [showStudentPass, setShowStudentPass] = useState(false)

  // ── Staff Login ──────────────────────────
  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    setStaffError('')
    setStaffLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: staffPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setStaffError(data.error ?? 'Login failed.')
        return
      }
      if (data.role === 'platform_admin') router.push('/platform/dashboard')
      else if (data.role === 'admin' || data.role === 'teacher') router.push(`/${data.institutionSlug}/admin`)
      else if (data.role === 'owner') router.push(`/${data.institutionSlug}/owner/dashboard`)
      else router.push(`/${data.institutionSlug}/dashboard`)
      router.refresh()
    } catch {
      setStaffError('Network error. Please try again.')
    } finally {
      setStaffLoading(false)
    }
  }

  // ── Student: Step 1 — lookup registration number ──────────────────────────
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLookupError('')
    setLookupResult(null)
    setStudentPassword('')
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/student-lookup?registration_no=${encodeURIComponent(regNo.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error ?? 'Student not found.')
        return
      }
      setLookupResult(data)
    } catch {
      setLookupError('Network error. Please try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  // ── Student: Step 2 — login with password at their institution portal ──────────────────────────
  async function handleStudentLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!lookupResult) return
    setStudentError('')
    setStudentLoading(true)
    try {
      const res = await fetch('/api/institution/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: regNo.trim().toUpperCase(),
          password: studentPassword,
          institutionSlug: lookupResult.institution_slug,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setStudentError(data.error ?? 'Login failed. Check your password.')
        return
      }
      const slug = lookupResult.institution_slug
      if (!data.passwordChanged) router.push(`/register/${slug}/change-password`)
      else if (!data.profileCompleted) router.push(`/register/${slug}/setup-profile`)
      else router.push(`/${slug}/student/dashboard`)
    } catch {
      setStudentError('Network error. Please try again.')
    } finally {
      setStudentLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,99,255,0.15), transparent)',
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative' }} className="animate-fade-in">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent), var(--info))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🎓</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>EduAI</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>Sign in to your account</p>
        </div>

        <div className="glass-card" style={{ padding: '8px', marginBottom: '0' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', borderRadius: '10px', padding: '4px', marginBottom: '0', gap: '4px' }}>
            {(['staff', 'student'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setStaffError(''); setLookupError(''); setStudentError(''); setLookupResult(null) }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-muted)',
                }}
              >
                {t === 'staff' ? '👔 Staff / Admin' : '🎒 Student'}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '28px', marginTop: '8px' }}>

          {/* ── STAFF TAB ── */}
          {tab === 'staff' && (
            <form onSubmit={handleStaffLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  For Platform Admins, Institution Owners, Admins, and Teachers.
                </p>
              </div>

              {staffError && (
                <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                  ⚠️ {staffError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="staff-email">Email Address</label>
                <input
                  id="staff-email"
                  type="email"
                  className="input"
                  placeholder="you@institution.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setStaffError('') }}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="staff-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="staff-password"
                    type={showStaffPass ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••••"
                    value={staffPassword}
                    onChange={e => { setStaffPassword(e.target.value); setStaffError('') }}
                    required
                    style={{ paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowStaffPass(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>
                    {showStaffPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                id="staff-login-submit"
                type="submit"
                className="btn btn-primary"
                disabled={staffLoading}
                style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600 }}
              >
                {staffLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Signing in…</span> : 'Sign In →'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                New institution?{' '}
                <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Register here</Link>
              </p>
            </form>
          )}

          {/* ── STUDENT TAB ── */}
          {tab === 'student' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Enter your registration number and we'll find your institution automatically.
              </p>

              {/* Step 1 — Registration Number Lookup */}
              {!lookupResult ? (
                <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {lookupError && (
                    <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                      ⚠️ {lookupError}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-no">Registration Number</label>
                    <input
                      id="reg-no"
                      type="text"
                      className="input"
                      placeholder="e.g. BRI001"
                      value={regNo}
                      onChange={e => { setRegNo(e.target.value.toUpperCase()); setLookupError('') }}
                      required
                      autoFocus
                      style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: '15px' }}
                    />
                  </div>
                  <button
                    id="student-lookup-submit"
                    type="submit"
                    className="btn btn-primary"
                    disabled={lookupLoading || !regNo.trim()}
                    style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600 }}
                  >
                    {lookupLoading
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Looking up…</span>
                      : 'Find My School →'}
                  </button>
                </form>
              ) : (
                /* Step 2 — Confirm + Password */
                <form onSubmit={handleStudentLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Found Banner */}
                  <div style={{ padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>✅ Found</div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{lookupResult.student_name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{lookupResult.institution_name}</div>
                  </div>

                  {studentError && (
                    <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                      ⚠️ {studentError}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="student-password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="student-password"
                        type={showStudentPass ? 'text' : 'password'}
                        className="input"
                        placeholder="Enter your password"
                        value={studentPassword}
                        onChange={e => { setStudentPassword(e.target.value); setStudentError('') }}
                        required
                        autoFocus
                        style={{ paddingRight: '44px' }}
                      />
                      <button type="button" onClick={() => setShowStudentPass(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>
                        {showStudentPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <button
                    id="student-login-submit"
                    type="submit"
                    className="btn btn-primary"
                    disabled={studentLoading}
                    style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600 }}
                  >
                    {studentLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Signing in…</span> : 'Sign In →'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setLookupResult(null); setStudentError(''); setStudentPassword('') }}
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    ← Use a different registration number
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Platform Admin?{' '}
          <Link href="/platform/login" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Admin portal →</Link>
        </p>
      </div>
    </div>
  )
}
