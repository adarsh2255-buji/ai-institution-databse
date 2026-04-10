import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Link from 'next/link'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props { params: Promise<{ institutionSlug: string }> }

export default async function StudentDashboard({ params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/register/${institutionSlug}/login`)

  const { data: student } = await supabaseAdmin
    .from('students')
    .select(`
      id, name, registration_no, student_class, dob,
      medium, photo_url, gender, school_name,
      father_name, mother_name, address, phone, whatsapp_number, email,
      password_changed, profile_completed, status,
      institutions(name, slug)
    `)
    .eq('user_id', user.id)
    .single()

  if (!student) redirect(`/register/${institutionSlug}/login`)

  // Guard: force completion of mandatory steps
  if (!student.password_changed) redirect(`/register/${institutionSlug}/change-password`)
  if (!student.profile_completed) redirect(`/register/${institutionSlug}/setup-profile`)

  const institution = student.institutions as { name: string; slug: string } | null

  const infoItems = [
    { icon: '🏫', label: 'School', value: student.school_name },
    { icon: '📚', label: 'Medium', value: student.medium },
    { icon: '🧍', label: 'Gender', value: student.gender },
    { icon: '🎂', label: 'Date of Birth', value: student.dob ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null },
    { icon: '👨', label: 'Father', value: student.father_name },
    { icon: '👩', label: 'Mother', value: student.mother_name },
    { icon: '📞', label: 'Phone', value: student.phone },
    { icon: '💬', label: 'WhatsApp', value: student.whatsapp_number },
    { icon: '✉️', label: 'Email', value: student.email },
    { icon: '🏠', label: 'Address', value: student.address },
  ].filter((item) => item.value)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)', padding: '0',
    }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(108,99,255,0.12), transparent)', zIndex: 0 }} />

      {/* ── Top Navigation ─────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-glass)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🎓</span>
          <span style={{ fontWeight: '700', fontSize: '15px' }}>{institution?.name}</span>
        </div>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
            Sign Out
          </button>
        </form>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

        {/* ── Profile Hero Card ────────────────────────── */}
        <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '20px', overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Photo */}
            <div style={{
              width: '96px', height: '96px', borderRadius: '50%', flexShrink: 0,
              border: '3px solid rgba(108,99,255,0.35)',
              background: student.photo_url ? 'transparent' : 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: '36px', fontWeight: '700',
              color: 'var(--accent-light)',
              boxShadow: '0 0 24px rgba(108,99,255,0.15)',
            }}>
              {student.photo_url
                ? <img src={student.photo_url} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : student.name?.charAt(0)?.toUpperCase()
              }
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px', lineHeight: '1.2' }}>
                {student.name}
              </h1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {student.student_class && (
                  <span style={{
                    padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    background: 'var(--accent-dim)', color: 'var(--accent-light)',
                    border: '1px solid rgba(108,99,255,0.2)',
                  }}>📖 {student.student_class}</span>
                )}
                <span style={{
                  padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                  background: 'var(--bg-card)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {student.registration_no}
                </span>
                <span style={{
                  padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                  background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>✅ Active</span>
              </div>
            </div>

            {/* Edit button */}
            <Link
              href={`/register/${institutionSlug}/setup-profile`}
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0 }}
            >
              ✏️ Edit Profile
            </Link>
          </div>
        </div>

        {/* ── Info Grid ────────────────────────────────── */}
        <div className="glass-card animate-fade-in" style={{ padding: '24px', marginBottom: '20px', animationDelay: '60ms' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Profile Details
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
            {infoItems.map((item) => (
              <div key={item.label} style={{
                padding: '12px 14px', background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {item.icon} {item.label}
                </p>
                <p style={{ fontSize: '14px', fontWeight: '500', wordBreak: 'break-word' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Institution Info ──────────────────────────── */}
        <div className="glass-card animate-fade-in" style={{ padding: '16px 20px', animationDelay: '120ms', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🏛️</span>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Institution</p>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>{institution?.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
