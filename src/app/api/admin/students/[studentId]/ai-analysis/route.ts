import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ── Helpers ──────────────────────────────────────────── */
function calcTrend(scores: number[]): "improving" | "declining" | "stable" {
  if (scores.length < 2) return "stable"
  const half   = Math.ceil(scores.length / 2)
  const avg    = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const diff   = avg(scores.slice(half)) - avg(scores.slice(0, half))
  if (diff > 5) return "improving"
  if (diff < -5) return "declining"
  return "stable"
}

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : 0
}

/* ── Fetch raw data ───────────────────────────────────── */
async function fetchRaw(studentId: string, institutionId: string) {
  const [studentRes, marksRes, attendanceRes, feesRes] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id, name, student_class, joined_at, batches(name)")
      .eq("id", studentId)
      .eq("institution_id", institutionId)
      .single(),

    supabaseAdmin
      .from("marks")
      .select("marks_obtained, absent, exams(name, max_marks, held_on, subjects(name))")
      .eq("student_id", studentId)
      .eq("institution_id", institutionId)
      .order("exams(held_on)", { ascending: true }),

    supabaseAdmin
      .from("attendance")
      .select("date, status")
      .eq("student_id", studentId)
      .eq("institution_id", institutionId)
      .order("date", { ascending: false }),

    supabaseAdmin
      .from("fees")
      .select("amount_due, amount_paid, status, month")
      .eq("student_id", studentId)
      .eq("institution_id", institutionId),
  ])

  return {
    student:    studentRes.data,
    marks:      marksRes.data   ?? [],
    attendance: attendanceRes.data ?? [],
    fees:       feesRes.data ?? [],
  }
}

/* ── Build structured metrics ─────────────────────────── */
function buildMetrics(raw: Awaited<ReturnType<typeof fetchRaw>>) {
  const { student, marks, attendance, fees } = raw

  /* Attendance */
  const totalSessions = attendance.length
  const presentCount  = attendance.filter(a => a.status === "present").length
  const attendancePct = totalSessions > 0 ? pct(presentCount, totalSessions) : null

  let attendanceTrend: "improving" | "declining" | "stable" = "stable"
  if (attendance.length >= 10) {
    const recentSlice = attendance.slice(0, 14)
    const olderSlice  = attendance.slice(14, 28)
    const r = pct(recentSlice.filter(a => a.status === "present").length, recentSlice.length)
    const o = olderSlice.length > 0
      ? pct(olderSlice.filter(a => a.status === "present").length, olderSlice.length)
      : r
    if (r - o > 10) attendanceTrend = "improving"
    else if (o - r > 10) attendanceTrend = "declining"
  }

  /* Subject performance */
  const subjectMap: Record<string, number[]> = {}
  for (const m of marks) {
    if (m.absent) continue
    const exam    = Array.isArray(m.exams) ? m.exams[0] : m.exams as any
    if (!exam?.max_marks) continue
    const subject = (Array.isArray(exam.subjects) ? exam.subjects[0] : exam.subjects)?.name ?? "General"
    const p       = pct(m.marks_obtained, exam.max_marks)
    subjectMap[subject] = [...(subjectMap[subject] ?? []), p]
  }

  const subjects = Object.entries(subjectMap).map(([subject, scores]) => ({
    subject,
    scores,
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    trend:   calcTrend(scores),
  })).slice(0, 6)

  /* Overall */
  const allScores = marks
    .filter(m => !m.absent)
    .flatMap(m => {
      const exam = (Array.isArray(m.exams) ? m.exams[0] : m.exams) as any
      return exam?.max_marks ? [pct(m.marks_obtained, exam.max_marks)] : []
    })

  const overallAvg   = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
  const lastExamPct  = allScores.length > 0 ? allScores[allScores.length - 1] : null
  const overallTrend = calcTrend(allScores)

  /* Fees */
  const totalDue   = fees.reduce((s, f) => s + Number(f.amount_due), 0)
  const totalPaid  = fees.reduce((s, f) => s + Number(f.amount_paid), 0)
  const pendingFees = fees.filter(f => f.status === "pending" || f.status === "partial")
  const feesStatus  = totalDue === 0 ? "no_dues" : pendingFees.length > 0 ? "pending" : "paid"

  /* Risk level */
  const lowAtt  = attendancePct !== null && attendancePct < 60
  const lowMark = overallAvg !== null && overallAvg < 50
  const riskLevel: "low" | "medium" | "high" =
    (lowAtt && lowMark) ? "high"
    : (lowAtt || lowMark || overallTrend === "declining") ? "medium"
    : "low"

  return {
    studentName:        student?.name ?? "Unknown",
    className:          student?.student_class ?? null,
    batchName:          ((Array.isArray(student?.batches) ? student?.batches[0] : student?.batches) as any)?.name ?? null,
    attendancePct,
    attendanceTrend,
    subjects,
    lastExamPct,
    overallAvg,
    overallTrend,
    feesStatus,
    totalDue,
    totalPaid,
    pendingMonths:      pendingFees.length,
    hasExamData:        marks.length > 0,
    hasAttendanceData:  attendance.length > 0,
    riskLevel,
    subjectCount:       subjects.length,
    examCount:          marks.length,
  }
}

