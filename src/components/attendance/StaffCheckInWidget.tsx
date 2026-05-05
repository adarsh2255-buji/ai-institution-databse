"use client"

import { useState, useEffect, useCallback } from "react"

export default function StaffCheckInWidget() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<any[]>([])
  const [openSession, setOpenSession] = useState<any | null>(null)
  const [error, setError] = useState("")
  const [now, setNow] = useState(new Date())

  // Refresh clock every minute for UI duration calculation
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/staff/my-attendance")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load attendance")
      
      setOpenSession(data.openSession)
      setSummary(data.dailySummary)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  const handleAction = async (type: "check-in" | "check-out") => {
    setProcessing(true)
    setError("")
    try {
      const res = await fetch(`/api/staff/${type}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to ${type}`)
      
      // Reload the data
      await fetchAttendance()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  // Calculate today's existing closed hours
  const todayStr = new Date().toISOString().split("T")[0]
  const todaySummary = summary.find(s => s.date === todayStr)
  let existingHours = todaySummary ? todaySummary.total_hours : 0

  // Calculate current open session hours
  let currentSessionHours = 0
  if (openSession) {
    const checkInTime = new Date(openSession.check_in_time)
    currentSessionHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
  }

  const totalHoursToday = existingHours + currentSessionHours

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: "20px", opacity: 0.6 }}>
        <span className="spinner" style={{ width: "14px", height: "14px", marginRight: "8px" }} />
        <span style={{ fontSize: "13px" }}>Loading attendance...</span>
      </div>
    )
  }

  return (
    <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⏱️</span> Today's Attendance
        </h3>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>

      {error && <div style={{ color: "var(--danger)", fontSize: "13px", padding: "8px", background: "rgba(239,68,68,0.1)", borderRadius: "6px" }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "var(--bg-primary)", padding: "16px", borderRadius: "10px" }}>
        {/* Status & Hours */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            Total Working Hours
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: totalHoursToday > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
            {formatHours(totalHoursToday)}
          </div>
          {openSession && (
            <div style={{ fontSize: "13px", color: "#10B981", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse 2s infinite" }} />
              Checked in at {formatTime(openSession.check_in_time)}
            </div>
          )}
          {!openSession && todaySummary?.sessions.length > 0 && (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              {todaySummary.sessions.length} session{todaySummary.sessions.length > 1 ? "s" : ""} closed today
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {openSession ? (
            <button
              className="btn btn-sm"
              onClick={() => handleAction("check-out")}
              disabled={processing}
              style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 600, background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              {processing ? <span className="spinner" /> : "Log Out / Break"}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAction("check-in")}
              disabled={processing}
              style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 600, background: "var(--primary)", color: "#fff" }}
            >
              {processing ? <span className="spinner" /> : todaySummary?.sessions.length > 0 ? "Resume Work" : "Check In"}
            </button>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  )
}
