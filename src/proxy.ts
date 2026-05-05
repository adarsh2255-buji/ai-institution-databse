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
  '/register',
  '/api/register',
  '/api/login',
  '/api/auth',
  '/api/student-request',
  '/api/institution/public',
  '/api/institution/login',
  '/api/student/register',
  '/api/student/login',
  '/api/student-lookup',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) return true
  // /register/[slug] and subpaths
  if (pathname.match(/^\/register\/[^/]+(\/(login|change-password|setup-profile))?$/)) return true
  // /[slug]/login — institution login portal
  if (pathname.match(/^\/[^/]+\/login$/)) return true
  // enrollment pages
  if (pathname.endsWith('/enroll') || pathname.includes('/enroll?')) return true
  return false
}

const PLATFORM_ROUTES = ['/platform']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through public routes and static assets immediately
  if (
    isPublicPath(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // ── Build response that carries refreshed auth cookies back to browser ──
  // This pattern is required by @supabase/ssr to persist refreshed tokens.
  let response = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Step 1: write into the forwarded request
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )
          // Step 2: create a fresh response carrying the refreshed cookies
          response = NextResponse.next({
            request: { headers: req.headers },
          })
          // Step 3: copy refreshed cookies into the response sent to browser
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() silently refreshes the session if the access token has expired.
  // This is what prevents the "logged out on refresh" problem.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not authenticated → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // ── Platform admin routes ─────────────────────────────────────────
  if (PLATFORM_ROUTES.some((r) => pathname.startsWith(r))) {
    const { data: isAdmin } = await supabaseAdmin
      .from('platform_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!isAdmin) return NextResponse.redirect(new URL('/login', req.url))
    return response
  }

  // ── Institution slug routes ───────────────────────────────────────
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 1 && !pathname.startsWith('/api/')) {
    const possibleSlug = segments[0]
    const reservedSegments = ['login', 'register', 'platform', 'api', '_next']

    if (!reservedSegments.includes(possibleSlug)) {
      // Platform admins bypass all institution checks
      const { data: isPlatformAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (isPlatformAdmin) return response

      // Check if user is staff/admin
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role, status, institution_id, institutions(slug, status)')
        .eq('id', user.id)
        .maybeSingle()

      if (!userRecord) {
        // Not in users table — check if they're a student
        const { data: studentRecord } = await supabaseAdmin
          .from('students')
          .select('id, institution_id, institutions(slug, status)')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!studentRecord) {
          return NextResponse.redirect(new URL('/login', req.url))
        }

        const rawInst = studentRecord.institutions
        const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
          slug: string; status: string
        } | null

        if (!institution || institution.status === 'pending') {
          return NextResponse.redirect(new URL('/login?reason=pending', req.url))
        }
        if (institution.status === 'suspended') {
          return NextResponse.redirect(new URL('/login?reason=suspended', req.url))
        }

        return response // Student passes through
      }

      // Staff checks
      if (userRecord.status !== 'active') {
        return NextResponse.redirect(new URL('/login', req.url))
      }

      const rawInst = userRecord.institutions
      const institution = (Array.isArray(rawInst) ? rawInst[0] : rawInst) as {
        slug: string; status: string
      } | null

      if (!institution || institution.status === 'pending') {
        return NextResponse.redirect(new URL('/login?reason=pending', req.url))
      }
      if (institution.status === 'suspended') {
        return NextResponse.redirect(new URL('/login?reason=suspended', req.url))
      }

      // Slug mismatch → redirect to their correct institution
      if (institution.slug !== possibleSlug) {
        return NextResponse.redirect(
          new URL(`/${institution.slug}/admin`, req.url)
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
