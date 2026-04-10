import { tool } from "ai"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { getStudentMarksQuery, getBatchMarksQuery } from "@/lib/supabase/queries/marks"
import { getStudentAttendanceQuery, getBatchAttendanceQuery } from "@/lib/supabase/queries/attendance"
import { getStudentFeesQuery, getAllFeesQuery } from "@/lib/supabase/queries/fees"
import { listStudentsQuery } from "@/lib/supabase/queries/students"

// Create a service-role Supabase client for AI tool use (server-only)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function buildTools(centerId: string) {
  const supabase = getServiceSupabase()

  return {
    getStudentMarks: tool({
      description:
        "Fetch all exam results / marks for a specific student. Returns per-exam breakdown with subject, date, marks obtained, and max marks. Use this to evaluate academic performance or compare results over time.",
      inputSchema: z.object({
        studentName: z.string().describe("The student's full or partial name"),
        subjectName: z.string().optional().describe("Filter by subject name (optional)"),
      }),
      execute: async ({ studentName, subjectName }) => {
        const data = await getStudentMarksQuery(supabase, centerId, studentName, subjectName)
        return { studentName, subjectName, marksData: data }
      },
    }),

    getBatchMarks: tool({
      description:
        "Fetch aggregated exam marks for an entire class/batch. Returns every student's score for specified exam(s).",
      inputSchema: z.object({
        batchName: z.string().describe("The class or batch name"),
        examName: z.string().optional().describe("Filter to a specific exam (optional)"),
      }),
      execute: async ({ batchName, examName }) => {
        const data = await getBatchMarksQuery(supabase, centerId, batchName, examName)
        return { batchName, examName, marksData: data }
      },
    }),

    getStudentAttendance: tool({
      description:
        "Fetch attendance records for a specific student. Returns summary (total days, present, absent, late, percentage) and a daily record list.",
      inputSchema: z.object({
        studentName: z.string().describe("The student's full or partial name"),
        month: z
          .string()
          .optional()
          .describe("Filter by month in YYYY-MM format, e.g. '2025-03' (optional)"),
      }),
      execute: async ({ studentName, month }) => {
        const data = await getStudentAttendanceQuery(supabase, centerId, studentName, month)
        return { studentName, month, ...data }
      },
    }),

    getBatchAttendance: tool({
      description:
        "Fetch class-level attendance report for an entire batch. Returns per-student counts grouped by present/absent/late.",
      inputSchema: z.object({
        batchName: z.string().describe("The class or batch name"),
        month: z
          .string()
          .optional()
          .describe("Filter by month in YYYY-MM format (optional)"),
      }),
      execute: async ({ batchName, month }) => {
        const data = await getBatchAttendanceQuery(supabase, centerId, batchName, month)
        return { batchName, month, ...data }
      },
    }),

    getStudentFees: tool({
      description:
        "Fetch fee payment history, dues, and outstanding balance for a specific student.",
      inputSchema: z.object({
        studentName: z.string().describe("The student's full or partial name"),
        month: z
          .string()
          .optional()
          .describe("Filter by specific month string, e.g. '2025-03' (optional)"),
      }),
      execute: async ({ studentName, month }) => {
        const data = await getStudentFeesQuery(supabase, centerId, studentName, month)
        return { studentName, month, ...data }
      },
    }),

    listStudents: tool({
      description: "List all students, optionally filtered by batch name or search query.",
      inputSchema: z.object({
        batchName: z.string().optional().describe("Filter by batch (optional)"),
        searchQuery: z.string().optional().describe("Filter by student name (optional)"),
      }),
      execute: async ({ batchName, searchQuery }) => {
        const data = await listStudentsQuery(supabase, centerId, batchName, searchQuery)
        return { count: data.length, students: data }
      },
    }),

    getPendingFees: tool({
      description: "Get a list of all students with pending, partial, or overdue fee payments.",
      inputSchema: z.object({
        status: z
          .enum(["pending", "partial", "overdue"])
          .optional()
          .describe("Filter by fee status (optional)"),
      }),
      execute: async ({ status }) => {
        const data = await getAllFeesQuery(supabase, centerId, status)
        return { count: data.length, fees: data }
      },
    }),
  }
}

// Parent-scoped tools: restricted to a single student
export function buildParentTools(centerId: string, studentId: string) {
  const supabase = getServiceSupabase()

  return {
    getMyChildAttendance: tool({
      description: "Get attendance records for my child.",
      inputSchema: z.object({
        month: z.string().optional().describe("Filter by month YYYY-MM (optional)"),
      }),
      execute: async ({ month }) => {
        let query = supabase
          .from("attendance")
          .select("date, status, batches(name)")
          .eq("institution_id", centerId)
          .eq("student_id", studentId)
          .order("date", { ascending: false })

        if (month) {
          query = query.gte("date", `${month}-01`).lte("date", `${month}-31`)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)
        const records = data ?? []
        const present = records.filter((r) => r.status === "present").length
        const absent = records.filter((r) => r.status === "absent").length
        const late = records.filter((r) => r.status === "late").length

        return {
          summary: { total: records.length, present, absent, late, percentage: records.length ? Math.round((present / records.length) * 100) : 0 },
          records,
        }
      },
    }),

    getMyChildMarks: tool({
      description: "Get exam marks and academic results for my child.",
      inputSchema: z.object({
        subjectName: z.string().optional().describe("Filter by subject (optional)"),
      }),
      execute: async ({ subjectName }) => {
        let query = supabase
          .from("marks")
          .select("marks_obtained, absent, exams(name, max_marks, held_on, subjects(name), batches(name))")
          .eq("institution_id", centerId)
          .eq("student_id", studentId)
          .order("exams(held_on)", { ascending: false })

        if (subjectName) {
          query = query.ilike("exams.subjects.name", `%${subjectName}%`)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return data ?? []
      },
    }),

    getMyChildFees: tool({
      description: "Get fee payment history and outstanding dues for my child.",
      inputSchema: z.object({
        month: z.string().optional().describe("Filter by month YYYY-MM (optional)"),
      }),
      execute: async ({ month }) => {
        let query = supabase
          .from("fees")
          .select("month, amount_due, amount_paid, due_date, paid_on, status")
          .eq("institution_id", centerId)
          .eq("student_id", studentId)
          .order("month", { ascending: false })

        if (month) {
          query = query.eq("month", month)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)
        const records = data ?? []
        const totalDue = records.reduce((sum, r) => sum + Number(r.amount_due), 0)
        const totalPaid = records.reduce((sum, r) => sum + Number(r.amount_paid), 0)
        return { summary: { totalDue, totalPaid, pending: totalDue - totalPaid }, records }
      },
    }),
  }
}
