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

export function localRecommendationAiFixture(options?: {
  beforeCall?: () => Promise<void | ((settlement?: any) => Promise<void>)>;
}) {
  if (process.env.INTERACTION_LOCAL_MODEL_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    interpret: async (query: string) => {
      const release = await options?.beforeCall?.();
      try {
        // IntentProposal shape: { topic: string; outcomes: string[]; level: string|null; language: string|null; searchTerms: string[]; uncertainties: string[] }
        const res = {
          topic: query.slice(0, 160),
          outcomes: ['Master fundamentals and practical implementation'],
          level: null,
          language: null,
          searchTerms: ['consensus', 'replication', 'distributed'],
          uncertainties: [] as string[],
        };
        if (release) await release({ actualUsage: { promptTokens: 42, completionTokens: 28, totalTokens: 70, stepsCount: 1 } });
        return res;
      } catch (err) {
        if (release) await release({ error: err }).catch(() => undefined);
        throw err;
      }
    },
    rank: async (_intent: unknown, candidates: Array<{ cohortId: string }>) => {
      const release = await options?.beforeCall?.();
      try {
        // RankingProposal shape: { matches: Array<{ candidateKey: string; reason: string }> }
        const res = {
          matches: candidates.slice(0, 3).map(c => ({
            candidateKey: c.cohortId,
            reason: 'Matches your distributed consensus learning intent with practical engineering depth.',
          })),
        };
        if (release) await release({ actualUsage: { promptTokens: 60, completionTokens: 40, totalTokens: 100, stepsCount: 1 } });
        return res;
      } catch (err) {
        if (release) await release({ error: err }).catch(() => undefined);
        throw err;
      }
    },
  };
}

export function localDiscoveryAiFixture(options?: {
  beforeCall?: () => Promise<void | ((settlement?: any) => Promise<void>)>;
}) {
  if (process.env.INTERACTION_LOCAL_MODEL_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    search: async () => {
      const release = await options?.beforeCall?.();
      try {
        const res = {
          citations: [
            {
              id: 'cite-s4b-1',
              url: 'https://s4b-fixture.example.org/consensus-guide',
              title: 'Distributed Consensus & Replicated State Machines',
            },
            {
              id: 'cite-s4b-2',
              url: 'https://s4b-fixture.example.org/quorum-systems',
              title: 'Quorum Systems and Fault Tolerant Replication',
            },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-fixture' },
        };
        if (release) await release({ actualUsage: { promptTokens: 50, completionTokens: 35, totalTokens: 85, stepsCount: 1 } });
        return res;
      } catch (err) {
        if (release) await release({ error: err }).catch(() => undefined);
        throw err;
      }
    },
    select: async (_intent: unknown, candidates: Array<{ key: string }>) => {
      const release = await options?.beforeCall?.();
      try {
        const res = {
          selected: candidates.map(c => ({
            candidateKey: c.key,
            reason: 'Directly covers consensus protocols and state machine replication.',
          })),
        };
        if (release) await release({ actualUsage: { promptTokens: 45, completionTokens: 25, totalTokens: 70, stepsCount: 1 } });
        return res;
      } catch (err) {
        if (release) await release({ error: err }).catch(() => undefined);
        throw err;
      }
    },
  };
}

export function localDiscoveryObserverFixture() {
  if (process.env.INTERACTION_LOCAL_SOURCE_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    observe: async (citation: { id: string; url: string; title: string }) => {
      const { createHash } = await import('node:crypto');
      const key = createHash('sha256').update(citation.url).digest('hex');
      return {
        key,
        citationIds: [citation.id],
        url: citation.url,
        title: citation.title,
        kind: 'web' as const,
        observedAt: new Date().toISOString(),
        observation: {
          method: 'public_http' as const,
          requestedUrl: citation.url,
          redirects: [],
          titleOrigin: 'observed' as const,
          contentRetained: false as const,
        },
      };
    },
  };
}

export function localVideoObservationFixture() {
  if (process.env.INTERACTION_YOUTUBE_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    observeVideo: async (metadata: { videoId: string; url: string }) => ({
      format: 'youtube-video-observation-v1' as const,
      video: {
        id: metadata.videoId,
        title: 'Distributed Consensus Architecture Lecture',
        durationSeconds: 180,
        url: metadata.url,
      },
      model: {
        provider: 'google',
        modelId: 'gemini-2.5-flash',
        adapterVersion: 'vercel-video-observation-v3',
      },
      contentOrigin: 'ai' as const,
      observedAt: new Date().toISOString(),
      limitations: [
        'Coverage is non-exhaustive; timestamps are estimated.',
        'Model observations are not verbatim captions.',
      ],
      observations: [
        {
          startSeconds: 0,
          endSeconds: 60,
          text: 'Overview of leader election and quorum intersection in distributed systems.',
        },
        {
          startSeconds: 65,
          endSeconds: 140,
          text: 'Log replication safety and commitment rules across majority quorums.',
        },
      ],
    }),
  };
}

export function localGuideAuthorFixture() {
  if (process.env.INTERACTION_LOCAL_MODEL_FIXTURE !== '1') return undefined;
  assertFixtureSafe();
  return {
    identity: {
      provider: 'google' as const,
      modelId: 'gemini-3.1-flash-lite',
      adapterVersion: 'vercel-guide-author-v1' as const,
    },
    author: async (intent: { topic: { value: string } }) => ({
      title: `Guided Study: ${intent.topic.value.slice(0, 80)}`,
      summary: 'A structured introductory study guide tailored to your learning goal and daily pace.',
      sections: [
        {
          heading: 'Core Foundations & Mental Models',
          body: 'Understanding the fundamental invariants of state machine replication, quorum intersection, and fault tolerance ensures reliable system design.',
        },
        {
          heading: 'Practical Protocol Execution',
          body: 'Leaders coordinate log replication across followers and commit entries once a majority quorum acknowledges durability.',
        },
      ],
    }),
  };
}
