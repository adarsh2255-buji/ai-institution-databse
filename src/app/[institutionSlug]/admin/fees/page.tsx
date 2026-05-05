'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

/* ── Types ──────────────────────────────────────────── */
interface Student {
  id: string; name: string; registration_no: string; batch_name?: string
  total_due: number; total_paid: number; balance: number
  pending_months: number; status: 'paid' | 'partial' | 'pending' | 'no_dues'
}
interface FeePlan { id: string; plan_name: string; monthly_fee: number; batch_id: string | null; is_active: boolean; batches?: { name: string } }
interface Batch { id: string; name: string }
interface Payment { id: string; amount: number; date: string; method: string; note: string }
interface FeeRecord { id: string; month: string; amount_due: number; amount_paid: number; status: string }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success)',    label: '✅ Paid'     },
  partial: { bg: 'rgba(234,179,8,0.12)',   color: '#B45309',           label: '🔶 Partial'  },
  pending: { bg: 'rgba(239,68,68,0.1)',    color: 'var(--danger)',     label: '🔴 Pending'  },
  advance: { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1',           label: '💙 Advance'  },
  no_dues: { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', label: '— No Dues'  },
}

const MONTHS_LIST = (() => {
  const list = []
  const now = new Date()
  for (let i = -2; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
})()

type Tab = 'students' | 'plans' | 'history'

export default function AdminFeesPage() {
  const { institutionSlug } = useParams<{ institutionSlug: string }>()

  /* ── State ── */
  const [tab, setTab] = useState<Tab>('students')
  const [students, setStudents] = useState<Student[]>([])
  const [feePlans, setFeePlans] = useState<FeePlan[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [summary, setSummary] = useState({ total_due: 0, total_paid: 0, total_balance: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [searchQ, setSearchQ] = useState('')

  /* ── Payment modal ── */
  const [payModal, setPayModal] = useState(false)
  const [payStudent, setPayStudent] = useState<Student | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  /* ── Student detail modal ── */
  const [detailStudent, setDetailStudent] = useState<Student | null>(null)
  const [detailPayments, setDetailPayments] = useState<Payment[]>([])
  const [detailFees, setDetailFees] = useState<FeeRecord[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [planModal, setPlanModal] = useState(false)
  const [planName, setPlanName] = useState('')
  const [planBatch, setPlanBatch] = useState('')
  const [planFee, setPlanFee] = useState('')
  const [planYearStart, setPlanYearStart] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [planYearEnd, setPlanYearEnd] = useState(() => {
    const now = new Date()
    // Default: next March
    const endYear = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear()
    return `${endYear}-03`
  })
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')

  const [genModal, setGenModal] = useState(false)
  const [genPlan, setGenPlan] = useState('')
  const [genMonths, setGenMonths] = useState<string[]>([new Date().toISOString().slice(0, 7)])
  const [genLoading, setGenLoading] = useState(false)
  const [genMsg, setGenMsg] = useState('')

  /* ── Delete fee plan ── */
  const [deletePlanTarget, setDeletePlanTarget] = useState<FeePlan | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (batchFilter !== 'all') params.set('batch_id', batchFilter)
      const res = await fetch(`/api/admin/fees?${params}`)
      const data = await res.json()
      setStudents(data.students || [])
      setFeePlans(data.feePlans || [])
      setBatches(data.batches || [])
      setSummary(data.summary || { total_due: 0, total_paid: 0, total_balance: 0 })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, batchFilter])

  useEffect(() => { loadData() }, [loadData])

  /* ── Open student detail ── */
  async function openDetail(s: Student) {
    setDetailStudent(s)
    setDetailLoading(true)
    const res = await fetch(`/api/admin/fee-payments?student_id=${s.id}`)
    const data = await res.json()
    setDetailPayments(data.payments || [])
    setDetailFees(data.fees || [])
    setDetailLoading(false)
  }

  /* ── Record payment ── */
  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payStudent) return
    setPayError(''); setPayLoading(true)
    try {
      const res = await fetch('/api/admin/fee-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: payStudent.id, amount: Number(payAmount), method: payMethod, note: payNote, date: payDate }),
      })
      const data = await res.json()
      if (!res.ok) { setPayError(data.error); return }
      setPayModal(false); setPayAmount(''); setPayNote('')
      loadData()
      if (detailStudent?.id === payStudent.id) openDetail(payStudent)
    } finally { setPayLoading(false) }
  }

  /* ── Delete payment ── */
  async function deletePayment(paymentId: string) {
    if (!confirm('Delete this payment? Dues will be recalculated.')) return
    await fetch(`/api/admin/fee-payments/${paymentId}`, { method: 'DELETE' })
    if (detailStudent) openDetail(detailStudent)
    loadData()
  }

  /* ── Create fee plan ── */
  async function submitPlan(e: React.FormEvent) {
    e.preventDefault()
    setPlanError(''); setPlanLoading(true)
    try {
      const res = await fetch('/api/admin/fee-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          batch_id: planBatch || null,
          monthly_fee: Number(planFee),
          year_start: planYearStart,
          year_end: planYearEnd,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setPlanError(data.error); return }
      setPlanModal(false); setPlanName(''); setPlanBatch(''); setPlanFee('')
      loadData()
    } finally { setPlanLoading(false) }
  }

  async function deleteFeePlan() {
    if (!deletePlanTarget) return
    setDeleteError(''); setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/fee-plans/${deletePlanTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setDeleteError(data.error); return }
      setDeletePlanTarget(null)
      loadData()
    } finally { setDeleteLoading(false) }
  }

  async function submitGenerateDues(e: React.FormEvent) {
    e.preventDefault()
    setGenMsg(''); setGenLoading(true)
    try {
      const res = await fetch('/api/admin/fee-plans/generate-dues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee_plan_id: genPlan }),
      })
      const data = await res.json()
      if (!res.ok) { setGenMsg(`Error: ${data.error}`); return }
      setGenMsg(`✅ ${data.message}`)
      loadData()
    } finally { setGenLoading(false) }
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    s.registration_no?.toLowerCase().includes(searchQ.toLowerCase())
  )

  /* ──────────────────────────────────────────────────── RENDER ── */
  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>💳 Fees Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Track, collect and manage student fees</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setGenModal(true)} className="btn btn-ghost btn-sm">📋 Generate Dues</button>
          <button onClick={() => setPlanModal(true)} className="btn btn-primary btn-sm">+ New Fee Plan</button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Due', value: summary.total_due, color: 'var(--text-primary)' },
          { label: 'Total Collected', value: summary.total_paid, color: 'var(--success)' },
          { label: 'Outstanding Balance', value: Math.abs(summary.total_balance), color: summary.total_balance < 0 ? 'var(--danger)' : 'var(--success)' },
        ].map(card => (
          <div key={card.label} className="glass-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: card.color }}>₹{card.value.toLocaleString('en-IN')}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', marginBottom: '16px' }}>
        {([['students', '👥 Students'], ['plans', '📑 Fee Plans'], ['history', '📜 History']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
            background: tab === id ? 'var(--accent)' : 'transparent',
            color: tab === id ? '#fff' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      {/* ══════ STUDENTS TAB ══════ */}
      {tab === 'students' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input className="input" placeholder="🔍 Search student…" value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '8px 12px', fontSize: '13px' }} />
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', fontSize: '13px' }}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <select className="input" value={batchFilter} onChange={e => setBatchFilter(e.target.value)} style={{ padding: '8px 12px', fontSize: '13px' }}>
              <option value="all">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Student Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}><span className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No students found</div>
            ) : (
              <>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 90px 80px', gap: '8px', padding: '10px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Student</span><span style={{ textAlign: 'right' }}>Due</span><span style={{ textAlign: 'right' }}>Paid</span><span style={{ textAlign: 'right' }}>Balance</span><span style={{ textAlign: 'center' }}>Status</span><span style={{ textAlign: 'center' }}>Action</span>
                </div>
                {filtered.map(s => {
                  const st = STATUS_STYLE[s.status] || STATUS_STYLE.pending
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 90px 80px', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => openDetail(s)}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.registration_no}{s.batch_name ? ` · ${s.batch_name}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>₹{s.total_due.toLocaleString('en-IN')}</div>
                      <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--success)' }}>₹{s.total_paid.toLocaleString('en-IN')}</div>
                      <div style={{ textAlign: 'right', fontSize: '13px', color: s.balance < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                        {s.balance < 0 ? `-₹${Math.abs(s.balance).toLocaleString('en-IN')}` : `₹${s.balance.toLocaleString('en-IN')}`}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, ...st }}>{st.label}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); setPayStudent(s); setPayModal(true) }}
                          className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>
                          + Pay
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════ FEE PLANS TAB ══════ */}
      {tab === 'plans' && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {feePlans.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No fee plans yet. Create one to get started.
            </div>
          ) : feePlans.map((plan, i) => (
            <div key={plan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < feePlans.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{plan.plan_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {plan.batches?.name ? `Batch: ${plan.batches.name}` : 'All Batches'} · ₹{plan.monthly_fee.toLocaleString('en-IN')}/month
                  {(plan as any).year_start ? ` · ${(plan as any).year_start} → ${(plan as any).year_end}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: plan.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: plan.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                  {plan.is_active ? '● Active' : '○ Inactive'}
                </span>
                <button
                  onClick={() => { setDeleteError(''); setDeletePlanTarget(plan) }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)', fontSize: '12px', padding: '4px 10px' }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════ HISTORY TAB ══════ */}
      {tab === 'history' && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px', fontSize: '14px' }}>
          Select a student from the Students tab to view their payment history.
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* ── Payment Modal ── */}
      {payModal && payStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Record Payment</h2>
              <button onClick={() => setPayModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 600 }}>{payStudent.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Balance due: ₹{Math.abs(Math.min(payStudent.balance, 0)).toLocaleString('en-IN')}</div>
            </div>
            {payError && <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)', marginBottom: '12px' }}>⚠️ {payError}</div>}
            <form onSubmit={submitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="input" type="number" min="1" placeholder="e.g. 1000" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input className="input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Method</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="cash">💵 Cash</option>
                  <option value="upi">📱 UPI</option>
                  <option value="online">🌐 Online</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="input" placeholder="e.g. April fee payment" value={payNote} onChange={e => setPayNote(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setPayModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={payLoading} style={{ flex: 1 }}>
                  {payLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" />Saving…</span> : '✓ Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Student Detail Modal ── */}
      {detailStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '0', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>{detailStudent.name}</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{detailStudent.registration_no}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setPayStudent(detailStudent); setPayModal(true) }} className="btn btn-primary btn-sm">+ Payment</button>
                <button onClick={() => setDetailStudent(null)} className="btn btn-ghost btn-sm">✕</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
              {detailLoading ? <div style={{ textAlign: 'center', padding: '32px' }}><span className="spinner" /></div> : (() => {
                // Compute live from fetched data — works even with no dues generated
                const liveTotalDue  = detailFees.reduce((s, f) => s + Number(f.amount_due), 0)
                const liveTotalPaid = detailPayments.reduce((s, p) => s + Number(p.amount), 0)
                const liveBalance   = liveTotalPaid - liveTotalDue // positive = advance, negative = owes
                return (
                <>
                  {/* Summary Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    {[
                      { label: 'Total Due',  value: liveTotalDue,           color: 'var(--text-primary)' },
                      { label: 'Collected',  value: liveTotalPaid,          color: 'var(--success)' },
                      { label: liveBalance >= 0 ? 'Advance' : 'Balance Due', value: Math.abs(liveBalance), color: liveBalance < 0 ? 'var(--danger)' : 'var(--success)' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: s.color }}>₹{s.value.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Monthly Breakdown */}
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Monthly Dues</div>
                  {detailFees.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px' }}>No dues generated yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                      {detailFees.map(f => {
                        const st = STATUS_STYLE[f.status] || STATUS_STYLE.pending
                        return (
                          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{f.month}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>Due: ₹{Number(f.amount_due).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--success)' }}>Paid: ₹{Number(f.amount_paid).toLocaleString('en-IN')}</span>
                              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, ...st }}>{st.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Payment History */}
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Payment History</div>
                  {detailPayments.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: '8px' }}>No payments recorded yet</div>
                  ) : (
                    detailPayments.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--success)' }}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.date} · {p.method}{p.note ? ` · ${p.note}` : ''}</div>
                        </div>
                        <button onClick={() => deletePayment(p.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: '11px' }}>🗑 Delete</button>
                      </div>
                    ))
                  )}
                </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Fee Plan Modal ── */}
      {planModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>New Fee Plan</h2>
              <button onClick={() => setPlanModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            {planError && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)', marginBottom: '12px' }}>⚠️ {planError}</div>}
            <form onSubmit={submitPlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Plan Name</label>
                <input className="input" placeholder="e.g. 2025-26 Academic Year" value={planName} onChange={e => setPlanName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Batch (optional)</label>
                <select className="input" value={planBatch} onChange={e => setPlanBatch(e.target.value)}>
                  <option value="">All Batches</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Fee (₹)</label>
                <input className="input" type="number" min="1" placeholder="e.g. 1500" value={planFee} onChange={e => setPlanFee(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Academic Year Start</label>
                  <input className="input" type="month" value={planYearStart} onChange={e => setPlanYearStart(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year End</label>
                  <input className="input" type="month" value={planYearEnd} onChange={e => setPlanYearEnd(e.target.value)} required />
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                📅 Students joining in {planYearStart} get {(() => { try {
                  const [sy, sm] = planYearStart.split('-').map(Number)
                  const [ey, em] = planYearEnd.split('-').map(Number)
                  return (ey - sy) * 12 + (em - sm) + 1
                } catch { return '?' } })()} months. Later joiners get fewer months automatically.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setPlanModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={planLoading} style={{ flex: 1 }}>
                  {planLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><span className="spinner" />Creating…</span> : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Generate Dues Modal ── */}
      {genModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Generate Monthly Dues</h2>
              <button onClick={() => setGenModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              💡 Dues are generated per-student based on their <strong>joining date</strong> and the plan's academic year. Students who joined later automatically get fewer months.
            </div>
            {genMsg && <div style={{ padding: '10px', background: genMsg.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '13px', color: genMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)', marginBottom: '12px' }}>{genMsg}</div>}
            <form onSubmit={submitGenerateDues} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Fee Plan</label>
                <select className="input" value={genPlan} onChange={e => setGenPlan(e.target.value)} required>
                  <option value="">Select a plan…</option>
                  {feePlans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} — ₹{p.monthly_fee}/month
                      {(p as any).year_start ? ` (${(p as any).year_start} → ${(p as any).year_end})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {genPlan && (() => {
                const plan = feePlans.find(p => p.id === genPlan) as any
                if (!plan?.year_start) return null
                const [sy, sm] = plan.year_start.split('-').map(Number)
                const [ey, em] = plan.year_end.split('-').map(Number)
                const totalMonths = (ey - sy) * 12 + (em - sm) + 1
                return (
                  <div style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Academic Year Preview</div>
                    <div style={{ fontWeight: 600 }}>{plan.year_start} → {plan.year_end} ({totalMonths} months max)</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Each student gets months from their joining date to year end.</div>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setGenModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={genLoading || !genPlan} style={{ flex: 1 }}>
                  {genLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><span className="spinner" />Generating…</span> : '📋 Generate Dues'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Delete Fee Plan Warning Modal ── */}
      {deletePlanTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '28px' }}>
            {/* Warning icon */}
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Delete Fee Plan?</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '8px' }}>
              You are about to delete <strong style={{ color: 'var(--text-primary)' }}>"{deletePlanTarget.plan_name}"</strong>.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
              This will permanently delete <strong style={{ color: 'var(--danger)' }}>all monthly due records</strong> linked to this plan. Student payment records will not be affected. <strong>This action cannot be undone.</strong>
            </p>
            {deleteError && (
              <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)', marginBottom: '14px' }}>
                ⚠️ {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDeletePlanTarget(null)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={deleteFeePlan}
                className="btn"
                disabled={deleteLoading}
                style={{ flex: 1, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {deleteLoading
                  ? <><span className="spinner" /> Deleting…</>
                  : '🗑 Yes, Delete Plan'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
