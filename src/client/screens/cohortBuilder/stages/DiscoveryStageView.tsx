'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import type { YouTubeSearchItem } from '@/src/app/api/import/youtube/search/route';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import { groupSourcesForDisplay, SourceGroupCard } from './MaterialStageView';
import styles from './MaterialStageView.module.css';

export interface DiscoveryStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

const MAX_SOURCES = 100;

export function DiscoveryStageView({ workspace, dispatchAction }: DiscoveryStageViewProps) {
  const [goal, setGoal] = useState(workspace.intent || '');
  const [results, setResults] = useState<YouTubeSearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistVideoUrls, setPlaylistVideoUrls] = useState<Record<string, string[]>>({});
  const autoSearchedIntentRef = useRef<string | null>(null);

  useEffect(() => {
    setGoal(workspace.intent || '');
  }, [workspace.intent]);

  const runYouTubeSearch = async (query: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/import/youtube/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(
          errData?.error || 'Could not search YouTube right now. Please try again.'
        );
        setHasSearched(true);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data?.items) ? data.items : []);
      setHasSearched(true);
    } catch {
      setError('Could not search YouTube right now. Please try again.');
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const initialGoal = (workspace.intent || '').trim();
    if (!initialGoal || autoSearchedIntentRef.current === initialGoal) return;
    autoSearchedIntentRef.current = initialGoal;
    void runYouTubeSearch(initialGoal);
  }, [workspace.intent]);

  const sources = workspace.sources ?? [];
  const atCapacity = sources.length >= MAX_SOURCES;
  const displayGroups = groupSourcesForDisplay(sources);

  const getMatchingSourcesForItem = (item: YouTubeSearchItem) => {
    if (item.kind === 'playlist') {
      const knownUrls = new Set(playlistVideoUrls[item.id] ?? [item.url]);
      return sources.filter(
        (s) => s.input?.kind === 'youtube' && knownUrls.has(s.input.url)
      );
    }
    return sources.filter(
      (s) => s.input?.kind === 'youtube' && s.input.url === item.url
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = goal.trim();
    if (!trimmed) {
      setError('Please enter a learning goal.');
      return;
    }
    if (trimmed !== (workspace.intent || '').trim()) {
      const saved = await dispatchAction({ type: 'set_intent', intent: trimmed });
      if (!saved) {
        setError('Could not save your learning goal. Please try again.');
        return;
      }
    }
    autoSearchedIntentRef.current = trimmed;
    await runYouTubeSearch(trimmed);
  };

  const handleIncludeItem = async (item: YouTubeSearchItem) => {
    if (atCapacity) {
      setError(`Cannot add more sources. Maximum capacity of ${MAX_SOURCES} reached.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (item.kind === 'playlist') {
        const metaRes = await fetch(
          `/api/import/youtube/metadata?url=${encodeURIComponent(item.url)}`
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (
            metaData.isPlaylist &&
            Array.isArray(metaData.videos) &&
            metaData.videos.length > 0
          ) {
            const remaining = Math.max(0, MAX_SOURCES - sources.length);
            const slice = metaData.videos.slice(0, remaining);
            const videosPayload = slice.map((v: any) => ({
              url: v.url
                ? String(v.url)
                : `https://www.youtube.com/watch?v=${v.videoId}`,
              label: String(v.title || item.title),
              mode: 'video_observation' as const,
            }));
            const ok = await dispatchAction({
              type: 'add_youtube_sources_batch',
              videos: videosPayload,
            });
            if (ok) {
              setPlaylistVideoUrls((prev) => ({
                ...prev,
                [item.id]: videosPayload.map((v: { url: string }) => v.url),
              }));
            } else {
              setError('Could not include playlist. Please try again.');
            }
            return;
          }
        }
      }

      let extraction = undefined;
      try {
        extraction = await extractYoutubeClient(item.url, { title: item.title });
      } catch {
        // Proceed with server fallback if client extraction fails
      }

      const ok = await dispatchAction({
        type: 'add_youtube_source',
        url: item.url,
        label: item.title,
        mode: 'video_observation',
        ...(extraction ? { extraction } : {}),
      });
      if (!ok) {
        setError('Could not include video. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExcludeItem = async (item: YouTubeSearchItem) => {
    const matched = getMatchingSourcesForItem(item);
    if (matched.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const src of matched) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId: src.id });
        if (!ok) {
          setError('Could not exclude source. Please try again.');
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: CohortAction) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await dispatchAction(action))) {
        setError('Could not save this action. Please try again.');
      }
    } catch {
      setError('Could not save this action. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePlaylist = async (sourceIds: string[]) => {
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
      setBusy(false);
    }
  };

  return (
    <section className={styles.workspace} aria-label="Goal discovery">
      <div className={styles.continueSection}>
        <button
          type="button"
          aria-label="Continue to curriculum"
          disabled={busy || searching || !sources.length}
          onClick={() => void act({ type: 'begin_material_processing' })}
        >
          Next →
        </button>
      </div>

      {sources.length > 0 && (
        <section aria-label="Added material">
          <h2>
            Added material <small>{displayGroups.length}</small>
          </h2>
          <ul className={styles.sources}>
            {displayGroups.map((group) => (
              <SourceGroupCard
                key={group.kind === 'playlist' ? group.batchKey : group.source.id}
                group={group}
                busy={busy}
                onRemoveSingle={(sourceId) => void act({ type: 'remove_source', sourceId })}
                onRemovePlaylist={(sourceIds) => void handleRemovePlaylist(sourceIds)}
              />
            ))}
          </ul>
        </section>
      )}

      <header>
        <h1>Start with a goal</h1>
        <p className={styles.help}>
          Search YouTube videos and playlists for your goal, include (+) or exclude (−) them in your material, then continue to your curriculum.
        </p>
      </header>

      <form className={styles.inputPanel} onSubmit={handleSearch}>
        <label htmlFor="discovery-goal-input">Your learning goal</label>
        <div className={styles.inputRow}>
          <input
            id="discovery-goal-input"
            type="text"
            value={goal}
            disabled={busy || searching}
            placeholder="What do you want to learn?"
            onChange={(e) => setGoal(e.target.value)}
          />
          <button type="submit" disabled={busy || searching || !goal.trim()}>
            {searching ? 'Searching…' : 'Find resources'}
          </button>
        </div>
      </form>

      {error && <p role="alert">{error}</p>}

      {results.length > 0 && (
        <section aria-label="YouTube search results">
          <h2>
            YouTube videos & playlists <small>{results.length}</small>
          </h2>
          <ul className={styles.sources}>
            {results.map((item) => {
              const matchedSources = getMatchingSourcesForItem(item);
              const isIncluded = matchedSources.length > 0;
              const isPlaylist = item.kind === 'playlist';

              return (
                <li
                  key={item.id}
                  className={`${styles.sourceItem} ${isPlaylist ? styles.playlistCard : ''}`}
                >
                  <div className={styles.thumbWrap}>
                    {item.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        className={styles.thumbnail}
                        src={item.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className={styles.fileIcon} aria-hidden="true">
                        ▶
                      </span>
                    )}
                    <span
                      className={`${styles.typeBadge} ${isPlaylist ? styles.playlistBadge : ''}`}
                    >
                      {isPlaylist ? '▶ PLAYLIST' : 'VIDEO'}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <small>
                      {isPlaylist ? 'YouTube Playlist' : 'YouTube Video'} · {item.channelTitle}
                    </small>
                    <h3>{item.title}</h3>
                  </div>
                  <div className={styles.cardFooter}>
                    {isIncluded ? (
                      <button
                        type="button"
                        className={styles.excludeBtn}
                        disabled={busy}
                        aria-label={`Exclude ${item.title}`}
                        title="Exclude from material"
                        onClick={() => void handleExcludeItem(item)}
                      >
                        −
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.includeBtn}
                        disabled={busy || atCapacity}
                        aria-label={`Include ${item.title}`}
                        title="Include in material"
                        onClick={() => void handleIncludeItem(item)}
                      >
                        +
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hasSearched && !searching && results.length === 0 && !error && (
        <p className={styles.help}>
          No YouTube videos or playlists found. Try refining your learning goal above.
        </p>
      )}
    </section>
  );
}
