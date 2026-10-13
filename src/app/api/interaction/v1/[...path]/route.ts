import { handleInteractionRequest } from '@/src/server/interaction.runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };
const handle = async (request: Request, ctx: Ctx) => handleInteractionRequest(request, (await ctx.params).path ?? []);
export const GET = handle;
export const POST = handle;
