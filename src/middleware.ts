import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get('organizer_token')?.value;
  const isAuthenticated = Boolean(token && token.trim().length > 0);

  // 1. Organizer Page Routes
  if (pathname.startsWith('/organizer')) {
    // If accessing root /organizer, forward to dashboard or login
    if (pathname === '/organizer') {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/organizer/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/organizer/login', request.url));
    }

    // If on login page and already authenticated, forward to dashboard
    if (pathname === '/organizer/login') {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/organizer/dashboard', request.url));
      }
      return NextResponse.next();
    }

    // All other /organizer/* routes require authentication
    if (!isAuthenticated) {
      const destination = pathname + (search || '');
      const loginUrl = new URL('/organizer/login', request.url);
      loginUrl.searchParams.set('from', destination);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 2. Organizer API Routes Protection
  if (
    pathname.startsWith('/api/organizer/history') ||
    pathname.startsWith('/api/quizzes')
  ) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: Organizer session required' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/organizer/:path*',
    '/api/quizzes/:path*',
    '/api/organizer/history/:path*',
  ],
};
