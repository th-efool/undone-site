'use client';
import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CohortAction, CohortSource, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { singleYoutubeVideo } from '@/src/shared/cohort-builder/youtube-transcript';
import { extractWebClient } from '@/src/client/lib/sourceExtractors/webClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import styles from './MaterialStageView.module.css';

export interface MaterialStageViewProps {
  workspace: CohortWorkspace;
  workspaceId?: string;
  revision?: number;
  ownerId?: string;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function extractYoutubeVideoId(source: CohortSource): string | null {
  if (source.input?.kind !== 'youtube') return null;
  if (source.provenance?.videoId && /^[A-Za-z0-9_-]{11}$/.test(source.provenance.videoId)) {
    return source.provenance.videoId;
  }
  try {
    return singleYoutubeVideo(source.input.url).videoId;
  } catch {
    return null;
  }
}

function getSourceTypeBadge(source: CohortSource): string {
  switch (source.input?.kind) {
    case 'youtube':
      return 'YouTube Video';
    case 'pdf':
      return 'PDF Document';
    case 'web':
      return 'Web Article';
    case 'github':
      return 'GitHub Repo';
    case 'generated_guide':
      return 'AI Guide';
    default:
      return 'Text / Notes';
  }
}

export type DisplaySourceGroup =
  | { kind: 'single'; source: CohortSource; index: number }
  | { kind: 'playlist'; batchKey: string; sources: CohortSource[]; firstIndex: number; title: string };

export function groupSourcesForDisplay(sources: CohortSource[]): DisplaySourceGroup[] {
  const batchCounts = new Map<string, number>();
  for (const s of sources) {
    const match = s.id.match(/^(.+):yt:\d+$/);
    if (match) {
      batchCounts.set(match[1], (batchCounts.get(match[1]) ?? 0) + 1);
    }
  }

  const groups: DisplaySourceGroup[] = [];
  const emittedBatches = new Set<string>();

  sources.forEach((source, index) => {
    const match = source.id.match(/^(.+):yt:\d+$/);
    const batchKey = match?.[1];
    if (batchKey && (batchCounts.get(batchKey) ?? 0) > 1) {
      if (emittedBatches.has(batchKey)) return;
      emittedBatches.add(batchKey);
      const batchSources = sources.filter(s => s.id.startsWith(`${batchKey}:yt:`));
      const firstLabel = batchSources[0]?.label || 'YouTube Playlist';
      groups.push({
        kind: 'playlist',
        batchKey,
        sources: batchSources,
        firstIndex: index,
        title: firstLabel,
      });
    } else {
      groups.push({ kind: 'single', source, index });
    }
  });

  return groups;
}

export interface SourceItemRowProps {
  source: CohortSource;
  index: number;
  busy: boolean;
  onRemove: (sourceId: string) => void;
  errorMessage?: string | null;
  onRetry?: (source: CohortSource) => void;
  onReplace?: (sourceId: string) => void;
}

export const SourceItemRow = React.memo(function SourceItemRow({
  source,
  index,
  busy,
  onRemove,
}: SourceItemRowProps) {
  const videoId = extractYoutubeVideoId(source);
  return (
    <li className={styles.sourceItem}>
      <div className={styles.thumbWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {videoId ? (
          <img
            className={styles.thumbnail}
            src={'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.fileIcon} aria-hidden="true">
            ↗
          </span>
        )}
        <span className={styles.typeBadge}>
          {videoId ? 'VIDEO' : 'LINK'}
        </span>
      </div>
      <div className={styles.cardBody}>
        <small>{getSourceTypeBadge(source)}</small>
        <h3>{source.label || 'Source ' + (index + 1)}</h3>
      </div>
      <div className={styles.cardFooter}>
        <button
          type="button"
          disabled={busy}
          aria-label={'Remove source ' + (index + 1)}
          onClick={() => onRemove(source.id)}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </li>
  );
});

export interface SourceGroupCardProps {
  group: DisplaySourceGroup;
  busy: boolean;
  onRemoveSingle: (sourceId: string) => void;
  onRemovePlaylist: (sourceIds: string[]) => void;
}

export function SourceGroupCard({
  group,
  busy,
  onRemoveSingle,
  onRemovePlaylist,
}: SourceGroupCardProps) {
  if (group.kind === 'single') {
    return (
      <SourceItemRow
        source={group.source}
        index={group.index}
        busy={busy}
        onRemove={onRemoveSingle}
      />
    );
  }

  const leadVideoId = extractYoutubeVideoId(group.sources[0]);
  const count = group.sources.length;
  return (
    <li className={`${styles.sourceItem} ${styles.playlistCard}`}>
      <div className={styles.thumbWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {leadVideoId ? (
          <img
            className={styles.thumbnail}
            src={'https://i.ytimg.com/vi/' + leadVideoId + '/hqdefault.jpg'}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.fileIcon} aria-hidden="true">
            ▶
          </span>
        )}
        <span className={`${styles.typeBadge} ${styles.playlistBadge}`}>
          ▶ PLAYLIST · {count} VIDEOS
        </span>
      </div>
      <div className={styles.cardBody}>
        <small>YouTube Playlist · {count} videos</small>
        <h3>{group.title}</h3>
      </div>
      <div className={styles.cardFooter}>
        <button
          type="button"
          disabled={busy}
          aria-label={'Remove source ' + (group.firstIndex + 1)}
          onClick={() => onRemovePlaylist(group.sources.map(s => s.id))}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </li>
  );
}

export function MaterialStageView({ workspace, dispatchAction }: MaterialStageViewProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:') {
        setError('Please enter a public HTTPS URL.');
        return;
      }
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const isYouTube = /youtube\.com|youtu\.be/i.test(trimmedUrl);
      let ok = false;
      if (isYouTube) {
        let metadata: {
          title?: string;
          isPlaylist?: boolean;
          videos?: Array<{ videoId: string; title: string }>;
        } | null = null;
        try {
          const metaRes = await fetch(
            `/api/import/youtube/metadata?url=${encodeURIComponent(trimmedUrl)}`
          );
          if (metaRes.ok) {
            metadata = await metaRes.json();
          }
        } catch {
          // Metadata fetch failure is non-fatal
        }

        if (metadata?.isPlaylist && metadata.videos && metadata.videos.length > 0) {
          const maxCapacity = 100;
          const remainingSlots = Math.max(0, maxCapacity - (workspace.sources?.length ?? 0));
          const videosToAdd = metadata.videos.slice(0, remainingSlots);
          if (videosToAdd.length === 0) {
            setError(`Cannot add more sources. Maximum capacity of ${maxCapacity} reached.`);
            setBusy(false);
            return;
          }
          ok = await dispatchAction({
            type: 'add_youtube_sources_batch',
            videos: videosToAdd.map(v => ({
              url: `https://www.youtube.com/watch?v=${v.videoId}`,
              label: v.title || metadata?.title || `Video ${v.videoId}`,
              mode: 'video_observation' as const,
            })),
          });
        } else {
          let normalizedUrl = trimmedUrl;
          try {
            const parsed = new URL(trimmedUrl);
            let vid: string | null = null;
            if (parsed.hostname === 'youtu.be') {
              vid = parsed.pathname.split('/')[1];
            } else if (parsed.pathname === '/watch') {
              vid = parsed.searchParams.get('v');
            } else if (/^\/(shorts|embed)\//.test(parsed.pathname)) {
              vid = parsed.pathname.split('/')[2];
            }
            if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) {
              normalizedUrl = `https://www.youtube.com/watch?v=${vid}`;
            }
          } catch {}

          let extraction = undefined;
          try {
            extraction = await extractYoutubeClient(normalizedUrl, {
              title: metadata?.title,
            });
          } catch {}

          const label = metadata?.title || trimmedUrl;
          ok = await dispatchAction({
            type: 'add_youtube_source',
            url: normalizedUrl,
            label,
            mode: 'video_observation',
            ...(extraction ? { extraction } : {}),
          });
        }
      } else {
        let extraction = undefined;
        try {
          const extracted = await extractWebClient(trimmedUrl);
          extraction = {
            text: extracted.text,
            locations: extracted.locations,
            provenance: extracted.provenance,
            checksum: extracted.checksum,
          };
        } catch {}

        ok = await dispatchAction({
          type: 'add_web_source',
          url: trimmedUrl,
          label: trimmedUrl,
          ...(extraction ? { extraction } : {}),
        });
      }

      if (ok) {
        setUrl('');
      } else {
        setError('Could not add this link. Your input was preserved for retry.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not add link. Your input was preserved for retry.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const act = async (action: CohortAction) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!(await dispatchAction(action))) {
        setError('Could not save this action. Please try again.');
      }
    } catch {
      setError('Could not save this action. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const handleRemovePlaylist = async (sourceIds: string[]) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      for (const sourceId of sourceIds) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId });
        if (!ok) {
          setError('Could not remove playlist. Please try again.');
          break;
        }
      }
    } catch {
      setError('Could not remove playlist. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const displayGroups = groupSourcesForDisplay(workspace.sources);

  return (
    <section className={styles.workspace} aria-label="Learning material">
      <div className={styles.continueSection}>
        <button
          type="button"
          aria-label="Continue to curriculum"
          disabled={busy || !workspace.sources.length}
          onClick={() => void act({ type: 'begin_material_processing' })}
        >
          Next →
        </button>
      </div>
      {workspace.sources.length > 0 && (
        <section aria-label="Added material">
          <h2>
            Added material <small>{displayGroups.length}</small>
          </h2>
          <ul className={styles.sources}>
            {displayGroups.map(group => (
              <SourceGroupCard
                key={group.kind === 'playlist' ? group.batchKey : group.source.id}
                group={group}
                busy={busy}
                onRemoveSingle={sourceId => void act({ type: 'remove_source', sourceId })}
                onRemovePlaylist={sourceIds => void handleRemovePlaylist(sourceIds)}
              />
            ))}
          </ul>
        </section>
      )}
      <header>
        <h1>Add your material</h1>
      </header>
      <form className={styles.inputPanel} onSubmit={handleAddUrl}>
        <label htmlFor="material-url">Public article or YouTube URL</label>
        <div className={styles.inputRow}>
          <input
            id="material-url"
            type="url"
            required
            maxLength={2048}
            pattern="https://.*"
            placeholder="https://…"
            value={url}
            disabled={busy}
            onChange={e => setUrl(e.target.value)}
          />
          <button disabled={busy || !url.trim()}>Add link</button>
        </div>
        <div className={styles.options} aria-label="Material input options">
          <button type="button" aria-pressed="true">
            Paste a link
          </button>
          <button type="button" disabled title="Temporarily unavailable">
            Upload a file
          </button>
        </div>
      </form>
      <p className={styles.help}>Public YouTube videos, playlists and articles. Up to 100 sources.</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
