import type { WebTransport } from '@/src/server/domain/cohort-creation/materials/web-fetch';
import type { YoutubeTranscriptProvider } from '@/src/server/domain/cohort-builder/youtube-transcript';
import type { GithubSourceProvider } from '@/src/server/domain/cohort-builder/github-source';
import { YOUTUBE_TRANSCRIPT_VERSION } from '@/src/shared/cohort-builder/youtube-transcript';

function assertFixtureSafe() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV !== 'development' ||
    !['127.0.0.1', 'localhost'].includes(database.hostname) ||
    !database.pathname.startsWith('/s3test')
  ) {
    throw new Error('LOCAL_SOURCE_FIXTURE_FORBIDDEN');
  }
}

/** Deterministic transport, never a localhost/SSRF allowlist. Production URL,
 * DNS and pin validation still runs; fixture can only be enabled on isolated dev DB. */
export function localSourceFixture(): WebTransport | undefined {
  if (process.env.INTERACTION_LOCAL_SOURCE_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  const attempts = new Map<string, number>();
  return {
    resolve: async hostname => {
      if (hostname !== 's4b-fixture.example.org') throw new Error('FIXTURE_HOST_FORBIDDEN');
      return [{ address: '93.184.216.34', family: 4 }];
    },
    open: async url => {
      if (url.hostname !== 's4b-fixture.example.org') throw new Error('FIXTURE_HOST_FORBIDDEN');
      const attempt = (attempts.get(url.href) ?? 0) + 1;
      attempts.set(url.href, attempt);
      return {
        status: url.pathname === '/retry' && attempt === 1 ? 503 : 200,
        headers: { 'content-type': 'text/plain' },
        bytes: (async function* () {
          yield Buffer.from('Majorities overlap. Retained web evidence prevents unsupported conclusions.');
        })(),
        close: () => {},
      };
    },
  };
}

export function localYoutubeFixture(): YoutubeTranscriptProvider | undefined {
  if (process.env.INTERACTION_YOUTUBE_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    id: 'youtube-fixture',
    version: '1',
    billing: 'none',
    open: async (input, signal) => {
      if (signal.aborted) throw new Error('TRANSCRIPT_CANCELED');
      const payload = {
        format: YOUTUBE_TRANSCRIPT_VERSION,
        provider: { id: 'youtube-fixture', version: '1' },
        acquiredAt: new Date().toISOString(),
        video: {
          id: input.videoId,
          url: `https://www.youtube.com/watch?v=${input.videoId}`,
          durationMs: 120_000,
          visibility: 'public' as const,
          state: 'complete' as const,
        },
        track: {
          id: input.track.id,
          language: input.track.language,
          kind: input.track.kind,
          translated: false as const,
        },
        segments: [
          { startMs: 0, endMs: 15_000, text: 'YouTube lecture on consensus and quorum overlap.' },
          { startMs: 15_000, endMs: 45_000, text: 'YouTube transcripts ground learning objectives with exact timestamps.' },
          { startMs: 45_000, endMs: 75_000, text: 'Quorum overlaps guarantee write consistency across partitions.' },
        ],
      };
      const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
      return {
        mediaType: 'application/json' as const,
        bytes: (async function* () { yield bytes; })(),
        close: () => {},
      };
    },
  };
}

export function localGithubFixture(): GithubSourceProvider | undefined {
  if (process.env.INTERACTION_GITHUB_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    id: 'github-fixture',
    version: '1',
    billing: 'none',
    resolveRef: async (_repo, ref, signal) => {
      if (signal.aborted) throw new Error('GITHUB_CANCELED');
      return { commitSha: /^[a-f0-9]{40}$/i.test(ref) ? ref.toLowerCase() : '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d' };
    },
    fetchFiles: async (_repo, _sha, paths, signal) => {
      if (signal.aborted) throw new Error('GITHUB_CANCELED');
      return paths.map(path => {
        const text = `# Repository file: ${path}\n\nGitHub source files ground learning objectives with exact line citations.\nQuorum intersections guarantee monotonic read consistency.\n`;
        return {
          path,
          content: new TextEncoder().encode(text),
        };
      });
    },
  };
}
