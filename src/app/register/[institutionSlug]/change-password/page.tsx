'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Guard: must be authenticated student
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/register/${institutionSlug}/login`)
      } else {
        setChecking(false)
      }
    })
  }, [])

  // Password strength helper
  function strength(pw: string) {
    if (!pw) return null
    if (pw.length < 6) return { label: 'Too short', color: '#EF4444', width: '20%' }
    if (pw.length < 8) return { label: 'Weak', color: '#F97316', width: '40%' }
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Strong', color: '#10B981', width: '100%' }
    return { label: 'Fair', color: '#EAB308', width: '70%' }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to change password.')
        return
      }
      // Success → go to profile setup
      router.push(`/register/${institutionSlug}/setup-profile`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const str = strength(newPassword)

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(108,99,255,0.11), transparent)' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }} className="animate-fade-in">
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center', justifyContent: 'center' }}>
          {['Change Password', 'Set Up Profile'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: i === 0 ? 'var(--accent)' : 'var(--bg-card)',
                border: `2px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700',
                color: i === 0 ? '#fff' : 'var(--text-muted)',
              }}>{i + 1}</div>
              <span style={{ fontSize: '12px', color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === 0 ? '600' : '400' }}>
                {label}
              </span>
              {i < 1 && <div style={{ width: '28px', height: '2px', background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(108,99,255,0.1)', border: '2px solid rgba(108,99,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>🔐</div>
          <h1 style={{ fontSize: '21px', fontWeight: '800', marginBottom: '6px' }}>Set a New Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
            Your default password was auto-generated. Create a secure one now before continuing.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '28px' }}>
          {error && (
            <div style={{ padding: '11px 14px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* New Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newPassword" type={showNew ? 'text' : 'password'}
                  className="input" placeholder="Min. 6 characters"
                  value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                  required style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength bar */}
              {str && (
                <div>
                  <div style={{ height: '4px', background: 'var(--bg-card)', borderRadius: '99px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: str.width, background: str.color, borderRadius: '99px', transition: 'width 0.3s, background 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: str.color, marginTop: '3px', display: 'block' }}>{str.label}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword" type={showConfirm ? 'text' : 'password'}
                  className="input" placeholder="Re-enter your new password"
                  value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                  required style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Passwords do not match</span>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <span style={{ fontSize: '11px', color: 'var(--success)' }}>✓ Passwords match</span>
              )}
            </div>

            <button id="change-pw-submit" type="submit" className="btn btn-primary"
              disabled={loading} style={{ width: '100%', padding: '13px', fontSize: '15px', marginTop: '4px' }}>
              {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Saving…</span> : 'Save Password & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
