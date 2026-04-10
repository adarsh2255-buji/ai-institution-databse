import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  '/login',
  '/register',           // staff registration
  '/api/register',
  '/api/login',
  '/api/auth',
  '/api/student-request',
  '/api/institution/public',
  '/api/student/register',
  '/api/student/login',
]

// Helper — additional pattern-based public paths
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) return true
  // /register/[slug] and /register/[slug]/login — student self-registration
  if (pathname.match(/^\/register\/[^/]+(\/login)?$/)) return true
  // /*/enroll — legacy enrollment form
  if (pathname.endsWith('/enroll') || pathname.includes('/enroll?')) return true
  return false
}

// Platform-admin only routes
const PLATFORM_ROUTES = ['/platform']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Build a response that can carry Set-Cookie headers
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Platform admin routes: check platform_admins table
  if (PLATFORM_ROUTES.some((r) => pathname.startsWith(r))) {
    const { data: isAdmin } = await supabaseAdmin
      .from('platform_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return response
  }

  // For /[institutionSlug]/... routes: verify institution is active
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 1 && !pathname.startsWith('/api/')) {
    const possibleSlug = segments[0]

    // Skip well-known non-slug segments
    const reservedSegments = ['login', 'register', 'platform', 'api', '_next']
    if (!reservedSegments.includes(possibleSlug)) {
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role, status, institution_id, institutions(slug, status)')
        .eq('id', user.id)
        .single()

      // Check platform_admin first
      const { data: isPlatformAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (isPlatformAdmin) return response // Platform admins pass through

      if (!userRecord) {
        return NextResponse.redirect(new URL('/login', req.url))
      }

      if (userRecord.status !== 'active') {
        return NextResponse.redirect(new URL('/login', req.url))
      }

      const rawInst = userRecord.institutions
      const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
        slug: string; status: string
      } | null

      // Institution status gate
      if (!institution || institution.status === 'pending') {
        return NextResponse.redirect(new URL('/login?reason=pending', req.url))
      }
      if (institution.status === 'suspended') {
        return NextResponse.redirect(new URL('/login?reason=suspended', req.url))
      }

      // Slug mismatch: wrong institution URL
      if (institution.slug !== possibleSlug) {
        // Redirect to their correct institution
        const correctBase = `/${institution.slug}`
        return NextResponse.redirect(new URL(correctBase + '/dashboard', req.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
