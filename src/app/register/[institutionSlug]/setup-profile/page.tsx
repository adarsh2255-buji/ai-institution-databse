'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface StudentProfile {
  name: string
  student_class: string | null
  dob: string | null
  registration_no: string | null
  medium: string | null
  photo_url: string | null
  gender: string | null
  school_name: string | null
  father_name: string | null
  mother_name: string | null
  address: string | null
  phone: string | null
  whatsapp_number: string | null
  email: string | null
}

const MEDIUMS = ['English', 'Malayalam', 'CBSE', 'ICSE']
const GENDERS = ['Male', 'Female', 'Other']

// ── Defined at MODULE level (outside the page) to prevent focus-loss bug ──
// If defined inside the page component, every re-render creates a new
// component type, causing React to unmount/remount the input and lose focus.
interface InputRowProps {
  id: string
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function InputRow({ id, label, name, type = 'text', placeholder = '', required = false, value, onChange }: InputRowProps) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <input
        id={id} name={name} type={type} className="input"
        placeholder={placeholder} value={value}
        onChange={onChange} required={required}
      />
    </div>
  )
}

export default function SetupProfilePage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [checking, setChecking] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  // Editable form state
  const [form, setForm] = useState({
    medium: '', gender: '', school_name: '', father_name: '',
    mother_name: '', address: '', phone: '', whatsapp_number: '', email: '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [userId, setUserId] = useState('')

  // Guard: must be authenticated
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace(`/register/${institutionSlug}/login`); return }
      setUserId(user.id)
      setChecking(false)
      loadProfile()
    })
  }, [])

  async function loadProfile() {
    try {
      const res = await fetch('/api/student/profile')
      if (!res.ok) { router.replace(`/register/${institutionSlug}/login`); return }
      const data: StudentProfile = await res.json()
      setProfile(data)
      // Pre-fill editable fields if they exist
      setForm({
        medium:         data.medium ?? '',
        gender:         data.gender ?? '',
        school_name:    data.school_name ?? '',
        father_name:    data.father_name ?? '',
        mother_name:    data.mother_name ?? '',
        address:        data.address ?? '',
        phone:          data.phone ?? '',
        whatsapp_number: data.whatsapp_number ?? '',
        email:          data.email ?? '',
      })
      if (data.photo_url) setPhotoPreview(data.photo_url)
    } catch {
      setError('Failed to load profile.')
    } finally {
      setLoadingProfile(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Photo must be under 3 MB.'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile || !userId) return null
    setUploadingPhoto(true)
    try {
      const ext = photoFile.name.split('.').pop()
      const path = `${userId}/profile.${ext}`
      const { error } = await supabase.storage
        .from('student-photos')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type })
      if (error) { setError('Photo upload failed: ' + error.message); return null }
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(path)
      return urlData.publicUrl
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Upload photo if selected
      let photoUrl: string | null = profile?.photo_url ?? null
      if (photoFile) {
        const uploaded = await uploadPhoto()
        if (uploaded) photoUrl = uploaded
      }

      const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, photo_url: photoUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to save profile.')
        return
      }
      // Success → student dashboard
      router.push(`/${institutionSlug}/student/dashboard`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (checking || loadingProfile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
      </div>
    )
  }


  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '32px 16px' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(108,99,255,0.09), transparent)' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', justifyContent: 'center' }}>
          {['Change Password', 'Set Up Profile'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: i === 0 ? 'rgba(16,185,129,0.15)' : 'var(--accent)',
                border: `2px solid ${i === 0 ? 'rgba(16,185,129,0.5)' : 'var(--accent)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700',
                color: i === 0 ? '#10B981' : '#fff',
              }}>{i === 0 ? '✓' : '2'}</div>
              <span style={{ fontSize: '12px', color: i === 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === 1 ? '600' : '400' }}>
                {label}
              </span>
              {i < 1 && <div style={{ width: '28px', height: '2px', background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Complete Your Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            This information will appear on your student dashboard.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', marginBottom: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--danger)' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Photo ─────────────────────────── */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Profile Photo
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Avatar preview */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '88px', height: '88px', borderRadius: '50%', flexShrink: 0,
                  background: photoPreview ? 'transparent' : 'var(--accent-dim)',
                  border: '3px solid rgba(108,99,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', cursor: 'pointer', position: 'relative',
                }}
                className="stat-card"
              >
                {photoPreview
                  ? <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '32px' }}>{profile?.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
                }
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                  borderRadius: '50%', fontSize: '18px',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >📷</div>
              </div>
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  {uploadingPhoto ? 'Uploading…' : photoPreview ? '📷 Change Photo' : '📷 Upload Photo'}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  JPG, PNG or WebP. Max 3 MB.
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
            </div>
          </div>

          {/* ── Section 2: Academic Info (read-only) ──────── */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Academic Information <span style={{ fontSize: '10px', fontWeight: '400', color: 'var(--info)' }}>(from registration — read only)</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Full Name', value: profile?.name ?? '—' },
                { label: 'Class', value: profile?.student_class ?? '—' },
                { label: 'Date of Birth', value: profile?.dob ? new Date(profile.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                { label: 'Registration No.', value: profile?.registration_no ?? '—' },
              ].map((item) => (
                <div key={item.label} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{item.label}</label>
                  <div style={{
                    padding: '10px 14px', background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    fontSize: '14px', color: 'var(--text-muted)',
                    fontFamily: item.label === 'Registration No.' ? "'JetBrains Mono', monospace" : undefined,
                    fontWeight: item.label === 'Registration No.' ? '700' : undefined,
                    color2: item.label === 'Registration No.' ? 'var(--accent-light)' : undefined,
                  } as React.CSSProperties}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Medium dropdown — editable academic field */}
            <div className="form-group" style={{ marginTop: '14px', maxWidth: '280px' }}>
              <label className="form-label" htmlFor="medium">
                Medium of Instruction <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select id="medium" name="medium" className="input" value={form.medium} onChange={handleChange} required>
                <option value="">Select medium…</option>
                {MEDIUMS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── Section 3: Personal Info ───────────────────── */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Personal Information
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select id="gender" name="gender" className="input" value={form.gender} onChange={handleChange} required>
                  <option value="">Select gender…</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
               <InputRow id="school_name" label="School Name" name="school_name" placeholder="e.g. St. Mary's HSS" required
                value={form.school_name} onChange={handleChange} />
            </div>
          </div>

          {/* ── Section 4: Family ──────────────────────────── */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Family Details
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <InputRow id="father_name" label="Father's Name" name="father_name" placeholder="Father full name" required
                value={form.father_name} onChange={handleChange} />
              <InputRow id="mother_name" label="Mother's Name" name="mother_name" placeholder="Mother full name" required
                value={form.mother_name} onChange={handleChange} />
            </div>
          </div>

          {/* ── Section 5: Contact ─────────────────────────── */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Contact Details
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <InputRow id="phone" label="Phone Number" name="phone" type="tel" placeholder="+91 XXXXX XXXXX" required
                value={form.phone} onChange={handleChange} />
              <InputRow id="whatsapp_number" label="WhatsApp Number" name="whatsapp_number" type="tel" placeholder="+91 XXXXX XXXXX"
                value={form.whatsapp_number} onChange={handleChange} />
              <InputRow id="email" label="Email Address" name="email" type="email" placeholder="your@email.com"
                value={form.email} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label className="form-label" htmlFor="address">Address <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea id="address" name="address" className="input" placeholder="House No., Street, City, State — PIN"
                value={form.address} onChange={handleChange} required rows={3}
                style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Submit */}
          <button id="profile-submit" type="submit" className="btn btn-primary"
            disabled={saving || uploadingPhoto}
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '600' }}>
            {saving
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" /> Saving Profile…</span>
              : 'Save Profile & Go to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  )
}
