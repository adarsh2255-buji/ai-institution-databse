"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"

export default function AdminStaffAttendancePage() {
  const { institutionSlug } = useParams()
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [staffData, setStaffData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/staff-attendance?date=${date}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to fetch attendance")
      setStaffData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const formatHours = (hours: number) => {
    if (!hours) return "0h 0m"
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const formatTime = (isoString: string) => {
    if (!isoString) return "—"
    return new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <span style={{ padding: "4px 8px", background: "rgba(16,185,129,0.1)", color: "#10B981", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>PRESENT</span>
      case "half-day": return <span style={{ padding: "4px 8px", background: "rgba(234,179,8,0.1)", color: "#EAB308", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>HALF-DAY</span>
      case "absent": return <span style={{ padding: "4px 8px", background: "rgba(239,68,68,0.1)", color: "#EF4444", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>ABSENT</span>
      default: return null
    }
  }

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return
    try {
      const res = await fetch("/api/admin/staff-attendance/delete-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      })
      if (!res.ok) throw new Error("Failed to delete")
      fetchAttendance()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0 }}>Staff Attendance</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>Manage daily working hours and sessions.</p>
        </div>
        <div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
        </div>
      </div>

      {error && <div style={{ color: "var(--danger)", marginBottom: "16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}><span className="spinner" /> Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {staffData.map(staff => {
            const dayData = staff.attendance[date] || { total_hours: 0, status: "absent", sessions: [] }
            return (
              <StaffRow
                key={staff.id}
                staff={staff}
                date={date}
                dayData={dayData}
                formatHours={formatHours}
                formatTime={formatTime}
                getStatusBadge={getStatusBadge}
                onRefresh={fetchAttendance}
                onDelete={handleDeleteSession}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function StaffRow({ staff, date, dayData, formatHours, formatTime, getStatusBadge, onRefresh, onDelete }: any) {
  const [expanded, setExpanded] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newIn, setNewIn] = useState("")
  const [newOut, setNewOut] = useState("")

  const handleAddSession = async () => {
    if (!newIn || !newOut) return alert("Please fill both times")
    const inTime = new Date(`${date}T${newIn}`)
    const outTime = new Date(`${date}T${newOut}`)
    
    try {
      const res = await fetch("/api/admin/staff-attendance/add-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: staff.id,
          date,
          check_in_time: inTime.toISOString(),
          check_out_time: outTime.toISOString()
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setShowAdd(false)
      setNewIn("")
      setNewOut("")
      onRefresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
      <div 
        style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: expanded ? "var(--bg-primary)" : "transparent" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", fontWeight: 800 }}>
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "15px" }}>{staff.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "capitalize" }}>{staff.role}</div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Hours</div>
            <div style={{ fontWeight: 700, fontSize: "14px" }}>{formatHours(dayData.total_hours)}</div>
          </div>
          <div style={{ width: "80px", textAlign: "right" }}>
            {getStatusBadge(dayData.status)}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ fontSize: "13px", margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sessions</h4>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: "11px", padding: "4px 8px" }}>
              + Add Session
            </button>
          </div>

          {showAdd && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", padding: "12px", background: "var(--bg-card)", borderRadius: "8px" }}>
              <input type="time" value={newIn} onChange={e => setNewIn(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)" }} />
              <span style={{ color: "var(--text-muted)" }}>to</span>
              <input type="time" value={newOut} onChange={e => setNewOut(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)" }} />
              <button className="btn btn-primary btn-sm" onClick={handleAddSession} style={{ padding: "6px 12px", fontSize: "12px" }}>Save</button>
            </div>
          )}

          {dayData.sessions.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No sessions recorded for this day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {dayData.sessions.map((s: any) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                  <div style={{ fontSize: "13px", fontFamily: "monospace" }}>
                    {formatTime(s.check_in_time)} — {formatTime(s.check_out_time)}
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{formatHours(s.duration)}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => onDelete(s.id)} style={{ color: "var(--danger)", padding: "4px" }} title="Delete Session">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
