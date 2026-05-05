'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Institution { name: string; status: string }

export default function UnifiedLoginPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    async function init() {
      // Clear any stale local auth sessions to prevent refresh token ghost errors
      const supabase = createClient()
      await supabase.auth.signOut()

      try {
        const res = await fetch(`/api/institution/public?slug=${institutionSlug}`)
        if (res.ok) setInstitution(await res.json())
      } finally {
        setPageReady(true)
      }
    }
    init()
  }, [institutionSlug])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/institution/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          institutionSlug,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.code === 'STUDENT_PENDING' || data.code === 'INSTITUTION_PENDING') {
          setError(data.error ?? 'Account pending approval.')
        } else if (data.code === 'STUDENT_SUSPENDED' || data.code === 'INSTITUTION_SUSPENDED') {
          setError(data.error ?? 'Account suspended.')
        } else {
          setError(data.error ?? 'Login failed. Check your credentials.')
        }
        return
      }

      // Branch routing based on role
      if (data.role === 'student') {
        if (!data.passwordChanged) {
          router.push(`/register/${institutionSlug}/change-password`)
        } else if (!data.profileCompleted) {
          router.push(`/register/${institutionSlug}/setup-profile`)
        } else {
          router.push(`/${institutionSlug}/student/dashboard`)
        }
      } else {
        // Staff routing (owner, admin, teacher)
        router.push(`/${institutionSlug}/${data.role}/dashboard`)
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
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent), var(--info))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🎓</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            EduAI Login
          </h1>
          {institution && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Portal for <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{institution.name}</span>
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
              <label className="form-label" htmlFor="identifier">
                Email or Registration Number
              </label>
              <input
                id="identifier"
                className="input"
                placeholder="you@email.com OR BRI01"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError('') }}
                required
                autoComplete="username"
                autoFocus
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
            </div>

            <button
              id="unified-login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: '600', marginTop: '4px' }}
            >
              {loading ? (
               <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                 <span className="spinner" /> Signing in…
               </span>
              ) : 'Sign In →'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              Are you a new student?{' '}
              <Link href={`/register/${institutionSlug}`} style={{ color: 'var(--accent)', fontWeight: '500' }}>
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
