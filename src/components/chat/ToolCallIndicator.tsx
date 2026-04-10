'use client'

const TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  getStudentMarks:     { icon: '📊', label: 'Fetching exam marks…' },
  getBatchMarks:       { icon: '📋', label: 'Loading class results…' },
  getStudentAttendance:{ icon: '📅', label: 'Pulling attendance data…' },
  getBatchAttendance:  { icon: '👥', label: 'Aggregating class attendance…' },
  getStudentFees:      { icon: '💰', label: 'Retrieving fee records…' },
  getPendingFees:      { icon: '⚠️', label: 'Checking pending fees…' },
  listStudents:        { icon: '👤', label: 'Loading student list…' },
  getMyChildAttendance:{ icon: '📅', label: 'Fetching attendance…' },
  getMyChildMarks:     { icon: '📊', label: 'Loading marks…' },
  getMyChildFees:      { icon: '💰', label: 'Checking fees…' },
}

interface Props {
  toolName: string
  state: 'call' | 'result' | 'partial-call'
}

export default function ToolCallIndicator({ toolName, state }: Props) {
  const info = TOOL_LABELS[toolName] ?? { icon: '🔍', label: `Running ${toolName}…` }
  const isDone = state === 'result'

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      borderRadius: '20px',
      background: isDone ? 'var(--success-dim)' : 'var(--accent-dim)',
      border: `1px solid ${isDone ? 'rgba(34,211,165,0.2)' : 'rgba(108,99,255,0.2)'}`,
      fontSize: '13px',
      color: isDone ? 'var(--success)' : 'var(--accent-light)',
      margin: '4px 0',
    }}>
      <span>{info.icon}</span>
      {!isDone && <span className="animate-pulse">●</span>}
      <span>{isDone ? '✓ Done' : info.label}</span>
    </div>
  )
}
