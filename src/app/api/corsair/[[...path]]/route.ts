import { toNextJsHandler } from 'corsair';
import { corsair } from '@/src/server/corsair';

export const runtime = 'nodejs';

const handlers = toNextJsHandler(corsair, {
    basePath: '/api/corsair',
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const OPTIONS = handlers.OPTIONS;
