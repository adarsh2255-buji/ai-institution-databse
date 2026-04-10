'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Institution {
  name: string
  slug: string
  status: string
}

type PageState = 'loading' | 'invalid' | 'form' | 'success'

export default function StudentRegisterPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ registration_no: string; default_password: string } | null>(null)

  const [form, setForm] = useState({ name: '', student_class: '', dob: '' })

  const CLASS_OPTIONS = [
    'Class I', 'Class II', 'Class III', 'Class IV',
    'Class V', 'Class VI', 'Class VII', 'Class VIII',
    'Class IX', 'Class X', 'Class XI', 'Class XII',
  ]

  // Validate institution slug on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/institution/public?slug=${institutionSlug}`)
        if (!res.ok) { setPageState('invalid'); return }
        const data: Institution = await res.json()
        if (data.status !== 'active') { setPageState('invalid'); return }
        setInstitution(data)
        setPageState('form')
      } catch {
        setPageState('invalid')
      }
    }
    validate()
  }, [institutionSlug])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFormLoading(true)
    try {
      if (!form.student_class) {
        setError('Please select a class.')
        setFormLoading(false)
        return
      }
      const res = await fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          student_class: form.student_class,
          dob: form.dob,
          institution_slug: institutionSlug,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Registration failed. Please try again.')
        return
      }
      setResult({ registration_no: data.registration_no, default_password: data.default_password })
      setPageState('success')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setFormLoading(false)
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
        background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(108,99,255,0.12), transparent)',
      }} />

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>

        {/* Loading */}
        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px', borderWidth: '3px' }} />
            <p style={{ fontSize: '14px' }}>Validating institution…</p>
          </div>
        )}

        {/* Invalid */}
        {pageState === 'invalid' && (
          <div className="glass-card animate-fade-in" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Invalid Institution</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7' }}>
              This registration link is invalid or the institution is not currently accepting registrations.
            </p>
          </div>
        )}

        {/* Registration Form */}
        {pageState === 'form' && institution && (
          <div className="animate-fade-in">
            {/* Brand */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'var(--accent-dim)', border: '2px solid rgba(108,99,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px', margin: '0 auto 14px',
              }}>🎓</div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
                Student Registration
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Register for{' '}
                <strong style={{ color: 'var(--accent-light)' }}>{institution.name}</strong>
              </p>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
              {error && (
                <div style={{
                  padding: '12px 14px', marginBottom: '18px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)'
                }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Institution (read-only) */}
                <div className="form-group">
                  <label className="form-label">Institution</label>
                  <div style={{
                    padding: '11px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span>🏫</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{institution.name}</span>
                  </div>
                </div>

                {/* Student Name */}
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Student Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    className="input"
                    placeholder="e.g. Rahul Menon"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Enter full name as it should appear on records.
                  </span>
                </div>

                {/* Class */}
                <div className="form-group">
                  <label className="form-label" htmlFor="student_class">
                    Class <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    id="student_class"
                    name="student_class"
                    className="input"
                    value={form.student_class}
                    onChange={handleChange}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select class…</option>
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Date of Birth */}
                <div className="form-group">
                  <label className="form-label" htmlFor="dob">
                    Date of Birth <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    className="input"
                    value={form.dob}
                    onChange={handleChange}
                    required
                    max={new Date().toISOString().slice(0, 10)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Used to generate your default login password.
                  </span>
                </div>

                {/* Info box */}
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--info-dim)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--info)',
                  lineHeight: '1.6',
                }}>
                  ℹ️ After submitting, you will receive a <strong>Registration Number</strong> and a <strong>default password</strong>. Keep them safe — you will need them to login after admin approval.
                </div>

                <button
                  id="register-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                  style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: '600' }}
                >
                  {formLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span className="spinner" /> Registering…
                    </span>
                  ) : 'Register Now →'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Already registered?{' '}
                <Link href={`/register/${institutionSlug}/login`} style={{ color: 'var(--accent-light)' }}>
                  Login here
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {pageState === 'success' && result && (
          <div className="glass-card animate-fade-in" style={{ padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', margin: '0 auto 16px',
              }}>✅</div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
                Registration Submitted!
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                Your registration is pending admin approval. Save these credentials — you will need them to login.
              </p>
            </div>

            {/* Credentials card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Your Login Credentials
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Registration Number', value: result.registration_no, mono: true, accent: true },
                  { label: 'Default Password', value: result.default_password, mono: true },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '15px',
                      fontWeight: '700',
                      color: item.accent ? 'var(--accent-light)' : 'var(--text-primary)',
                      background: 'var(--bg-glass)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px', color: 'var(--warning)',
              marginBottom: '20px',
              lineHeight: '1.6',
            }}>
              ⚠️ Save these credentials now. The password is shown only once. You can login after the administrator approves your registration.
            </div>

            <Link
              href={`/register/${institutionSlug}/login`}
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px' }}
            >
              Go to Student Login →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
