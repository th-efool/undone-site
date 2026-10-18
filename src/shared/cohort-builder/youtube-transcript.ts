import { z } from 'zod';

export const YOUTUBE_TRANSCRIPT_VERSION = 'youtube-transcript-v1';
export const YOUTUBE_TRANSCRIPT_LIMITS = Object.freeze({ bytes: 1024 * 1024, segments: 1000,
  durationMs: 4 * 60 * 60 * 1000, extractedBytes: 200_000, timeoutMs: 20_000 });
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

/** Exact hosts/paths only. Playlist and implicit time scope are deliberately rejected. */
export function singleYoutubeVideo(input: string): { videoId: string; url: string } {
  const invalid = () => { throw new Error('INVALID_YOUTUBE_VIDEO_URL'); };
  if (input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) return invalid();
  let url: URL; try { url = new URL(input); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
    !['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)) return invalid();
  let candidate: string | null = null;
  if (url.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) candidate = url.pathname.split('/')[1];
  else if (url.hostname !== 'youtu.be' && url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) candidate = url.searchParams.get('v');
  else if (url.hostname !== 'youtu.be' && /^\/(shorts|embed)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) candidate = url.pathname.split('/')[2];
  if (!candidate || !videoId.safeParse(candidate).success) return invalid();
  return { videoId: candidate, url: `https://www.youtube.com/watch?v=${candidate}` };
}
export const youtubeVideoUrlSchema = z.string().max(2048).transform((input,ctx) => {
  try {return singleYoutubeVideo(input).url;} catch {ctx.addIssue({code:'custom',message:'Use a single public HTTPS YouTube video URL without playlist/time scope'});return z.NEVER;}
});
const milliseconds = z.number().int().min(0).max(YOUTUBE_TRANSCRIPT_LIMITS.durationMs);
export function formatYoutubeTimestamp(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
export const youtubeTimeScopeSchema = z.strictObject({startMs:milliseconds,endMs:milliseconds})
  .refine(value=>value.endMs>value.startMs,'Scope end must follow start');
export const youtubeTrackSchema = z.strictObject({id:z.string().min(1).max(200),
  language:z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).max(35),
  kind:z.enum(['manual','automatic']),translated:z.literal(false)});
export const youtubeTranscriptInputSchema = z.strictObject({
  kind: z.literal('youtube').optional(),
  mode: z.enum(['transcript', 'video_observation']).optional(),
  url: youtubeVideoUrlSchema,
  track: youtubeTrackSchema,
  scope: youtubeTimeScopeSchema.optional(),
});
export type YoutubeTranscriptInput = z.infer<typeof youtubeTranscriptInputSchema>;

/** A trusted adapter must independently verify public visibility and exact track identity.
 * A schema-valid object supplied by a browser is never proof of acquisition. */
export const retainedYoutubeTranscriptSchema = z.strictObject({
  format:z.literal(YOUTUBE_TRANSCRIPT_VERSION),
  provider:z.strictObject({id:z.string().regex(/^[a-z0-9-]{1,80}$/),version:z.string().min(1).max(100)}),
  acquiredAt:z.iso.datetime(),
  video:z.strictObject({id:videoId,url:youtubeVideoUrlSchema,durationMs:milliseconds.refine(value=>value>0),
    visibility:z.literal('public'),state:z.literal('complete')}),
  track:youtubeTrackSchema,
  segments:z.array(z.strictObject({startMs:milliseconds,endMs:milliseconds,text:z.string().min(1).max(16_000)
    .refine(value=>value.trim().length>0&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),'Caption text is empty or binary')}))
    .min(1).max(YOUTUBE_TRANSCRIPT_LIMITS.segments),
}).superRefine((value,ctx)=>{
  if(singleYoutubeVideo(value.video.url).videoId!==value.video.id) ctx.addIssue({code:'custom',message:'Video identity mismatch'});
  let previous=-1;const seen=new Set<string>();
  for(const segment of value.segments) {
    const key=JSON.stringify(segment);
    if(segment.startMs<previous || segment.endMs<=segment.startMs || segment.endMs>value.video.durationMs || seen.has(key))
      ctx.addIssue({code:'custom',message:'Invalid, repeated or unordered caption interval'});
    previous=segment.startMs;seen.add(key);
  }
});
export type RetainedYoutubeTranscript = z.infer<typeof retainedYoutubeTranscriptSchema>;
