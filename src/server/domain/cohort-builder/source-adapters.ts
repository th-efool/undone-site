import 'server-only';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { z } from 'zod';
import { extractRetainedPdf } from '@/src/server/domain/cohort-creation/materials/pdf';
import { openWebSource, webSourceUrl, type WebTransport } from '@/src/server/domain/cohort-creation/materials/web-fetch';
import { PDF_PARSER_VERSION } from '@/src/server/domain/cohort-creation/materials/pdf-identity';
import { WEB_PARSER_VERSION } from '@/src/server/domain/cohort-creation/materials/web-identity';
import { YOUTUBE_TRANSCRIPT_VERSION } from '@/src/shared/cohort-builder/youtube-transcript';
import { GITHUB_SOURCE_VERSION } from '@/src/shared/cohort-builder/github-source';
import { cohortSourceSchema, type CohortSource } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactRef } from './text-artifacts';
import { PDF_SOURCE_BYTES } from './source-policy';

const hash = (bytes:Uint8Array|string) => createHash('sha256').update(bytes).digest('hex');
export const retainedWebSchema = z.strictObject({ format:z.literal('web-response-v1'), requestedUrl:z.string().max(2048), finalUrl:z.string().max(2048),
  redirects:z.array(z.string().max(2048)).max(3), mediaType:z.enum(['text/html','text/plain','text/markdown','text/x-markdown']),
  fetchedAt:z.iso.datetime(), body:z.string().max(1_400_000) });
export const sourceExtractionSchema = z.strictObject({ format:z.literal('cohort-extraction-v1'), text:z.string().min(1).max(200_000),
  locations:cohortSourceSchema.shape.locations.unwrap(), provenance:cohortSourceSchema.shape.provenance.unwrap(),
}).superRefine((value,ctx) => {
  let end = 0;
  for (const location of value.locations) {
    if (location.start < end || location.end <= location.start || location.end > value.text.length || value.text.slice(end,location.start).trim()) ctx.addIssue({code:'custom',message:'Invalid retained locations'});
    end = location.end;
  }
  if (!value.locations.length || value.text.slice(end).trim() || Buffer.byteLength(value.text)>200_000) ctx.addIssue({code:'custom',message:'Incomplete or oversized retained extraction'});
});
export type SourceExtraction = z.infer<typeof sourceExtractionSchema>;

function sourceError(error:unknown,kind:'pdf'|'web'|'youtube'|'github'): never {
  const code = (error as {code?:string})?.code;
  if (code === 'LIMIT_EXCEEDED') throw new Error('SOURCE_LIMIT_EXCEEDED');
  if (code === 'INTEGRITY') throw new Error('RETAINED_SOURCE_INTEGRITY');
  if (code === 'UNAVAILABLE') throw new Error('WEB_SOURCE_UNAVAILABLE');
  if (error instanceof Error && /^[A-Z_]+$/.test(error.message)) throw error;
  throw new Error(kind === 'pdf' ? 'PDF_UNREADABLE' : kind === 'web' ? 'WEB_SOURCE_REJECTED' : kind === 'youtube' ? 'TRANSCRIPT_UNREADABLE' : 'GITHUB_SOURCE_UNREADABLE');
}

/** Uses the existing pinned connection transport; fixture transports still pass every URL/DNS check. */
export async function fetchRetainedWeb(url:string,transport?:WebTransport): Promise<Uint8Array> {
  try {
    const response = await openWebSource(url,undefined,transport);
    try {
      const chunks:Buffer[] = []; let length = 0;
      for await (const chunk of response.bytes) { length += chunk.length; if (length>1024*1024) throw new Error('WEB_RESPONSE_SIZE_LIMIT'); chunks.push(Buffer.from(chunk)); }
      return Buffer.from(JSON.stringify(retainedWebSchema.parse({ format:'web-response-v1', requestedUrl:response.requestedUrl,
        finalUrl:response.finalUrl, redirects:response.redirects, mediaType:response.mediaType, fetchedAt:new Date().toISOString(), body:Buffer.concat(chunks).toString('base64') })));
    } finally { response.close(); }
  } catch(error) { return sourceError(error,'web'); }
}

