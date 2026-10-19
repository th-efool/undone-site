import {createHash} from 'node:crypto';
import {retainedYoutubeTranscriptSchema,singleYoutubeVideo,youtubeTranscriptInputSchema,
  YOUTUBE_TRANSCRIPT_LIMITS,YOUTUBE_TRANSCRIPT_VERSION,type YoutubeTranscriptInput} from '@/src/shared/cohort-builder/youtube-transcript';
import {readTextArtifact,type TextArtifactSql} from './text-artifacts';

export interface YoutubeTranscriptProvider {
  id:string;
  version:string;
  billing:'none'|'paid';
  /** A future approved adapter must independently verify public metadata/track,
   * enforce fixed network destinations/redirect policy, and never forward user
   * credentials. This injected port is not a production network implementation. */
  open(input:{videoId:string;track:YoutubeTranscriptInput['track']},signal:AbortSignal):Promise<{
    mediaType:'application/json';bytes:AsyncIterable<Uint8Array>;close():void;
  }>;
}
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const closeSafely=(response:{close():void}|undefined)=>{try{response?.close();}catch{/* Do not expose transport diagnostics. */}};

/** Pure, deterministic extraction. Evidence is retained caption text, not observation. */
export function extractYoutubeTranscript(bytes:Uint8Array,proposal:YoutubeTranscriptInput) {
  const input=youtubeTranscriptInputSchema.parse(proposal);
  if(!bytes.length || bytes.length>YOUTUBE_TRANSCRIPT_LIMITS.bytes) throw new Error('TRANSCRIPT_SIZE_LIMIT');
  let decoded:unknown;
  try {decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch {throw new Error('TRANSCRIPT_MALFORMED');}
  const parsed=retainedYoutubeTranscriptSchema.safeParse(decoded);
  if(!parsed.success) throw new Error('TRANSCRIPT_MALFORMED');
  const retained=parsed.data;
  if(retained.video.id!==singleYoutubeVideo(input.url).videoId || retained.video.url!==input.url ||
    JSON.stringify(retained.track)!==JSON.stringify(input.track)) throw new Error('FOREIGN_TRANSCRIPT');
  if(input.scope && input.scope.endMs>retained.video.durationMs) throw new Error('INVALID_TRANSCRIPT_SCOPE');
  const selected=retained.segments.map((segment,index)=>({segment,index})).filter(({segment})=>{
    if(!input.scope) return true;
    const intersects=segment.startMs<input.scope.endMs && segment.endMs>input.scope.startMs;
    if(intersects && (segment.startMs<input.scope.startMs || segment.endMs>input.scope.endMs)) throw new Error('PARTIAL_CAPTION_SCOPE');
    return intersects;
  });
  if(!selected.length) throw new Error('EMPTY_TRANSCRIPT_SCOPE');
  const rawChecksum=hash(bytes);let text='';
  const locations=selected.map(({segment,index})=>{
    if(text) text+='\n\n';const start=text.length;text+=segment.text;
    return {start,end:text.length,startMs:segment.startMs,endMs:segment.endMs,
      segmentId:hash(`${rawChecksum}:${index}`)};
  });
  if(Buffer.byteLength(text)>YOUTUBE_TRANSCRIPT_LIMITS.extractedBytes) throw new Error('TRANSCRIPT_OUTPUT_LIMIT');
  return {format:`${YOUTUBE_TRANSCRIPT_VERSION}-extraction` as const,videoId:retained.video.id,
    provider:retained.provider,track:retained.track,videoDurationMs:retained.video.durationMs,rawChecksum,offsetUnit:'utf16' as const,text,locations,
    coverage:{kind:'transcript_only' as const,exhaustiveVideo:false as const,timestamps:'provider_reported' as const,
      selectedSegments:selected.length,totalSegments:retained.segments.length,scope:input.scope??null}};
}

/** Default refuses acquisition. Only an explicitly injected non-billing adapter
 * can execute here; no provider, credentials or arbitrary URL is auto-selected. */
export async function acquireYoutubeTranscript(proposal:YoutubeTranscriptInput,provider?:YoutubeTranscriptProvider,callerSignal?:AbortSignal) {
  const input=youtubeTranscriptInputSchema.parse(proposal);
  if(!provider) throw new Error('TRANSCRIPT_PROVIDER_REQUIRED');
  if(provider.billing!=='none') throw new Error('TRANSCRIPT_PROVIDER_NOT_AUTHORIZED');
  if(callerSignal?.aborted) throw new Error('TRANSCRIPT_CANCELED');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),YOUTUBE_TRANSCRIPT_LIMITS.timeoutMs);
  const signal=AbortSignal.any([controller.signal,...(callerSignal?[callerSignal]:[])]);
  let abort!:()=>void;
  const interrupted=new Promise<never>((_resolve,reject)=>{
    abort=()=>reject(new Error(callerSignal?.aborted?'TRANSCRIPT_CANCELED':'TRANSCRIPT_DEADLINE'));
    signal.addEventListener('abort',abort,{once:true});
  });
  let response:Awaited<ReturnType<YoutubeTranscriptProvider['open']>>|undefined;
  try {
    const opening=provider.open({videoId:singleYoutubeVideo(input.url).videoId,track:{...input.track}},signal);
    // Close even a late transport response after an aborted open.
    void opening.then(value=>{if(signal.aborted)closeSafely(value);},()=>{});
    response=await Promise.race([opening,interrupted]);
    if(response.mediaType!=='application/json') throw new Error('TRANSCRIPT_MALFORMED');
    const chunks:Buffer[]=[];let size=0;const iterator=response.bytes[Symbol.asyncIterator]();
    try {
      while(true) {
        const chunk=await Promise.race([iterator.next(),interrupted]);if(chunk.done)break;
        size+=chunk.value.byteLength;if(size>YOUTUBE_TRANSCRIPT_LIMITS.bytes) throw new Error('TRANSCRIPT_SIZE_LIMIT');
        chunks.push(Buffer.from(chunk.value));
      }
    } finally {void iterator.return?.().catch(()=>{});}
    if(signal.aborted) throw new Error(callerSignal?.aborted?'TRANSCRIPT_CANCELED':'TRANSCRIPT_DEADLINE');
    const bytes=Buffer.concat(chunks);const extraction=extractYoutubeTranscript(bytes,input);
    if(extraction.provider.id!==provider.id || extraction.provider.version!==provider.version) throw new Error('FOREIGN_TRANSCRIPT_PROVIDER');
    return {bytes,checksum:hash(bytes),extraction};
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    const safe=['TRANSCRIPT_UNAVAILABLE','TRANSCRIPT_ACCESS_DENIED','TRANSCRIPT_TRACK_UNAVAILABLE','TRANSCRIPT_RATE_LIMIT',
      'TRANSCRIPT_CANCELED','TRANSCRIPT_DEADLINE','TRANSCRIPT_MALFORMED','TRANSCRIPT_SIZE_LIMIT','TRANSCRIPT_OUTPUT_LIMIT',
      'FOREIGN_TRANSCRIPT','FOREIGN_TRANSCRIPT_PROVIDER','INVALID_TRANSCRIPT_SCOPE','PARTIAL_CAPTION_SCOPE','EMPTY_TRANSCRIPT_SCOPE'];
    throw new Error(safe.includes(code)?code:'TRANSCRIPT_PROVIDER_FAILURE');
  } finally {clearTimeout(timer);signal.removeEventListener('abort',abort);closeSafely(response);}
}

/** Read-only boundary; caller must already authorize workspace ownership. The
 * canonical job-acceptance integration must additionally check its current DAG. */
export async function readOwnedYoutubeTranscript(sql:TextArtifactSql,identity:{workspaceId:string;artifactId:string;
  sourceId:string;sourceVersion:number;inputFingerprint:string},input:YoutubeTranscriptInput) {
  const retained=await readTextArtifact(sql,identity.workspaceId,identity.artifactId);
  if(retained.ref.kind!=='source_raw' || retained.ref.sourceId!==identity.sourceId || retained.ref.sourceVersion!==identity.sourceVersion ||
    retained.ref.inputFingerprint!==identity.inputFingerprint) throw new Error('FOREIGN_TRANSCRIPT_ARTIFACT');
  return extractYoutubeTranscript(retained.bytes,input);
}
