import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import StudentDashboardClient from '@/components/student/StudentDashboardClient'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props { params: Promise<{ institutionSlug: string }> }

export default async function StudentDashboard({ params }: Props) {
  const { institutionSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${institutionSlug}/login`)

  const { data: student, error: studentErr } = await supabaseAdmin
    .from('students')
    .select(`
      id, name, registration_no, student_class, dob,
      medium, photo_url, gender, school_name, batch_id,
      father_name, mother_name, address, phone, whatsapp_number, email,
      password_changed, profile_completed, institution_id,
      institutions(name, slug),
      batches(name)
    `)
    .eq('user_id', user.id)
    .single()

  if (studentErr) console.error('[Dashboard] Student fetch error:', studentErr.message)
  if (!student) redirect(`/${institutionSlug}/login`)
  if (!student.password_changed) redirect(`/register/${institutionSlug}/change-password`)
  if (!student.profile_completed) redirect(`/register/${institutionSlug}/setup-profile`)

  console.log('[Dashboard] student.batch_id:', student.batch_id)

  const institution = (student as any).institutions as { name: string; slug: string } | null
  const batch = (student as any).batches as { name: string } | null

  // ── Attendance Summary (current month) ──────────────────────────
  const nowDate = new Date()
  const monthStart = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate()
  const monthEnd = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  console.log('[Dashboard] monthStart:', monthStart, 'monthEnd:', monthEnd)

  let attendanceSummary = { present: 0, absent: 0, total: 0, percentage: 0 }
  let recentAttendance: any[] = []

  if (student.batch_id) {
    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id, date, session, start_time, end_time')
      .eq('batch_id', student.batch_id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })

    if (sessErr) console.error('[Dashboard] Sessions fetch error:', sessErr.message)
    console.log('[Dashboard] sessions found:', sessions?.length ?? 0)

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id)

      const { data: absentRecords, error: absErr } = await supabaseAdmin
        .from('attendance_records')
        .select('session_id')
        .eq('student_id', student.id)
        .in('session_id', sessionIds)

      if (absErr) console.error('[Dashboard] AbsentRecords fetch error:', absErr.message)
      console.log('[Dashboard] absent records found:', absentRecords?.length ?? 0)

      const absentSessionIds = new Set((absentRecords || []).map(r => r.session_id))
      const total = sessions.length
      const absent = absentSessionIds.size
      const present = total - absent
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0

      attendanceSummary = { present, absent, total, percentage }
      recentAttendance = sessions.slice(0, 10).map(s => ({
        date: s.date,
        session: s.session,
        status: absentSessionIds.has(s.id) ? 'absent' : 'present',
      }))
    }
  } else {
    console.warn('[Dashboard] Student has no batch_id assigned!')
  }

  // ── Exam Results ──────────────────────────
  const { data: examResults } = await supabaseAdmin
    .from('exam_results')
    .select('*, exams(name, date, pass_percentage)')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // ── Fees ──────────────────────────
  const { data: fees } = await supabaseAdmin
    .from('fees')
    .select('*')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const totalDue = (fees || []).reduce((sum, f) => sum + Number(f.amount_due || 0), 0)
  const totalPaid = (fees || []).reduce((sum, f) => sum + Number(f.amount_paid || 0), 0)
  const totalPending = totalDue - totalPaid

  return (
    <StudentDashboardClient
      student={{
        id: student.id,
        name: student.name,
        registration_no: student.registration_no,
        student_class: student.student_class,
        photo_url: student.photo_url,
        gender: student.gender,
        dob: student.dob,
        school_name: student.school_name,
        medium: student.medium,
        father_name: student.father_name,
        mother_name: student.mother_name,
        phone: student.phone,
        email: student.email,
        address: student.address,
      }}
      institution={institution}
      batch={batch}
      institutionSlug={institutionSlug}
      attendanceSummary={attendanceSummary}
      recentAttendance={recentAttendance}
      examResults={(examResults || []).map(r => ({
        ...r,
        exam_name: (r.exams as any)?.name,
        exam_date: (r.exams as any)?.date,
        pass_percentage: (r.exams as any)?.pass_percentage,
      }))}
      fees={fees || []}
      feesSummary={{ totalDue, totalPaid, totalPending }}
    />
  )
}
