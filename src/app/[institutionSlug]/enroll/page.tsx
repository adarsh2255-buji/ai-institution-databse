'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function EnrollPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    studentName: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    batchName: '',
    dateOfBirth: '',
    message: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/student-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, institutionSlug }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Submission failed. Please try again.')
        return
      }
      setStep('success')
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
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,189,248,0.12), transparent)' }} />

      <div style={{ width: '100%', maxWidth: '540px', position: 'relative' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎓</div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Student Enrollment</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Submit your enrollment request — an administrator will review and confirm admission.
          </p>
        </div>

        {step === 'success' ? (
          <div className="glass-card animate-fade-in" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', margin: '0 auto 20px',
            }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Request Submitted!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
              Your enrollment request has been submitted. The institution administrator will review it and contact you at <strong>{form.parentEmail}</strong>.
            </p>
            <Link href={`/${institutionSlug}/login`} className="btn btn-ghost" style={{ display: 'inline-flex' }}>
              ← Back to login
            </Link>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '32px' }}>
            {error && (
              <div style={{ padding: '12px 14px', marginBottom: '18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Student info */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Student Information
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Student Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input id="studentName" name="studentName" className="input" placeholder="Full name of student" value={form.studentName} onChange={handleChange} required />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Date of Birth</span>
                      <input id="dateOfBirth" name="dateOfBirth" type="date" className="input" value={form.dateOfBirth} onChange={handleChange} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Preferred Batch</span>
                      <input id="batchName" name="batchName" className="input" placeholder="e.g. Class 10 A" value={form.batchName} onChange={handleChange} />
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)' }} />

              {/* Parent/Guardian info */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Parent / Guardian
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>Parent Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                    <input id="parentName" name="parentName" className="input" placeholder="Guardian full name" value={form.parentName} onChange={handleChange} required />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Email <span style={{ color: 'var(--danger)' }}>*</span></span>
                      <input id="parentEmail" name="parentEmail" type="email" className="input" placeholder="parent@email.com" value={form.parentEmail} onChange={handleChange} required />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Phone <span style={{ color: 'var(--danger)' }}>*</span></span>
                      <input id="parentPhone" name="parentPhone" type="tel" className="input" placeholder="+91 XXXXX XXXXX" value={form.parentPhone} onChange={handleChange} required />
                    </label>
                  </div>
                </div>
              </div>

              {/* Optional message */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Message (optional)</span>
                <textarea
                  id="message"
                  name="message"
                  className="input"
                  placeholder="Any additional notes for the institution…"
                  rows={3}
                  value={form.message}
                  onChange={handleChange}
                  style={{ resize: 'vertical' }}
                />
              </label>

              <button
                id="enroll-submit"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="spinner" /> Submitting…
                  </span>
                ) : 'Submit Enrollment Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
