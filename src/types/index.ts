export type UserRole = 'admin' | 'teacher' | 'parent'

export interface Center {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface CenterUser {
  id: string
  user_id: string
  center_id: string
  role: UserRole
  student_id?: string
  created_at: string
  centers?: Center
}

export interface Student {
  id: string
  center_id: string
  name: string
  email?: string
  phone?: string
  batch_id?: string
  enrolled_at?: string
  created_at: string
  batches?: Batch
}

export interface Batch {
  id: string
  center_id: string
  name: string
  teacher_id?: string
  created_at: string
}

export interface Subject {
  id: string
  center_id: string
  name: string
  batch_id?: string
  created_at: string
  batches?: Batch
}

export interface Exam {
  id: string
  center_id: string
  subject_id: string
  batch_id: string
  name: string
  max_marks: number
  held_on: string
  created_at: string
  subjects?: Subject
  batches?: Batch
}

export interface Mark {
  id: string
  center_id: string
  exam_id: string
  student_id: string
  marks_obtained?: number
  absent: boolean
  created_at: string
  exams?: Exam
  students?: Student
}

export interface AttendanceRecord {
  id: string
  center_id: string
  batch_id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late'
  created_at: string
  students?: Student
  batches?: Batch
}

export interface Fee {
  id: string
  center_id: string
  student_id: string
  month: string
  amount_due: number
  amount_paid: number
  due_date?: string
  paid_on?: string
  status: 'paid' | 'partial' | 'pending' | 'overdue'
  created_at: string
  students?: Student
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolInvocations?: ToolInvocation[]
  createdAt?: Date
}

export interface ToolInvocation {
  toolName: string
  toolCallId: string
  state: 'call' | 'result' | 'partial-call'
  args: Record<string, unknown>
  result?: unknown
}
