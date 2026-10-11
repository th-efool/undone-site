import { toNextJsHandler } from 'corsair';
import { getCorsair } from '@/src/server/corsair';

export const runtime = 'nodejs';

let handlers: ReturnType<typeof toNextJsHandler> | undefined;
function handler(method: 'GET' | 'POST' | 'OPTIONS') {
    return async (request: Request): Promise<Response> => {
        try {
            handlers ??= toNextJsHandler(getCorsair(), { basePath: '/api/corsair' });
        } catch {
            return Response.json({ message: 'Connector service is unavailable.' }, { status: 503 });
        }
        return handlers[method](request);
    };
}
export const GET = handler('GET');
export const POST = handler('POST');
export const OPTIONS = handler('OPTIONS');
