'use client';

import { useState, useCallback, useMemo } from 'react';
import type { CohortSource, ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';
import { sha256 } from '@/src/shared/cohort-builder/hash';
import { extractPdfClient } from '@/src/client/lib/sourceExtractors/pdfClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import { extractGithubClient } from '@/src/client/lib/sourceExtractors/githubClientExtractor';
import { extractWebClient } from '@/src/client/lib/sourceExtractors/webClientExtractor';
import { detectLinkKind, ComposerLinkItem } from './LinkRows';
import { ComposerFileItem } from './AttachmentTray';

export interface UseComposerAttachmentsOptions {
  maxFiles?: number;
  maxLinks?: number;
  maxPdfSizeMb?: number;
  maxTextSizeMb?: number;
}

export interface ComposerAttachmentState {
  files: (ComposerFileItem & { extraction?: ClientSourceExtraction })[];
  links: (ComposerLinkItem & { extraction?: ClientSourceExtraction })[];
  isExtracting: boolean;
  totalCount: number;
  errors: string[];
  addFiles: (fileList: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  addLink: (url: string) => Promise<void>;
  removeLink: (id: string) => void;
  clearAll: () => void;
  getReadySources: () => CohortSource[];
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_LINKS = 20;
const DEFAULT_MAX_PDF_MB = 50;
const DEFAULT_MAX_TEXT_MB = 5;

export function useComposerAttachments(
  options: UseComposerAttachmentsOptions = {}
): ComposerAttachmentState {
  const {
    maxFiles = DEFAULT_MAX_FILES,
    maxLinks = DEFAULT_MAX_LINKS,
    maxPdfSizeMb = DEFAULT_MAX_PDF_MB,
    maxTextSizeMb = DEFAULT_MAX_TEXT_MB,
  } = options;

  const [files, setFiles] = useState<(ComposerFileItem & { extraction?: ClientSourceExtraction })[]>([]);
  const [links, setLinks] = useState<(ComposerLinkItem & { extraction?: ClientSourceExtraction })[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const addError = useCallback((msg: string) => {
    setErrors((prev) => [...prev.slice(-4), msg]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setLinks([]);
    setErrors([]);
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const availableSlots = maxFiles - files.length;
      if (availableSlots <= 0) {
        addError(`Maximum ${maxFiles} files reached.`);
        return;
      }

      const accepted = incoming.slice(0, availableSlots);

      for (const file of accepted) {
        const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
        const limitBytes = isPdf ? maxPdfSizeMb * 1024 * 1024 : maxTextSizeMb * 1024 * 1024;

        if (file.size > limitBytes) {
          addError(
            `"${file.name}" exceeds the ${isPdf ? maxPdfSizeMb : maxTextSizeMb}MB limit.`
          );
          continue;
        }

        const newFileItem: ComposerFileItem & { extraction?: ClientSourceExtraction } = {
          id,
          file,
          name: file.name,
          size: file.size,
          type: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
          status: 'extracting',
        };

        setFiles((prev) => [...prev, newFileItem]);

        // Start async extraction
        (async () => {
          try {
            if (isPdf) {
              const result = await extractPdfClient(file);
              const extraction: ClientSourceExtraction = {
                text: result.text,
                locations: result.locations,
                checksum: result.checksum,
                provenance: result.provenance,
              };

              setFiles((prev) =>
                prev.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status: 'ready',
                        thumbnailUrl: result.thumbnailUrl,
                        extraction,
                      }
                    : item
                )
              );
            } else {
              // Text or markdown file
              const textContent = await file.text();
              const trimmed = textContent.trim();
              const hash = sha256(trimmed);
              const extraction: ClientSourceExtraction = {
                text: trimmed,
                checksum: hash,
                locations: [
                  {
                    start: 0,
                    end: Math.max(1, trimmed.length),
                  },
                ],
                provenance: {
                  parserVersion: 'text-client-v1',
                  rawChecksum: hash,
                  scope: 'full_text_response',
                },
              };

              setFiles((prev) =>
                prev.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status: 'ready',
                        extraction,
                      }
                    : item
                )
              );
            }
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Extraction failed';
            setFiles((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: 'error',
                      error: errorMsg,
                    }
                  : item
              )
            );
            addError(`Failed to process "${file.name}": ${errorMsg}`);
          }
        })();
      }
    },
    [files.length, maxFiles, maxPdfSizeMb, maxTextSizeMb, addError]
  );

  const addLink = useCallback(
    async (rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (!trimmed) return;

      if (links.length >= maxLinks) {
        addError(`Maximum ${maxLinks} links reached.`);
        return;
      }

      const formattedUrl =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;

      const kind = detectLinkKind(formattedUrl);
      const id = `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const newLinkItem: ComposerLinkItem & { extraction?: ClientSourceExtraction } = {
        id,
        url: formattedUrl,
        kind,
        status: 'extracting',
      };

      setLinks((prev) => [...prev, newLinkItem]);

      // Start async extraction based on kind
      (async () => {
        try {
          if (kind === 'youtube') {
            // First fetch video or playlist metadata
            let durationMs = 600000;
            let description = '';
            let videoTitle = '';

            try {
              const res = await fetch(`/api/import/youtube/metadata?url=${encodeURIComponent(formattedUrl)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.videos && data.videos.length > 0) {
                  durationMs = data.videos[0].durationMs || durationMs;
                  description = data.videos[0].description || '';
                  videoTitle = data.videos[0].title || '';
                } else if (data.durationMs) {
                  durationMs = data.durationMs;
                  description = data.description || '';
                  videoTitle = data.title || '';
                }
              }
            } catch {
              // Continue with fallback duration and client extractor
            }

            const extraction = await extractYoutubeClient(formattedUrl, {
              durationMs,
              description,
              title: videoTitle,
            });

            setLinks((prev) =>
              prev.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: 'ready',
                      title: videoTitle || extraction.provenance?.videoTitle || l.url,
                      extraction,
                    }
                  : l
              )
            );
          } else if (kind === 'github') {
            const extraction = await extractGithubClient(formattedUrl);
            setLinks((prev) =>
              prev.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: 'ready',
                      title: `GitHub: ${extraction.provenance?.repoUrl?.split('/').slice(-2).join('/') || 'Repository'}`,
                      extraction,
                    }
                  : l
              )
            );
          } else {
            // Web or Notion
            const extraction = await extractWebClient(formattedUrl);
            setLinks((prev) =>
              prev.map((l) =>
                l.id === id
                  ? {
                      ...l,
                      status: 'ready',
                      title: extraction.title || 'Web Document',
                      extraction: {
                        text: extraction.text,
                        locations: extraction.locations,
                        checksum: extraction.checksum,
                        provenance: extraction.provenance,
                      },
                    }
                  : l
              )
            );
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Extraction failed';
          setLinks((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    status: 'error',
                    error: errorMsg,
                  }
                : l
            )
          );
          addError(`Failed to extract "${formattedUrl}": ${errorMsg}`);
        }
      })();
    },
    [links.length, maxLinks, addError]
  );

  const isExtracting = useMemo(() => {
    return (
      files.some((f) => f.status === 'extracting') ||
      links.some((l) => l.status === 'extracting')
    );
  }, [files, links]);

  const totalCount = files.length + links.length;

  const getReadySources = useCallback((): CohortSource[] => {
    const readySources: CohortSource[] = [];

    // Map ready files
    for (const f of files) {
      if (f.status === 'ready' && f.extraction) {
        readySources.push({
          id: f.id,
          version: 1,
          label: f.name,
          text: f.extraction.text,
          locations: f.extraction.locations,
          provenance: f.extraction.provenance,
          checksum: f.extraction.checksum || sha256(f.extraction.text),
          state: 'ready',
        });
      }
    }

    // Map ready links
    for (const l of links) {
      if (l.status === 'ready' && l.extraction) {
        readySources.push({
          id: l.id,
          version: 1,
          label: l.title || l.url,
          text: l.extraction.text,
          locations: l.extraction.locations,
          provenance: l.extraction.provenance,
          checksum: l.extraction.checksum || sha256(l.extraction.text),
          state: 'ready',
        });
      }
    }

    return readySources;
  }, [files, links]);

  return {
    files,
    links,
    isExtracting,
    totalCount,
    errors,
    addFiles,
    removeFile,
    addLink,
    removeLink,
    clearAll,
    getReadySources,
  };
}