/* ── Rule-based AI report generator ──────────────────── */
function generateRuleBasedReport(m: ReturnType<typeof buildMetrics>) {
  const strengths:   string[] = []
  const weaknesses:  string[] = []
  const suggestions: string[] = []

  /* ── SUMMARY ── */
  let summary = ""

  if (!m.hasExamData && !m.hasAttendanceData) {
    summary = "No data available yet for this student. Record attendance and exam scores to unlock AI insights."
  } else if (!m.hasExamData) {
    const attMsg = m.attendancePct !== null
      ? `Attendance is at ${m.attendancePct}% (${m.attendanceTrend}).`
      : "No attendance data recorded yet."
    summary = `${attMsg} No exam results found — add marks to get a complete performance analysis.`
  } else {
    const avgLabel = m.overallAvg! >= 70 ? "performing well" : m.overallAvg! >= 50 ? "performing at an average level" : "underperforming"
    const trendMsg = m.subjectCount < 2 ? "" : ` Overall trend is ${m.overallTrend}.`
    const worstSubject = [...m.subjects].sort((a, b) => a.average - b.average)[0]
    const worstNote = worstSubject && worstSubject.average < 60
      ? ` ${worstSubject.subject} requires immediate attention (${worstSubject.average}%).`
      : ""
    summary = `${m.studentName} is ${avgLabel} with an overall average of ${m.overallAvg}%.${trendMsg}${worstNote}`
  }

  /* ── STRENGTHS ── */
  if (m.attendancePct !== null && m.attendancePct >= 85) {
    strengths.push(`Excellent attendance at ${m.attendancePct}% — consistently showing up for classes`)
  } else if (m.attendancePct !== null && m.attendancePct >= 75) {
    strengths.push(`Good attendance at ${m.attendancePct}%`)
  }

  const strongSubjects = m.subjects.filter(s => s.average >= 75)
  strongSubjects.slice(0, 2).forEach(s => {
    strengths.push(`Strong performance in ${s.subject} (${s.average}% average${s.scores.length > 1 ? `, ${s.trend}` : ""})`)
  })

  const improvingSubjects = m.subjects.filter(s => s.trend === "improving" && s.average >= 55)
  if (improvingSubjects.length > 0 && strengths.length < 3) {
    strengths.push(`Showing improvement in ${improvingSubjects[0].subject} — keep up this momentum`)
  }

  if (m.overallAvg !== null && m.overallAvg >= 75 && strengths.length < 3) {
    strengths.push(`Consistently scoring above 75% across subjects`)
  }

  if (m.attendanceTrend === "improving" && strengths.length < 3) {
    strengths.push("Attendance has been improving recently — positive sign")
  }

  /* ── WEAKNESSES ── */
  if (m.attendancePct !== null && m.attendancePct < 60) {
    weaknesses.push(`Critical: Attendance is only ${m.attendancePct}% — below the required 75% threshold`)
  } else if (m.attendancePct !== null && m.attendancePct < 75) {
    weaknesses.push(`Attendance at ${m.attendancePct}% is below the recommended 75%`)
  }

  if (m.attendanceTrend === "declining" && m.attendancePct !== null && m.attendancePct < 85) {
    weaknesses.push("Attendance has been declining in recent weeks")
  }

  const weakSubjects = m.subjects.filter(s => s.average < 50).sort((a, b) => a.average - b.average)
  weakSubjects.slice(0, 2).forEach(s => {
    weaknesses.push(`${s.subject} average is only ${s.average}% — needs significant improvement`)
  })

  const decliningSubjects = m.subjects.filter(s => s.trend === "declining" && s.average < 70 && !weakSubjects.find(w => w.subject === s.subject))
  if (decliningSubjects.length > 0 && weaknesses.length < 3) {
    weaknesses.push(`${decliningSubjects[0].subject} scores are declining over recent exams`)
  }

  if (m.feesStatus === "pending" && m.pendingMonths > 0 && weaknesses.length < 3) {
    weaknesses.push(`${m.pendingMonths} month(s) of fees are pending — please follow up`)
  }

  /* ── SUGGESTIONS ── */
  if (m.attendancePct !== null && m.attendancePct < 75) {
    suggestions.push(`Target attending every class this week — even one extra session per week will raise attendance to ${Math.min(100, m.attendancePct + 5)}%`)
  }

  const worstSubject = [...m.subjects].sort((a, b) => a.average - b.average)[0]
  if (worstSubject && worstSubject.average < 60) {
    suggestions.push(`Dedicate 30 minutes daily to ${worstSubject.subject} — focus on the chapters from the last exam where marks were lost`)
  }

  const declSubjects = m.subjects.filter(s => s.trend === "declining")
  if (declSubjects.length > 0) {
    suggestions.push(`Review notes from the last 2 ${declSubjects[0].subject} exams to identify where marks were lost and revise those topics`)
  }

  if (m.lastExamPct !== null && m.lastExamPct < 60) {
    suggestions.push("Schedule a one-on-one session with the teacher to go over the last exam paper and understand the mistakes")
  }

  if (m.overallAvg !== null && m.overallAvg >= 70 && suggestions.length < 3) {
    suggestions.push("Maintain current study schedule and attempt previous year question papers to further improve scores")
  }

  if (m.attendanceTrend === "declining" && suggestions.length < 4) {
    suggestions.push("Set a daily attendance reminder to ensure no sessions are missed in the coming weeks")
  }

  if (suggestions.length < 2) {
    suggestions.push("Continue regular practice and stay consistent with class attendance")
  }

  return {
    summary,
    strengths:   strengths.slice(0, 3),
    weaknesses:  weaknesses.slice(0, 3),
    suggestions: suggestions.slice(0, 4),
  }
}

