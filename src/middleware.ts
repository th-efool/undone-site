import { auth } from '@/src/server/infrastructure/auth/auth.config';

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/auth', req.nextUrl));
  }
});

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
