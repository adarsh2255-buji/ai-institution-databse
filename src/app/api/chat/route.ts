import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages } from "ai"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { buildTools, buildParentTools } from "@/lib/ai/tools"
import { NextRequest } from "next/server"

export const maxDuration = 60

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `You are an intelligent academic assistant for an institution management system.
You have access to real student data through tools. Always use tools to fetch accurate data — never guess or fabricate numbers.

Guidelines:
- Always call the appropriate tool before answering data questions
- Present attendance figures as exact numbers (total, present, absent, late, percentage)
- Present marks with subject name, exam name, max marks, marks obtained, and percentage
- When comparing marks across exams, identify trends (improving/declining/stable)
- For fees, always state total due, total paid, and balance
- Render data in clean markdown tables when presenting multiple records
- Be concise, professional, and insightful in your analysis
- If a student is not found, say so clearly rather than returning empty data silently`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    // Get user record from new users table
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users")
      .select("institution_id, role, student_id, status")
      .eq("id", user.id)
      .single()

    if (userError || !userRecord || userRecord.status !== "active") {
      return new Response(JSON.stringify({ error: "User not found or inactive" }), { status: 403 })
    }

    const { messages, institutionSlug } = await req.json()

    // Verify the user belongs to the requested institution
    const { data: institution } = await supabaseAdmin
      .from("institutions")
      .select("id, status")
      .eq("slug", institutionSlug)
      .eq("id", userRecord.institution_id)
      .single()

    if (!institution || institution.status !== "active") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    }

    const institutionId = userRecord.institution_id
    const role = userRecord.role

    // Select tools based on role
    const tools =
      role === "parent" && userRecord.student_id
        ? buildParentTools(institutionId, userRecord.student_id)
        : buildTools(institutionId)

    const systemPrompt =
      role === "parent"
        ? `${SYSTEM_PROMPT}\n\nIMPORTANT: You are talking with a parent. Only provide information about their child. Do not discuss other students.`
        : SYSTEM_PROMPT

    // AI SDK v6: convert UIMessages to ModelMessages (async)
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: modelMessages,
      tools,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
  }
}