const cache = new Map<string,Promise<SourceExtraction>>();
/** Only trusted parser results enter this bounded cache; accepted blobs never seed it. */
export async function extractRetainedSource(source:CohortSource,ref:TextArtifactRef,bytes:Uint8Array):Promise<SourceExtraction> {
  if (!source.input || ref.checksum !== hash(bytes)) throw new Error('RETAINED_SOURCE_INTEGRITY');
  const key = hash(JSON.stringify([ref.checksum,source.input,PDF_PARSER_VERSION,WEB_PARSER_VERSION,YOUTUBE_TRANSCRIPT_VERSION,GITHUB_SOURCE_VERSION]));
  const prior = cache.get(key); if (prior) return prior;
  const work = (async () => {
    try {
      let result:SourceExtraction;
      if (source.input!.kind === 'pdf') {
        if (bytes.length>PDF_SOURCE_BYTES) throw new Error('PDF_SIZE_LIMIT');
        const parsed = await extractRetainedPdf(bytes,{ id:ref.id,kind:'upload',byteLength:bytes.length,checksum:ref.checksum },'retained-source');
        const selected = source.input!.pages ?? parsed.pdf.pages.map(page => page.page);
        if (new Set(selected).size!==selected.length || selected.some(page => !parsed.pdf.pages.some(item => item.page===page))) throw new Error('INVALID_PDF_SCOPE');
        let text = ''; const locations:SourceExtraction['locations'] = [];
        for (const page of [...selected].sort((a,b)=>a-b)) {
          const span = parsed.pdf.pages.find(item=>item.page===page)!;
          const value = parsed.text.slice(span.start,span.end).trimEnd();
          if (text) text += '\n\n'; const start = text.length; text += value; locations.push({start,end:text.length,page});
        }
        result = {format:'cohort-extraction-v1',text,locations,provenance:{parserVersion:PDF_PARSER_VERSION,rawChecksum:ref.checksum,scope:'selected_pages',pageCount:parsed.pdf.pages.length}};
      } else if (source.input!.kind === 'web') {
        const retained = retainedWebSchema.parse(JSON.parse(Buffer.from(bytes).toString('utf8')));
        if (webSourceUrl(source.input!.url).href !== retained.requestedUrl) throw new Error('FOREIGN_WEB_RESPONSE');
        webSourceUrl(retained.finalUrl); retained.redirects.forEach(url=>webSourceUrl(url));
        const body = Buffer.from(retained.body,'base64');
        if (!body.length || body.length>1024*1024 || body.toString('base64')!==retained.body) throw new Error('RETAINED_SOURCE_INTEGRITY');
        const parsed = await new Promise<{ text:string; scope:'main_article'|'full_text_response' }>((resolve,reject) => {
          const worker = new Worker(path.join(process.cwd(),'src/server/domain/cohort-builder/source-web.worker.mjs'),{
            workerData:{ bytes:body, receipt:{schemaVersion:1,materialId:'retained-source',inputRevision:0,
              requestedUrl:retained.requestedUrl,finalUrl:retained.finalUrl,redirects:retained.redirects,mediaType:retained.mediaType,
              fetchedAt:retained.fetchedAt,fetchVersion:'public-https-pinned-v1',retainedSource:{id:ref.id,kind:'upload',byteLength:body.length,checksum:hash(body)}} },
            execArgv:['--conditions=react-server','--import','tsx'],resourceLimits:{maxOldGenerationSizeMb:192,stackSizeMb:4},
          });
          let done = false;
          const finish = (error?:Error,value?:{text:string;scope:'main_article'|'full_text_response'}) => {
            if (done) return; done=true; clearTimeout(timer); void worker.terminate(); if(error) reject(error); else resolve(value!);
          };
          const timer = setTimeout(()=>finish(new Error('WEB_PARSE_DEADLINE')),20_000);
          worker.once('message',value=> value.error ? finish(new Error(value.error)) : finish(undefined,value));
          worker.once('error',()=>finish(new Error('WEB_PARSE_FAILED')));
          worker.once('exit',()=>{if(!done) finish(new Error('WEB_PARSE_FAILED'));});
        });
        result = {format:'cohort-extraction-v1',text:parsed.text,locations:[{start:0,end:parsed.text.length}],
          provenance:{parserVersion:WEB_PARSER_VERSION,rawChecksum:ref.checksum,scope:parsed.scope,finalUrl:retained.finalUrl}};
      } else if (source.input!.kind === 'youtube') {
        const {extractYoutubeTranscript}=await import('./youtube-transcript');
        const extracted=extractYoutubeTranscript(bytes,source.input!);
        result = {format:'cohort-extraction-v1',text:extracted.text,locations:extracted.locations,
          provenance:{parserVersion:YOUTUBE_TRANSCRIPT_VERSION,rawChecksum:ref.checksum,scope:'transcript_only',
            finalUrl:source.input!.url,videoId:extracted.videoId,track:extracted.track,timeScope:source.input!.scope}};
      } else if (source.input!.kind === 'github') {
        const {extractGithubSource}=await import('./github-source');
        const extracted=extractGithubSource(bytes,source.input!);
        result = {format:'cohort-extraction-v1',text:extracted.text,locations:extracted.locations,
          provenance:{parserVersion:GITHUB_SOURCE_VERSION,rawChecksum:ref.checksum,scope:'selected_files',
            repoUrl:source.input!.repoUrl,ref:source.input!.ref,commitSha:extracted.commitSha,fileCount:extracted.fileCount}};
      } else {
        throw new Error('UNSUPPORTED_SOURCE_KIND');
      }
      if (Buffer.byteLength(result.text)>200_000) throw new Error('SOURCE_LIMIT_EXCEEDED');
      return sourceExtractionSchema.parse(result);
    } catch(error) {
      if (source.input?.kind === 'pdf' || source.input?.kind === 'web' || source.input?.kind === 'youtube' || source.input?.kind === 'github') {
        return sourceError(error, source.input.kind);
      }
      throw error;
    }
  })();

  cache.set(key,work); if(cache.size>8) cache.delete(cache.keys().next().value!);
  try {return await work;} catch(error) {cache.delete(key);throw error;}
}
