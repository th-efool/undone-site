import 'server-only';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { z } from 'zod';
import { discoveryCandidateSchema, groundedCitationSchema, type DiscoveryCandidate } from './discovery.contracts';
import { openWebSource, nodeWebTransport, webSourceUrl, type WebTransport } from './materials/web-fetch';
import { youtubeSourceUrl } from './materials/youtube-url';
import { youtubeMetadataSchema } from '@/src/shared/cohort-creation/youtube';
import type { YoutubeMetadataReader } from './materials/youtube-metadata';
import { githubRepositoryUrl, type PublicGithubProvider } from './materials/github';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

const fail = (message: string): never => { throw new CreationStorageError('INVALID_INPUT', message); };
/** Actual public metadata only. These observations are never represented as imported learning content. */
export class DiscoverySourceObserver {
  constructor(private readonly youtube: Pick<YoutubeMetadataReader, 'read'>,
    private readonly github: Pick<PublicGithubProvider, 'getRepository'>, private readonly transport: WebTransport = nodeWebTransport) {}
  async observe(input: z.infer<typeof groundedCitationSchema>, callerSignal: AbortSignal): Promise<DiscoveryCandidate> {
    const citation = groundedCitationSchema.parse(input); const url = webSourceUrl(citation.url);
    const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(30_000)]); signal.throwIfAborted();
    let redirects: string[] = [];
    const make = (finalUrl: string, title: string, kind: DiscoveryCandidate['kind'], method: DiscoveryCandidate['observation']['method'],
      titleOrigin: DiscoveryCandidate['observation']['titleOrigin'] = 'observed') => {
      signal.throwIfAborted();
      return discoveryCandidateSchema.parse({ key: createHash('sha256').update(finalUrl).digest('hex'), citationIds: [citation.id],
        url: finalUrl, title, kind, observedAt: new Date().toISOString(),
        observation: { method, requestedUrl: citation.url, redirects, titleOrigin, contentRetained: false } });
    };
    const providerMetadata = async (address: URL) => {
      if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(address.hostname)) {
        const source = youtubeSourceUrl(address.href); const metadata = youtubeMetadataSchema.parse(await this.youtube.read(source.url, signal));
        if (metadata.sourceUrl !== source.url || metadata.kind !== source.kind) return fail('YouTube returned different discovery metadata.');
        return make(source.url, source.kind === 'youtube_video' ? metadata.units[0].title : `YouTube playlist (${metadata.units.length} videos)`,
          source.kind, 'youtube_api', source.kind === 'youtube_video' ? 'observed' : 'application');
      }
      if (address.hostname === 'github.com') {
        const selected = githubRepositoryUrl(address.href);
        const repository = z.object({ name: z.string().min(1).max(100), owner: z.object({ login: z.string().min(1).max(100) }), private: z.literal(false) })
          .parse(await this.github.getRepository(selected, signal));
        if (repository.name.toLowerCase() !== selected.repo.toLowerCase() || repository.owner.login.toLowerCase() !== selected.owner.toLowerCase()) return fail('GitHub returned different discovery metadata.');
        return make(`https://github.com/${repository.owner.login}/${repository.name}`, `${repository.owner.login}/${repository.name}`, 'github', 'github_api');
      }
      return null;
    };
    const direct = await providerMetadata(url); if (direct) return direct;
    const opened = await openWebSource(url.href, signal, this.transport);
    try {
      redirects = opened.redirects;
      const final = new URL(opened.finalUrl); const metadata = await providerMetadata(final); if (metadata) return metadata;
      if (['notion.so', 'www.notion.so'].includes(final.hostname)) return fail('Notion pages require explicit connected source selection.');
      const maxBytes = opened.mediaType === 'text/html' ? 2 * 1024 * 1024 : 1024 * 1024;
      const chunks: Uint8Array[] = []; let length = 0;
      for await (const chunk of opened.bytes) {
        opened.signal.throwIfAborted(); length += chunk.byteLength;
        if (length > maxBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Discovery metadata exceeds its page observation limit. Select a smaller source; nothing was truncated.');
        chunks.push(chunk);
      }
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
      catch { return fail('Discovery page is not valid UTF-8.'); }
      if (!text.trim()) return fail('Discovery page has no readable metadata.');
      let title = ''; let titleOrigin: 'observed' | 'application' = 'application';
      if (opened.mediaType === 'text/html') {
        const dom = new JSDOM(text, { url: opened.finalUrl, virtualConsole: new VirtualConsole() });
        try {
          if (dom.window.document.getElementsByTagName('*').length > 20_000) throw new CreationStorageError('LIMIT_EXCEEDED', 'Discovery page has too many elements. Select a simpler source.');
          title = dom.window.document.querySelector('title')?.textContent?.trim() ?? '';
          if (title) titleOrigin = 'observed';
        } finally { dom.window.close(); }
      }
      // A URL-derived label is explicit application metadata, never an AI-invented page title.
      return make(opened.finalUrl, title || `${final.hostname}${final.pathname}`, 'web', 'public_http', titleOrigin);
    } finally { opened.close(); }
  }
}
