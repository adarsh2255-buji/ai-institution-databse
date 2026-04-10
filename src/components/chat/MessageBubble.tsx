'use client'

import { type UIMessage } from 'ai'
import MarkdownRenderer from './MarkdownRenderer'
import ToolCallIndicator from './ToolCallIndicator'

interface Props {
  message: UIMessage
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  // Extract text content and tool parts from the message parts array
  const textParts = message.parts.filter((p) => p.type === 'text') as Array<{ type: 'text'; text: string }>
  const toolParts = message.parts.filter((p) => p.type.startsWith('tool-') || p.type === 'dynamic-tool') as Array<{
    type: string
    toolCallId: string
    state: string
    toolName?: string
  }>

  // All text content in v6 is in parts (works for both user and assistant)
  const displayText = textParts.map((p) => p.text).join('')

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '12px',
        alignItems: 'flex-start',
        padding: '4px 0',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '15px',
        background: isUser
          ? 'linear-gradient(135deg, var(--accent), var(--info))'
          : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content bubble */}
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Tool calls */}
        {toolParts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {toolParts.map((part) => {
              // Extract tool name from type like 'tool-getStudentMarks' or from toolName field
              const toolName = part.toolName ?? part.type.replace(/^tool-/, '')
              const isDone = part.state === 'output' || part.state === 'error'
              return (
                <ToolCallIndicator
                  key={part.toolCallId}
                  toolName={toolName}
                  state={isDone ? 'result' : 'call'}
                />
              )
            })}
          </div>
        )}

        {/* Text content */}
        {displayText && (
          <div style={{
            padding: isUser ? '12px 16px' : '16px 20px',
            borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
            background: isUser
              ? 'linear-gradient(135deg, var(--accent), rgba(108,99,255,0.8))'
              : 'var(--bg-card)',
            border: isUser ? 'none' : '1px solid var(--border)',
            boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
          }}>
            {isUser ? (
              <p style={{ color: 'white', lineHeight: '1.5', margin: 0 }}>{displayText}</p>
            ) : (
              <MarkdownRenderer content={displayText} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
