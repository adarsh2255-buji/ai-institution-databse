'use client'

interface Prompt {
  icon: string
  text: string
  category: string
}

const PROMPTS: Prompt[] = [
  { icon: '📊', text: 'Give me the mark comparison for Amal', category: 'Academic' },
  { icon: '📅', text: 'Show attendance report for Amal this month', category: 'Attendance' },
  { icon: '💰', text: 'What are the pending fees for this month?', category: 'Finance' },
  { icon: '👥', text: 'Give me the full class attendance report for Grade 10', category: 'Class Report' },
  { icon: '📋', text: 'List all students in the Mathematics batch', category: 'Students' },
  { icon: '📈', text: 'Who are the top performers in the last exam?', category: 'Analysis' },
]

interface Props {
  onSelect: (prompt: string) => void
}

export default function SuggestedPrompts({ onSelect }: Props) {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero text */}
      <div style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎓</div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          Ask me anything
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: '1.6' }}>
          I can fetch student marks, attendance, fees, and generate class-level reports — all with natural language.
        </p>
      </div>

      {/* Prompt chips */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '10px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
      }}>
        {PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p.text)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              color: 'inherit',
              animationDelay: `${i * 50}ms`,
            }}
            className="animate-fade-in"
            onMouseEnter={(e) => {
              const t = e.currentTarget
              t.style.borderColor = 'var(--accent)'
              t.style.background = 'var(--accent-dim)'
              t.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget
              t.style.borderColor = 'var(--border)'
              t.style.background = 'var(--bg-card)'
              t.style.transform = 'translateY(0)'
            }}
          >
            <span style={{ fontSize: '22px', flexShrink: 0 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--accent-light)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p.category}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {p.text}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
