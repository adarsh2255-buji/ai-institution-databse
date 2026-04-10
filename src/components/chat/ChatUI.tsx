'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState } from 'react'
import MessageBubble from '@/components/chat/MessageBubble'
import SuggestedPrompts from '@/components/chat/SuggestedPrompts'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: { institutionSlug: string }
  role: 'admin' | 'teacher' | 'parent'
  centerName: string
}

export default function ChatUI({ params, role, centerName }: Props) {
  const { institutionSlug } = params
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { institutionSlug },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handlePromptSelect(prompt: string) {
    setInput(prompt)
  }

  function handleSend() {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input.trim() })
    setInput('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const roleLabel = role === 'parent' ? 'Parent View' : role === 'admin' ? 'Admin' : 'Teacher'
  const roleBadgeClass = role === 'admin' ? 'badge-accent' : role === 'teacher' ? 'badge-info' : 'badge-success'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px' }}>🎓</span>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>EduAI</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '32px' }}>{centerName}</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ padding: '6px 12px 4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Navigation
          </div>
          <Link href={`/${institutionSlug}/chat`} className="nav-item active">
            <span>💬</span> AI Assistant
          </Link>
          {role !== 'parent' && (
            <Link href={`/${institutionSlug}/admin`} className="nav-item">
              <span>📊</span> Dashboard
            </Link>
          )}
          {role === 'parent' && (
            <Link href={`/${institutionSlug}/parent`} className="nav-item">
              <span>👦</span> My Child
            </Link>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className={`badge ${roleBadgeClass}`} style={{ fontSize: '11px', padding: '2px 8px', marginBottom: '4px', display: 'inline-flex' }}>
                {roleLabel}
              </span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>/{institutionSlug}</p>
            </div>
            <button onClick={handleSignOut} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', fontSize: '12px' }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: '600' }}>AI Assistant</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Powered by GPT-4o · Ask anything about your students
            </p>
          </div>
          {status === 'error' && (
            <span className="badge badge-danger">Connection error</span>
          )}
        </header>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {messages.length === 0 ? (
            <SuggestedPrompts onSelect={handlePromptSelect} />
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))
          )}

          {/* Typing indicator */}
          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
              }}>🤖</div>
              <div style={{
                padding: '14px 18px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '18px 18px 18px 6px',
                display: 'flex', gap: '5px', alignItems: 'center',
              }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'inline-block',
                    animation: `pulse 1.2s ease infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--danger-dim)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '13px',
            }}>
              ⚠️ {error.message}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 12px 12px 16px',
          }}>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask me about marks, attendance, fees… (Enter to send)"
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                resize: 'none',
                lineHeight: '1.5',
                maxHeight: '120px',
                overflowY: 'auto',
              }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              id="chat-send"
              type="button"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '10px', padding: '10px 16px', flexShrink: 0 }}
            >
              {isLoading ? '⏳' : '↑'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
            AI may make mistakes. Verify critical data in admin records.
          </p>
        </div>
      </div>
    </div>
  )
}