/* ── Gemini REST call ─────────────────────────────────── */
async function callGemini(metrics: ReturnType<typeof buildMetrics>, ruleReport: ReturnType<typeof generateRuleBasedReport>) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return ruleReport

  const subjectText = metrics.subjects.length > 0
    ? metrics.subjects.map(s => `${s.subject}: ${s.average}% avg (${s.trend})`).join(", ")
    : "No exam data"

  const prompt = `You are an expert academic performance analyst for a tutoring institution.

Student: ${metrics.studentName}
Class: ${metrics.className ?? "Unknown"} | Batch: ${metrics.batchName ?? "Unknown"}
Attendance: ${metrics.hasAttendanceData ? `${metrics.attendancePct}% (${metrics.attendanceTrend})` : "No data"}
Subjects: ${subjectText}
Overall avg: ${metrics.overallAvg !== null ? `${metrics.overallAvg}%` : "No data"} | Trend: ${metrics.overallTrend}
Risk level: ${metrics.riskLevel}
Fees: ${metrics.feesStatus}${metrics.pendingMonths > 0 ? ` (${metrics.pendingMonths} months pending)` : ""}

Generate a JSON response with EXACTLY this structure:
{
  "summary": "1-2 specific sentences about current status. No generic praise.",
  "strengths": ["max 3 evidence-based strengths"],
  "weaknesses": ["max 3 specific weaknesses with subject names"],
  "suggestions": ["max 4 specific actionable steps with subject names and timeframes"]
}

Rules:
- Use actual numbers from the data above
- Suggestions must be specific (e.g. "Practice algebra problems daily for 30 minutes" not "study more")
- If no exam data: summary = "Insufficient exam data. Add exam scores to unlock full analysis."
- Return ONLY valid JSON, no markdown, no explanation`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      }
    )

    if (!res.ok) {
      console.error("Gemini API error:", await res.text())
      return ruleReport
    }

    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return ruleReport

    const parsed = JSON.parse(text)
    return {
      summary:     parsed.summary     || ruleReport.summary,
      strengths:   (parsed.strengths  || ruleReport.strengths).slice(0, 3),
      weaknesses:  (parsed.weaknesses || ruleReport.weaknesses).slice(0, 3),
      suggestions: (parsed.suggestions || ruleReport.suggestions).slice(0, 4),
    }
  } catch (e) {
    console.error("Gemini parse error:", e)
    return ruleReport  // graceful fallback
  }
}

/* ── GET ──────────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: userRecord } = await supabaseAdmin
      .from("users").select("role, institution_id").eq("id", user.id).single()
    if (!userRecord || !["admin", "teacher"].includes(userRecord.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Confirm student belongs to institution
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("institution_id", userRecord.institution_id)
      .single()

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1"

    // Return cached unless force-refresh
    if (!forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from("student_ai_reports")
        .select("*")
        .eq("student_id", studentId)
        .single()

      if (cached) return NextResponse.json({ report: cached, cached: true })
    }

    // Build metrics (always) + rule-based base report
    const raw        = await fetchRaw(studentId, userRecord.institution_id)
    const metrics    = buildMetrics(raw)
    const ruleReport = generateRuleBasedReport(metrics)

    // Enhance with Gemini AI (falls back to rule-based if Gemini fails)
    const aiReport   = await callGemini(metrics, ruleReport)

    const payload = {
      student_id:     studentId,
      institution_id: userRecord.institution_id,
      summary:        aiReport.summary,
      risk_level:     metrics.riskLevel,
      strengths:      aiReport.strengths,
      weaknesses:     aiReport.weaknesses,
      suggestions:    aiReport.suggestions,
      raw_metrics:    metrics,
      generated_at:   new Date().toISOString(),
    }

    const { data: saved } = await supabaseAdmin
      .from("student_ai_reports")
      .upsert(payload, { onConflict: "student_id" })
      .select()
      .single()

    return NextResponse.json({ report: saved ?? payload, cached: false })
  } catch (e: any) {
    console.error("AI analysis error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
