import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth cookie
  const authCookie = request.cookies.get('fb-auth-user');
  const isAuthenticated = !!authCookie?.value;

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicPath && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    console.log('[Middleware] Redirecting unauthenticated user to login');
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if authenticated and trying to access login
  if (isAuthenticated && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    console.log('[Middleware] Redirecting authenticated user to dashboard');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
