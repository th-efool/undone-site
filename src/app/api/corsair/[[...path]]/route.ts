import { toNextJsHandler } from 'corsair';
import { corsair } from '@/src/server/corsair';

export const { GET, POST, OPTIONS } = toNextJsHandler(corsair, {
    basePath: '/api/corsair',
});
