import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Public endpoint — returns safe institution info for the registration page
// Only exposes: name, slug, status (NO sensitive data)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug")

  if (!slug) {
    return NextResponse.json({ error: "Slug is required." }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("institutions")
    .select("name, slug, status")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 })
  }

  // Return minimal safe public info
  return NextResponse.json({ name: data.name, slug: data.slug, status: data.status })
}
