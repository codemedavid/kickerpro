import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function middleware(request: NextRequest) {
  // Check if Supabase is configured
  const hasSupabaseCredentials = 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth', '/api/webhook', '/api/cron', '/privacy', '/terms']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path)) || 
                       request.nextUrl.pathname === '/'
  // If Supabase is not configured, allow access to all routes
  // (Development mode without Supabase)
  if (!hasSupabaseCredentials) {
    console.warn('[Middleware] Supabase not configured - allowing all access')
    return NextResponse.next()
  }
  let supabaseResponse = NextResponse.next({
    request,
  })
  // For now, allow all access - simplified auth without Supabase Auth
  // (Using database-only authentication)
  console.log('[Middleware] Allowing access to:', request.nextUrl.pathname);
  return NextResponse.next()
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
