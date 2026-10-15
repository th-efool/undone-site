import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { assertSourceSchema, sourceCapability } from '@/src/server/domain/cohort-builder/source-policy';
import { youtubeTranscriptReadiness } from '@/src/server/domain/cohort-builder/youtube-transcript-policy';
import { youtubeVideoReadiness } from '@/src/server/domain/cohort-builder/youtube-video-policy';
import { githubSourceReadiness } from '@/src/server/domain/cohort-builder/github-policy';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{workspaceId:string}>}) {
  const {workspaceId}=await params;const ownerId=await getCreationOwner();const headers={'Cache-Control':'private, no-store'};
  if(!ownerId || !z.uuid().safeParse(workspaceId).success || !await prisma.interactionWorkspace.findFirst({where:{id:workspaceId,ownerId,domainId:'cohort',lifecycle:'active'},select:{id:true}})) return Response.json({code:'NOT_FOUND'},{status:404,headers});
  let ready=process.env.INTERACTION_TEXT_DRIVER==='durable';
  if(ready) try {await assertSourceSchema({query:async(statement,parameters)=>({rows:await prisma.$queryRawUnsafe(statement,...parameters) as Record<string,unknown>[]})});} catch {ready=false;}
  const ytTranscript=youtubeTranscriptReadiness();
  const ytVideo=youtubeVideoReadiness();
  const youtubeEnabled=ytVideo.enabled || ytTranscript.enabled;
  const github=githubSourceReadiness();
  return Response.json({
    pdf:ready&&sourceCapability('pdf'),
    web:ready&&sourceCapability('web'),
    youtube:youtubeEnabled,
    youtubeUnavailableReason:ytVideo.code ?? ytTranscript.code,
    youtubeVideo:ytVideo.enabled,
    youtubeTranscript:ytTranscript.enabled,
    github:ready&&sourceCapability('github'),
    githubUnavailableReason:github.code??'GITHUB_CAPABILITY_DISABLED',
    pdfBytes:2*1024*1024,
    webBytes:1024*1024,
  },{headers});
}
