'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'pending'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    institutionName: '',
    location: '',
    phone: '',
    ownerName: '',
    email: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Registration failed. Please try again.')
        return
      }

      setStep('pending')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,99,255,0.18), transparent)',
      }} />

      <div style={{ width: '100%', maxWidth: '560px', position: 'relative' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent), var(--info))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🎓</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>EduAI Platform</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Register your institution</p>
        </div>

        {step === 'form' ? (
          <div className="glass-card" style={{ padding: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>
              Institution Registration
            </h2>

            {error && (
              <div style={{
                padding: '12px 16px', marginBottom: '20px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '14px',
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Section: Institution */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Institution Details
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Institution Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input
                      id="institutionName"
                      name="institutionName"
                      type="text"
                      className="input"
                      placeholder="e.g. Bright Academy"
                      value={form.institutionName}
                      onChange={handleChange}
                      required
                      autoFocus
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Location <span style={{ color: 'var(--danger)' }}>*</span></span>
                      <input
                        id="location"
                        name="location"
                        type="text"
                        className="input"
                        placeholder="City, State"
                        value={form.location}
                        onChange={handleChange}
                        required
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Phone <span style={{ color: 'var(--danger)' }}>*</span></span>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className="input"
                        placeholder="+91 XXXXX XXXXX"
                        value={form.phone}
                        onChange={handleChange}
                        required
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--border)' }} />

              {/* Section: Owner */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Owner Account
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Owner Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      className="input"
                      placeholder="Full name"
                      value={form.ownerName}
                      onChange={handleChange}
                      required
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Email <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="input"
                      placeholder="owner@example.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Password <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="input"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                  </label>
                </div>
              </div>

              <button
                id="register-submit"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '4px' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="spinner" /> Registering…
                  </span>
                ) : 'Register Institution'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Already registered?{' '}
              <Link href="/login" style={{ color: 'var(--accent)', fontWeight: '500' }}>Sign in</Link>
            </p>
          </div>
        ) : (
          /* ── Pending State Screen ── */
          <div className="glass-card animate-fade-in" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(234,179,8,0.15)',
              border: '2px solid rgba(234,179,8,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', margin: '0 auto 24px',
              animation: 'pulse 2s ease infinite',
            }}>⏳</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>
              Registration Submitted!
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              Your institution has been registered and is <strong style={{ color: '#EAB308' }}>pending approval</strong>.
              A platform administrator will review your request shortly.
            </p>
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '28px',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>What happens next:</p>
              <ol style={{ fontSize: '13px', lineHeight: '2', textAlign: 'left', paddingLeft: '20px', margin: 0 }}>
                <li>Platform admin reviews your institution details</li>
                <li>Your institution is approved and set to <em>active</em></li>
                <li>You can then log in and start using EduAI</li>
              </ol>
            </div>
            <Link href="/login" className="btn btn-primary" style={{ display: 'inline-flex', padding: '12px 28px' }}>
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
