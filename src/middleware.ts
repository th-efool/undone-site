import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for NextAuth session cookies
  const hasSessionToken = 
    request.cookies.has('next-auth.session-token') || 
    request.cookies.has('__Secure-next-auth.session-token') ||
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token');

  if (!hasSessionToken) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/home/:path*', 
    '/play/:path*', 
    '/message/:path*', 
    '/studyroom/:path*', 
    '/create-cohort/:path*',
    '/notes/:path*',
    '/explore/:path*',
    '/cohort'
  ]
};
