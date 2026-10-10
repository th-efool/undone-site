import { z } from 'zod';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { CONNECTION_RETURN_COOKIE } from './connectors.http';

export function connectionReturnHandler(drafts: Pick<DraftService, 'load'>, getOwner: () => Promise<string | null>) {
  return async (request: Request): Promise<Response> => {
    const redirect = (path: string, clear = false) => new Response(null, { status: 302, headers: {
      Location: new URL(path, request.url).href, 'Cache-Control': 'no-store', ...(clear ? {
        'Set-Cookie': `${CONNECTION_RETURN_COOKIE}=; Path=/quest/connections/return; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
      } : {}),
    } });
    try {
      const owner = await getOwner();
      if (!owner) return redirect(creationSignInUrl('/quest/connections/return'));
      const value = request.headers.get('Cookie')?.split(';').map(part => part.trim())
        .find(part => part.startsWith(`${CONNECTION_RETURN_COOKIE}=`))?.slice(CONNECTION_RETURN_COOKIE.length + 1);
      if (!z.uuid().safeParse(value).success) return redirect('/quest/new', true);
      await drafts.load(owner, value!);
      return redirect(`/quest/draft/${value}`, true);
    } catch (error) {
      if (error instanceof DraftNotFound) return redirect('/quest/new', true);
      return Response.json({ message: 'Your draft could not be opened. Reload to retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
