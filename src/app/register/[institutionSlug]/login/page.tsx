'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Institution { name: string; status: string }

export default function StudentLoginPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [registrationNo, setRegistrationNo] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    async function loadInstitution() {
      try {
        const res = await fetch(`/api/institution/public?slug=${institutionSlug}`)
        if (res.ok) setInstitution(await res.json())
      } finally {
        setPageReady(true)
      }
    }
    loadInstitution()
  }, [institutionSlug])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationNo: registrationNo.trim().toUpperCase(),
          password,
          institutionSlug,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.code === 'STUDENT_PENDING') {
          setError('Your registration is pending admin approval. Please check back later.')
        } else if (data.code === 'STUDENT_SUSPENDED') {
          setError('Your account has been suspended. Contact the institution.')
        } else {
          setError(data.error ?? 'Login failed. Check your credentials.')
        }
        return
      }

      // Route to the correct next step based on completion flags
      if (!data.passwordChanged) {
        router.push(`/register/${institutionSlug}/change-password`)
      } else if (!data.profileCompleted) {
        router.push(`/register/${institutionSlug}/setup-profile`)
      } else {
        router.push(`/${institutionSlug}/student/dashboard`)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!pageReady) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
      </div>
    )
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
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(108,99,255,0.1), transparent)' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }} className="animate-fade-in">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'var(--accent-dim)', border: '2px solid rgba(108,99,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🎓</div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Student Login</h1>
          {institution && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {institution.name}
            </p>
          )}
        </div>

        <div className="glass-card" style={{ padding: '30px' }}>
          {error && (
            <div style={{
              padding: '12px 14px', marginBottom: '18px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="registrationNo">Registration Number</label>
              <input
                id="registrationNo"
                className="input"
                placeholder="e.g. BRI01"
                value={registrationNo}
                onChange={(e) => { setRegistrationNo(e.target.value.toUpperCase()); setError('') }}
                required
                autoComplete="username"
                style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '16px',
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Default: lowercase first name + last 2 digits of birth year (e.g. rahul05)
              </span>
            </div>

            <button
              id="student-login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: '600' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="spinner" /> Logging in…
                </span>
              ) : 'Login →'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <Link href={`/register/${institutionSlug}`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ← New Registration
            </Link>
            <Link href="/login" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Staff Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
