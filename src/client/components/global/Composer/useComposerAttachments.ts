'use client';

import { useState, useCallback, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import pLimit from 'p-limit';
import type { CohortSource, ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';
import { byteLengthUtf8 } from '@/src/shared/cohort-builder/client-pipeline';
import { sha256 } from '@/src/shared/cohort-builder/hash';
import { detectSourceKind } from '@/src/shared/cohort-builder/source-kind';
import { extractPdfClient } from '@/src/client/lib/sourceExtractors/pdfClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import { extractGithubClient } from '@/src/client/lib/sourceExtractors/githubClientExtractor';
import { extractWebClient } from '@/src/client/lib/sourceExtractors/webClientExtractor';
import type { ComposerLinkItem } from './LinkRows';
import type { ComposerFileItem } from './AttachmentTray';

export interface UseComposerAttachmentsOptions {
  maxFiles?: number;
  maxLinks?: number;
  maxPdfSizeMb?: number;
  maxTextSizeMb?: number;
}

type FileItem = ComposerFileItem & { extraction?: ClientSourceExtraction };
type LinkItem = ComposerLinkItem & { extraction?: ClientSourceExtraction };

/** Intake is a single JSON POST (Vercel limit 4.5 MB) and a sessionStorage draft: keep text well under both. */
const MAX_TOTAL_TEXT_BYTES = 3 * 1024 * 1024;
/** Bounded parallelism: protects memory (PDFs) and the YouTube/GitHub APIs (playlists). */
const limit = pLimit(4);

const patch = <T extends { id: string }>(set: Dispatch<SetStateAction<T[]>>, id: string, change: Partial<T>) =>
  set((prev) => prev.map((item) => (item.id === id ? { ...item, ...change } : item)));

/** List state mirrored in a ref so several adds in the same tick (multi-line paste) see each other. */
function useSyncedList<T>(): [T[], MutableRefObject<T[]>, Dispatch<SetStateAction<T[]>>] {
  const [list, setList] = useState<T[]>([]);
  const ref = useRef<T[]>([]);
  const set = useCallback<Dispatch<SetStateAction<T[]>>>((update) => {
    ref.current = typeof update === 'function' ? (update as (p: T[]) => T[])(ref.current) : update;
    setList(ref.current);
  }, []);
  return [list, ref, set];
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Extraction failed');
const isPdfFile = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

interface YoutubeMeta { videoId?: string; title?: string; description?: string; durationMs?: number }

async function extractSingleLink(kind: ReturnType<typeof detectSourceKind>, url: string, meta?: YoutubeMeta) {
  if (kind === 'youtube') {
    let info = meta;
    if (!info) {
      const res = await fetch(`/api/import/youtube/metadata?url=${encodeURIComponent(url)}`).catch(() => null);
      info = res?.ok ? await res.json().catch(() => undefined) : undefined;
    }
    const extraction = await extractYoutubeClient(url, info);
    return { title: info?.title || extraction.provenance?.videoTitle || url, extraction };
  }
  if (kind === 'github') {
    const extraction = await extractGithubClient(url);
    const repo = extraction.provenance?.repoUrl?.split('/').slice(-2).join('/');
    return { title: repo ? `GitHub: ${repo}` : 'GitHub repository', extraction };
  }
  if (kind === 'pdf') throw new Error('Download the PDF and add it with Upload.');
  const { title, ...extraction } = await extractWebClient(url);
  return { title: title || 'Web page', extraction };
}

export function toCohortSource(item: { id: string; label: string; extraction: ClientSourceExtraction }): CohortSource {
  const { text, locations, provenance, checksum } = item.extraction;
  return { id: item.id, version: 1, label: item.label, text, locations, provenance, checksum: checksum ?? sha256(text), state: 'ready' };
}

export function useComposerAttachments(options: UseComposerAttachmentsOptions = {}) {
  const { maxFiles = 10, maxLinks = 20, maxPdfSizeMb = 50, maxTextSizeMb = 5 } = options;

  const [files, filesRef, setFiles] = useSyncedList<FileItem>();
  const [links, linksRef, setLinks] = useSyncedList<LinkItem>();
  const [errors, setErrors] = useState<string[]>([]);
  const bytesById = useRef(new Map<string, number>());

  const addError = useCallback((msg: string) => setErrors((prev) => [...prev.slice(-4), msg]), []);

  /** Records extracted size against the shared budget; throws when the budget would be exceeded. */
  const reserveBytes = (id: string, extraction: ClientSourceExtraction) => {
    const size = byteLengthUtf8(extraction.text);
    const used = [...bytesById.current.values()].reduce((a, b) => a + b, 0);
    if (used + size > MAX_TOTAL_TEXT_BYTES) throw new Error('Material limit reached (3 MB of text). Remove something first.');
    bytesById.current.set(id, size);
  };

  type Status = 'idle' | 'extracting' | 'ready' | 'error';
  const run = <T extends { id: string; status: Status; error?: string }>(
    set: Dispatch<SetStateAction<(T & { extraction?: ClientSourceExtraction })[]>>,
    id: string,
    label: string,
    work: () => Promise<{ extraction: ClientSourceExtraction } & Partial<T>>,
  ) =>
    limit(async () => {
      try {
        const result = await work();
        reserveBytes(id, result.extraction);
        patch(set, id, { ...result, status: 'ready' } as Partial<T & { extraction?: ClientSourceExtraction }>);
      } catch (err) {
        patch(set, id, { status: 'error', error: messageOf(err) } as Partial<T & { extraction?: ClientSourceExtraction }>);
        addError(`${label}: ${messageOf(err)}`);
      }
    });

  const removeFile = useCallback((id: string) => {
    bytesById.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const removeLink = useCallback((id: string) => {
    bytesById.current.delete(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    bytesById.current.clear();
    setFiles([]);
    setLinks([]);
    setErrors([]);
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const slots = maxFiles - filesRef.current.length;
    if (slots <= 0) return addError(`Maximum ${maxFiles} files reached.`);

    for (const file of Array.from(fileList).slice(0, slots)) {
      const pdf = isPdfFile(file);
      const limitMb = pdf ? maxPdfSizeMb : maxTextSizeMb;
      if (file.size > limitMb * 1024 * 1024) {
        addError(`"${file.name}" exceeds the ${limitMb}MB limit.`);
        continue;
      }
      const id = crypto.randomUUID();
      setFiles((prev) => [...prev, { id, name: file.name, size: file.size, type: pdf ? 'application/pdf' : file.type || 'text/plain', status: 'extracting' }]);

      void run<ComposerFileItem>(setFiles, id, file.name, async () => {
        if (pdf) {
          const { thumbnailUrl, text, locations, checksum, provenance } = await extractPdfClient(file);
          return { thumbnailUrl, extraction: { text, locations, checksum, provenance } };
        }
        const text = (await file.text()).trim();
        if (!text) throw new Error('File is empty.');
        const checksum = sha256(text);
        return {
          extraction: {
            text,
            checksum,
            locations: [{ start: 0, end: text.length }],
            provenance: { parserVersion: 'text-client-v1', rawChecksum: checksum, scope: 'full_text_response' as const },
          },
        };
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run/addError are stable closures over refs and setters
  }, [maxFiles, maxPdfSizeMb, maxTextSizeMb, addError]);

  const addLink = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (linksRef.current.some((l) => l.url === url)) return;
    if (linksRef.current.length >= maxLinks) return addError(`Maximum ${maxLinks} links reached.`);

    const kind = detectSourceKind(url);
    const id = crypto.randomUUID();
    setLinks((prev) => [...prev, { id, url, kind, status: 'extracting' }]);

    const extract = (itemId: string, itemUrl: string, meta?: YoutubeMeta) =>
      run<ComposerLinkItem>(setLinks, itemId, itemUrl, () => extractSingleLink(kind, itemUrl, meta));

    // A playlist expands into one card per video (metadata already includes duration + description).
    if (kind === 'youtube' && /[?&]list=/.test(url)) {
      const res = await fetch(`/api/import/youtube/metadata?url=${encodeURIComponent(url)}`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (data?.isPlaylist && Array.isArray(data.videos)) {
        const room = maxLinks - linksRef.current.length + 1; // the placeholder row is replaced below
        const videos = (data.videos as Array<YoutubeMeta & { videoId: string }>).slice(0, Math.max(room, 0));
        const rows: LinkItem[] = videos.map((v) => ({
          id: crypto.randomUUID(), kind, status: 'extracting' as const, title: v.title,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
        }));
        setLinks((prev) => [...prev.filter((l) => l.id !== id), ...rows]);
        if (data.videos.length > rows.length) addError(`Added the first ${rows.length} of ${data.videos.length} videos (link limit).`);
        rows.forEach((row, i) => void extract(row.id, row.url, videos[i]));
        return;
      }
    }
    void extract(id, url);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run/addError are stable closures over refs and setters
  }, [maxLinks, addError]);

  const restoreSources = useCallback((sources: CohortSource[]) => {
    if (!sources || !sources.length) return;
    const newFiles: FileItem[] = [];
    const newLinks: LinkItem[] = [];

    for (const s of sources) {
      if (!s.text) continue;
      const extraction: ClientSourceExtraction = {
        text: s.text,
        locations: s.locations ?? [{ start: 0, end: s.text.length }],
        provenance: s.provenance,
        checksum: s.checksum ?? sha256(s.text),
      };
      try {
        reserveBytes(s.id, extraction);
      } catch {
        break; // Stop restoring if text budget is reached
      }

      const isFile = s.label.toLowerCase().endsWith('.pdf') || s.input?.kind === 'pdf' || (s.provenance as any)?.pageCount !== undefined;
      if (isFile) {
        newFiles.push({
          id: s.id,
          name: s.label,
          size: byteLengthUtf8(s.text),
          type: 'application/pdf',
          status: 'ready',
          extraction,
        });
      } else {
        const url = s.input?.kind === 'web' ? s.input.url : s.input?.kind === 'youtube' ? s.input.url : s.label;
        newLinks.push({
          id: s.id,
          url,
          title: s.label,
          kind: detectSourceKind(url),
          status: 'ready',
          extraction,
        });
      }
    }

    if (newFiles.length) setFiles((prev) => [...prev, ...newFiles]);
    if (newLinks.length) setLinks((prev) => [...prev, ...newLinks]);
  }, [setFiles, setLinks]);

  const isExtracting = useMemo(
    () => files.some((f) => f.status === 'extracting') || links.some((l) => l.status === 'extracting'),
    [files, links],
  );

  const getReadySources = useCallback((): CohortSource[] => [
    ...files.flatMap((f) => (f.status === 'ready' && f.extraction ? [toCohortSource({ id: f.id, label: f.name, extraction: f.extraction })] : [])),
    ...links.flatMap((l) => (l.status === 'ready' && l.extraction ? [toCohortSource({ id: l.id, label: l.title || l.url, extraction: l.extraction })] : [])),
  ], [files, links]);

  return { files, links, isExtracting, totalCount: files.length + links.length, errors, addFiles, removeFile, addLink, removeLink, clearAll, getReadySources, restoreSources };
}



