import { extractPlaylistId, extractVideoId } from '@/src/server/imports/youtube/youtube-url';
import { youtubePlaylistIdSchema, youtubeVideoIdSchema } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

function invalid(): never { throw new CreationStorageError('INVALID_INPUT', 'Provide a public HTTPS YouTube video or playlist URL.'); }
/** Legacy helpers run only behind exact-host/path checks, never their substring fallback. */
export function youtubeSourceUrl(input: string) {
  if (input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) invalid();
  let parsed: URL; try { parsed = new URL(input); } catch { return invalid(); }
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password ||
    !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(parsed.hostname)) invalid();
  if (parsed.hostname !== 'youtu.be' && parsed.pathname === '/playlist') {
    if (parsed.searchParams.getAll('list').length !== 1) invalid();
    const playlistId = extractPlaylistId(parsed.href);
    if (!youtubePlaylistIdSchema.safeParse(playlistId).success) invalid();
    return { kind: 'youtube_playlist' as const, playlistId, url: `https://www.youtube.com/playlist?list=${playlistId}` };
  }
  let candidate: string | null;
  if (parsed.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}\/?$/.test(parsed.pathname)) {
    // Canonicalize before the helper, so a tracking v= cannot override the path ID.
    candidate = extractVideoId(`https://youtu.be/${parsed.pathname.split('/')[1]}`);
  } else if (parsed.hostname !== 'youtu.be' && parsed.pathname === '/watch' && parsed.searchParams.getAll('v').length === 1) {
    candidate = extractVideoId(parsed.href);
  } else if (parsed.hostname !== 'youtu.be' && /^\/(shorts|embed)\/[A-Za-z0-9_-]{11}\/?$/.test(parsed.pathname)) {
    candidate = parsed.pathname.split('/')[2];
  } else return invalid();
  if (!youtubeVideoIdSchema.safeParse(candidate).success) invalid();
  return { kind: 'youtube_video' as const, videoId: candidate!, url: `https://www.youtube.com/watch?v=${candidate}` };
}
