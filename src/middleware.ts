import { auth } from '@/src/server/infrastructure/auth/auth.edge';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL(creationSignInUrl(req.nextUrl.pathname + req.nextUrl.search), req.nextUrl));
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
