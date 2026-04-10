'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LoginError = {
  message: string
  code?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<LoginError | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setErr({ message: data.error ?? 'Login failed.', code: data.code })
        return
      }

      // Route based on role
      if (data.role === 'platform_admin') {
        router.push('/platform/dashboard')
      } else {
        router.push(`/${data.institutionSlug}/dashboard`)
      }

      router.refresh()
    } catch {
      setErr({ message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const isPending = err?.code === 'INSTITUTION_PENDING'
  const isSuspended = err?.code === 'INSTITUTION_SUSPENDED'

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

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent), var(--info))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🎓</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>EduAI</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Sign in to your account</p>
        </div>

        <div className="glass-card" style={{ padding: '36px' }}>
          {/* Error States */}
          {err && (
            <div style={{
              padding: '14px 16px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              background: isPending
                ? 'rgba(234,179,8,0.1)'
                : isSuspended
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(239,68,68,0.1)',
              border: isPending
                ? '1px solid rgba(234,179,8,0.35)'
                : isSuspended
                ? '1px solid rgba(239,68,68,0.2)'
                : '1px solid rgba(239,68,68,0.25)',
              color: isPending ? '#EAB308' : 'var(--danger)',
            }}>
              <div style={{ fontWeight: '600', marginBottom: isPending ? '6px' : 0 }}>
                {isPending ? '⏳ Pending Approval' : isSuspended ? '🚫 Account Suspended' : '⚠️ ' + err.message}
              </div>
              {isPending && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  Your institution is awaiting platform administrator approval. You will be able to log in once approved.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Email</span>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(null) }}
                required
                autoFocus
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Password</span>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErr(null) }}
                required
              />
            </label>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '4px' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent:'center', gap: '8px' }}>
                  <span className="spinner" /> Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
            New institution?{' '}
            <Link href="/register" style={{ color: 'var(--accent)', fontWeight: '500' }}>Register here</Link>
          </p>
        </div>

        {/* Platform admin hint */}
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Platform Admin?{' '}
          <Link href="/platform/login" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
            Admin portal →
          </Link>
        </p>
      </div>
    </div>
  )
}
