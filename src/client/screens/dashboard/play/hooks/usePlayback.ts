'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { PlayerTool, TimelineMarker } from '../types/play';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { resolveMediaSource } from '../utils/mediaSource';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

type ChannelCache = {
  items: FeedItem[];
  servedChunkIds: string[];
  isFetching: boolean;
  currentIndex: number;
  hasError: boolean;
  exhausted?: boolean;
  prefs?: string;
  query?: string;
  stale?: boolean;
  updatedAt?: number;
};

const INITIAL_CACHES: Record<ChannelId, ChannelCache> = {
  default: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  spark: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  explore: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  build: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  listen: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  deep_dive: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  quick: { items: [], servedChunkIds: [], isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
};

const FEED_CACHE_STORAGE_PREFIX = 'sidequest_feed_cache_v2:';
const FEED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h persistent cache with background revalidation
const FEED_CACHE_FRESH_TTL_MS = 45_000; // 45s fresh TTL before silent background revalidation

let persistedCachesBySelection: { key: string; caches: Record<ChannelId, ChannelCache> } | null = null;

function loadStoredChannelCaches(selectionKey: string): Record<ChannelId, ChannelCache> | null {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return null;
  try {
    const raw = localStorage.getItem(`${FEED_CACHE_STORAGE_PREFIX}${selectionKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: number; caches?: Partial<Record<ChannelId, ChannelCache>> };
    if (!parsed || typeof parsed !== 'object' || !parsed.caches) return null;
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > FEED_CACHE_MAX_AGE_MS) {
      return null;
    }
    const hydrated = {} as Record<ChannelId, ChannelCache>;
    let hasAnyItems = false;
    for (const k of Object.keys(INITIAL_CACHES) as ChannelId[]) {
      const entry = parsed.caches[k];
      if (entry && Array.isArray(entry.items) && entry.items.length > 0) {
        hasAnyItems = true;
        hydrated[k] = {
          items: entry.items,
          servedChunkIds: entry.items.map((it: FeedItem) => it.chunkId).filter(Boolean),
          isFetching: false,
          currentIndex:
            typeof entry.currentIndex === 'number' && entry.currentIndex >= 0 && entry.currentIndex < entry.items.length
              ? entry.currentIndex
              : 0,
          hasError: false,
          exhausted: false,
          prefs: entry.prefs,
          query: entry.query,
          stale: true,
          updatedAt: entry.updatedAt || parsed.updatedAt || 0,
        };
      } else {
        hydrated[k] = { ...INITIAL_CACHES[k] };
      }
    }
    return hasAnyItems ? hydrated : null;
  } catch {
    return null;
  }
}

function pruneStoredChannelCaches(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  try {
    const keys: { key: string; updatedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FEED_CACHE_STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          const parsed = raw ? JSON.parse(raw) : null;
          keys.push({ key: k, updatedAt: parsed?.updatedAt || 0 });
        } catch {
          keys.push({ key: k, updatedAt: 0 });
        }
      }
    }
    if (keys.length > 10) {
      keys.sort((a, b) => a.updatedAt - b.updatedAt);
      const toRemove = keys.slice(0, keys.length - 10);
      for (const item of toRemove) {
        localStorage.removeItem(item.key);
      }
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

function saveStoredChannelCaches(selectionKey: string, caches: Record<ChannelId, ChannelCache>): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  try {
    const compact = {} as Partial<Record<ChannelId, Partial<ChannelCache>>>;
    let hasItems = false;
    for (const k of Object.keys(INITIAL_CACHES) as ChannelId[]) {
      const ch = caches[k];
      if (ch && Array.isArray(ch.items) && ch.items.length > 0) {
        hasItems = true;
        compact[k] = {
          items: ch.items.slice(0, 15),
          currentIndex: Math.min(ch.currentIndex, Math.max(0, Math.min(ch.items.length, 15) - 1)),
          prefs: ch.prefs,
          query: ch.query,
          updatedAt: ch.updatedAt || Date.now(),
        };
      }
    }
    if (!hasItems) return;
    localStorage.setItem(
      `${FEED_CACHE_STORAGE_PREFIX}${selectionKey}`,
      JSON.stringify({ updatedAt: Date.now(), caches: compact }),
    );
    pruneStoredChannelCaches();
  } catch {
    // Ignore storage quota errors
  }
}

export async function prefetchDefaultFeed(userId?: string | null): Promise<void> {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  const selectionKey = `${userId || 'anon'}:||`;
  const config = homeStorageAdapter.getStoredChannelConfig(userId);
  const storedChannel = config.activeChannel || 'default';
  const channel: ChannelId = INITIAL_CACHES[storedChannel] ? storedChannel : 'default';

  if (persistedCachesBySelection?.key === selectionKey) {
    const existing = persistedCachesBySelection.caches[channel];
    if (existing && existing.items.length > 0 && existing.updatedAt && Date.now() - existing.updatedAt < FEED_CACHE_FRESH_TTL_MS) {
      return;
    }
  }

  try {
    const parsedPrefs = config.prefs;
    const rawPrefs = JSON.stringify(parsedPrefs);

    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        limit: 5,
        excludeChunkIds: [],
        prefs: parsedPrefs,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const items: FeedItem[] = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) return;

    const baseCaches =
      (persistedCachesBySelection?.key === selectionKey ? persistedCachesBySelection.caches : null) ||
      loadStoredChannelCaches(selectionKey) ||
      { ...INITIAL_CACHES };

    const nextCaches: Record<ChannelId, ChannelCache> = {
      ...baseCaches,
      [channel]: {
        items,
        servedChunkIds: items.map((it: FeedItem) => it.chunkId).filter(Boolean),
        currentIndex: 0,
        isFetching: false,
        hasError: false,
        exhausted: !data.hasMore,
        prefs: rawPrefs,
        query: '',
        stale: false,
        updatedAt: Date.now(),
      },
    };
    persistedCachesBySelection = { key: selectionKey, caches: nextCaches };
    saveStoredChannelCaches(selectionKey, nextCaches);
  } catch {
    // Silent background warm-up failure
  }
}

function parseDurationToSeconds(val: string): number {
  if (!val || typeof val !== 'string') return 180;
  const parsed = Number(val);
  return isNaN(parsed) || parsed < 0 ? 180 : parsed;
}

function formatSecs(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
  const safe = Math.floor(seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function usePlayback() {
  const { data: session } = useSafeSession();
  const userId = session?.user?.id ?? null;
  const searchParams = useSearchParams();
  const requestedCohortId = searchParams.get('cohort') || undefined;
  const requestedLessonId = searchParams.get('lessonId') || searchParams.get('lesson') || undefined;
  const requestedChunkId = searchParams.get('chunk') || undefined;
  const initialQuery = searchParams.get('q') || '';
  const selectionCacheKey = `${userId || 'anon'}:${requestedCohortId ?? ''}|${requestedLessonId ?? ''}|${requestedChunkId ?? ''}`;

  // Client Memory + Persistent LocalStorage Cache architecture preserved across SPA route switches & reloads
  const [channelCaches, setChannelCachesState] = useState<Record<ChannelId, ChannelCache>>(() => {
    if (
      process.env.NODE_ENV !== 'test' &&
      persistedCachesBySelection &&
      persistedCachesBySelection.key === selectionCacheKey
    ) {
      const sanitized = {} as Record<ChannelId, ChannelCache>;
      for (const k of Object.keys(INITIAL_CACHES) as ChannelId[]) {
        const cached = persistedCachesBySelection.caches[k] || INITIAL_CACHES[k];
        const isAged = Boolean(cached.updatedAt && Date.now() - cached.updatedAt > FEED_CACHE_FRESH_TTL_MS);
        sanitized[k] = {
          ...cached,
          isFetching: false,
          stale: cached.stale || isAged,
        };
      }
      return sanitized;
    }
    const stored = loadStoredChannelCaches(selectionCacheKey);
    if (stored) {
      persistedCachesBySelection = { key: selectionCacheKey, caches: stored };
      return stored;
    }
    return INITIAL_CACHES;
  });

  useEffect(() => {
    const stored = loadStoredChannelCaches(selectionCacheKey);
    if (stored) {
      persistedCachesBySelection = { key: selectionCacheKey, caches: stored };
      setChannelCachesState(stored);
    } else if (persistedCachesBySelection && persistedCachesBySelection.key === selectionCacheKey) {
      setChannelCachesState(persistedCachesBySelection.caches);
    }
  }, [selectionCacheKey]);

  const setChannelCaches = useCallback(
    (updater: React.SetStateAction<Record<ChannelId, ChannelCache>>) => {
      setChannelCachesState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;
        if (process.env.NODE_ENV !== 'test') {
          persistedCachesBySelection = { key: selectionCacheKey, caches: next };
          saveStoredChannelCaches(selectionCacheKey, next);
        }
        return next;
      });
    },
    [selectionCacheKey]
  );
  const [searchQuery, setSearchQueryState] = useState<string>(initialQuery);
  
  // 6. Wasted Fetch on Initial Load - Lazy init for activeChannel from canonical store
  const [activeChannel, setActiveChannelState] = useState<ChannelId>(() => {
    if (typeof window !== 'undefined') {
      const stored = homeStorageAdapter.getSelectedChannel(userId);
      return stored && INITIAL_CACHES[stored] ? stored : 'default';
    }
    return 'default';
  });

  const isMountedRef = useRef(true);
  const controllersRef = useRef<Partial<Record<ChannelId, AbortController | null>>>({});
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const completing = useRef(false);

  const setActiveChannel = useCallback((ch: ChannelId) => {
    setActiveChannelState(prevCh => {
      if (prevCh !== ch && controllersRef.current[prevCh]) {
        controllersRef.current[prevCh]?.abort();
      }
      return ch;
    });
    setCompletionError(null);
    homeStorageAdapter.saveSelectedChannel(ch, userId);
  }, [userId]);
  
  const currentCache = channelCaches[activeChannel];
  const feedItems = currentCache.items;
  
  // 1. Global currentIndex Breaks Channel Switching - using cache state
  const currentIndex = currentCache.currentIndex;

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(90);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [chunkDurationSeconds, setChunkDurationSeconds] = useState(180);
  const [bookmarked, setBookmarkedState] = useState(false);
  const [activeTool, setActiveTool] = useState<PlayerTool | null>('scribe');
  const [notesText, setNotesText] = useState('');
  const [ytApiReady, setYtApiReady] = useState(false);
  const [ytApiError, setYtApiError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [dailyGoalPercent, setDailyGoalPercent] = useState(0);
  const [stats, setStats] = useState({ cohortsCovered: 0, chunksRemaining: 0, estimatedMinutes: 0 });

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<any>(null);
  const videoCleanupRef = useRef<(() => void) | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const activeChannelRef = useRef(activeChannel);
  const searchQueryRef = useRef(searchQuery);
  
  // 3. Duplicate Progress Reporting - Set to track reported chunks
  const reportedChunksRef = useRef<Set<string>>(new Set());
  const lastAudibleVolumeRef = useRef<number>(90);
  
  isPlayingRef.current = isPlaying;
  activeChannelRef.current = activeChannel;
  searchQueryRef.current = searchQuery;

  const activeItem = feedItems[currentIndex] || null;
  const activeChunkId = activeItem?.chunkId;
  const activeMediaSource = resolveMediaSource(activeItem);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeItemRef = useRef(activeItem);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const playbackSpeedRef = useRef(playbackSpeed);
  activeItemRef.current = activeItem;
  volumeRef.current = volume;
  mutedRef.current = muted;
  playbackSpeedRef.current = playbackSpeed;

  // Fetch feed items via API (Prefetch Engine with bounded exclusion continuation)
  const fetchChannelFeed = useCallback(
    async (
      channelId: ChannelId,
      continuationOrPage: boolean | number = false,
      overrideQuery?: string
    ) => {
      const isContinuation =
        typeof continuationOrPage === 'boolean'
          ? continuationOrPage
          : continuationOrPage > 0;

      const currentCache = channelCaches[channelId];
      if (isContinuation && currentCache?.exhausted) {
        return;
      }

      const prevController = controllersRef.current[channelId];
      if (prevController) {
        prevController.abort();
      }
      const abortController = new AbortController();
      controllersRef.current[channelId] = abortController;

      setChannelCaches((prev) => {
        const cur = prev[channelId];
        if (!cur || (cur.isFetching && isContinuation)) return prev;
        return {
          ...prev,
          [channelId]: {
            ...cur,
            isFetching: true,
            ...(!isContinuation ? { hasError: false } : {}),
          },
        };
      });

      try {
        const channelConfig = homeStorageAdapter.getStoredChannelConfig(userId);
        const parsedPrefs = channelConfig.prefs;
        const rawPrefs = JSON.stringify(parsedPrefs);

        const qVal = overrideQuery !== undefined ? overrideQuery : searchQueryRef.current;
        const currentServed = isContinuation && currentCache?.servedChunkIds ? currentCache.servedChunkIds : [];

        // shortcut: move to durable server-side session continuation cursor if a user session exceeds 5000 chunks without reload
        if (currentServed.length >= 5000) {
          setChannelCaches((prev) => ({
            ...prev,
            [channelId]: {
              ...prev[channelId],
              isFetching: false,
              exhausted: true,
            },
          }));
          return;
        }

        const payload = {
          channel: channelId,
          limit: 5,
          excludeChunkIds: isContinuation ? currentServed.slice(0, 5000) : [],
          ...(requestedCohortId ? { cohort: requestedCohortId } : {}),
          ...(requestedLessonId ? { lesson: requestedLessonId } : {}),
          ...(requestedChunkId ? { chunk: requestedChunkId } : {}),
          ...(qVal?.trim() ? { q: qVal.trim() } : {}),
          ...(parsedPrefs ? { prefs: parsedPrefs } : {}),
          timezoneOffset: new Date().getTimezoneOffset(),
        };

        const res = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        if (!res.ok) throw new Error('Failed to fetch feed');
        if (abortController.signal.aborted || !isMountedRef.current) return;
        if (controllersRef.current[channelId] !== abortController) return;
        const data = await res.json();
        if (abortController.signal.aborted || !isMountedRef.current) return;
        if (controllersRef.current[channelId] !== abortController) return;

        controllersRef.current[channelId] = null;
        const incomingItems: FeedItem[] = Array.isArray(data?.items) ? data.items : [];
        const incomingIds = incomingItems.map((it) => it.chunkId).filter(Boolean);

        setChannelCaches((prev) => {
          const cur = prev[channelId];
          const existingItems = !isContinuation ? [] : cur.items;
          const existingIds = new Set(existingItems.map((it) => it.chunkId).filter(Boolean));
          const uniqueNewItems = !isContinuation
            ? incomingItems
            : incomingItems.filter((it) => !it.chunkId || !existingIds.has(it.chunkId));
          const allItems = !isContinuation ? incomingItems : [...existingItems, ...uniqueNewItems];

          const combinedServedSet = new Set(!isContinuation ? [] : (cur.servedChunkIds || []));
          for (const id of incomingIds) {
            combinedServedSet.add(id);
          }
          const nextServed = Array.from(combinedServedSet);

          const isExhausted =
            data?.hasMore === false ||
            incomingItems.length === 0 ||
            (isContinuation && uniqueNewItems.length === 0);

          let nextIndex = cur.currentIndex;
          if (!isContinuation) {
            if ((requestedLessonId || requestedChunkId) && allItems.length > 0) {
              const matched = allItems.findIndex(
                (item) =>
                  (requestedChunkId && item.chunkId === requestedChunkId) ||
                  (requestedLessonId &&
                    (item.lessonId === requestedLessonId ||
                      (item.lessonOrder !== undefined &&
                        (String(item.lessonOrder) === requestedLessonId ||
                          String(item.lessonOrder + 1) === requestedLessonId))))
              );
              nextIndex = matched !== -1 ? matched : 0;
            } else {
              const prevActiveChunkId = cur.items[cur.currentIndex]?.chunkId;
              if (prevActiveChunkId && allItems.length > 0) {
                const preserved = allItems.findIndex((item) => item.chunkId === prevActiveChunkId);
                nextIndex = preserved !== -1 ? preserved : 0;
              } else {
                nextIndex = 0;
              }
            }
          }

          return {
            ...prev,
            [channelId]: {
              ...cur,
              items: allItems,
              servedChunkIds: nextServed,
              currentIndex: nextIndex,
              isFetching: false,
              hasError: false,
              exhausted: isExhausted,
              prefs: rawPrefs,
              query: qVal,
              stale: false,
              updatedAt: Date.now(),
            },
          };
        });
      } catch (error: any) {
        if (!isMountedRef.current) return;
        if (controllersRef.current[channelId] !== abortController) {
          return;
        }
        controllersRef.current[channelId] = null;

        if (error.name === 'AbortError' || abortController.signal.aborted) {
          setChannelCaches((prev) => {
            const cur = prev[channelId];
            if (!cur || !cur.isFetching) return prev;
            return {
              ...prev,
              [channelId]: { ...cur, isFetching: false },
            };
          });
          return;
        }
        console.error('Prefetch error:', error);
        setChannelCaches((prev) => {
          const cur = prev[channelId];
          if (!cur || (!cur.isFetching && cur.hasError)) return prev;
          return {
            ...prev,
            [channelId]: { ...cur, isFetching: false, hasError: true },
          };
        });
      }
    },
    [requestedCohortId, requestedLessonId, requestedChunkId, setChannelCaches, channelCaches]
  );

  const completeActiveChunk = useCallback(async () => {
    if (!activeItem || completing.current) return false;
    completing.current = true;
    setCompletionPending(true);
    setCompletionError(null);

    const targetItem = activeItem;
    const targetChunkId = targetItem.chunkId;
    const targetChannel = activeChannel;
    const start = Number.isFinite(targetItem.startSeconds) ? targetItem.startSeconds : 0;
    const end = Number.isFinite(targetItem.endSeconds) ? targetItem.endSeconds : (start + parseDurationToSeconds(targetItem.chunkDuration));
    const duration = Math.max(1, Math.round(end - start) || 180);

    // 1. Optimistic transition: mark reported and advance queue immediately (<16ms)
    reportedChunksRef.current.add(targetChunkId);

    let autoAdvancedChunkId: string | null = null;
    const currentChannelCache = channelCaches[targetChannel];
    const rollbackSnapshot = currentChannelCache
      ? { items: [...currentChannelCache.items], currentIndex: currentChannelCache.currentIndex }
      : null;

    setChannelCaches(previous => {
      const ch = previous[targetChannel];
      if (!ch) return previous;

      const itemIndex = ch.items.findIndex(it => it.chunkId === targetChunkId);
      const nextItems = ch.items.filter(item => item.chunkId !== targetChunkId);

      const nextIndex =
        itemIndex === -1
          ? Math.min(ch.currentIndex, Math.max(0, nextItems.length - 1))
          : itemIndex >= nextItems.length
          ? Math.max(0, nextItems.length - 1)
          : Math.max(0, itemIndex);

      autoAdvancedChunkId = nextItems[nextIndex]?.chunkId ?? null;

      return {
        ...previous,
        [targetChannel]: {
          ...ch,
          currentIndex: nextIndex,
          items: nextItems,
        }
      };
    });

    // 2. Background sync
    try {
      const response = await fetch('/api/progress/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId: targetChunkId,
          lessonId: targetItem.lessonId,
          cohortId: targetItem.cohortId,
          watchedSeconds: duration,
          totalSeconds: duration,
          forceStatus: 'COMPLETED',
        }),
      });

      if (response.status === 401) {
        throw new Error('Sign in to save completion.');
      }

      let saved: any;
      try {
        saved = await response.json();
      } catch {
        throw new Error('Completion could not be saved. Retry.');
      }

      if (
        !response.ok ||
        saved?.success !== true ||
        saved?.progress?.chunkId !== targetChunkId ||
        saved?.progress?.status !== 'COMPLETED'
      ) {
        throw new Error('Completion could not be saved. Retry.');
      }

      // Durably acknowledged: clear channel exhaustion and request continuation if remaining queue < 3
      let shouldContinue = false;
      setChannelCaches(prev => {
        const ch = prev[targetChannel];
        if (!ch) return prev;
        if (ch.items.length < 3 && !ch.isFetching && !ch.hasError) {
          shouldContinue = true;
        }
        return {
          ...prev,
          [targetChannel]: {
            ...ch,
            exhausted: false,
          }
        };
      });

      if (shouldContinue) {
        void fetchChannelFeed(targetChannel, true);
      }

      return true;
    } catch (error) {
      // 3. Rollback on failure
      reportedChunksRef.current.delete(targetChunkId);
      if (rollbackSnapshot) {
        const snap = rollbackSnapshot;
        setChannelCaches(previous => {
          const ch = previous[targetChannel];
          if (!ch) return previous;
          const currentItem = ch.items[ch.currentIndex];
          const currentChunkId = currentItem?.chunkId;

          const restoredItems = [...snap.items];
          let restoredIndex = snap.currentIndex;
          if (currentChunkId && currentChunkId !== targetChunkId && currentChunkId !== autoAdvancedChunkId) {
            const preservedIdx = restoredItems.findIndex(it => it.chunkId === currentChunkId);
            if (preservedIdx !== -1) restoredIndex = preservedIdx;
          }

          return {
            ...previous,
            [targetChannel]: {
              ...ch,
              currentIndex: restoredIndex,
              items: restoredItems,
            }
          };
        });
      }
      setCompletionError(error instanceof Error ? error.message : 'Completion could not be saved.');
      return false;
    } finally {
      completing.current = false;
      setCompletionPending(false);
    }
  }, [activeItem, activeChannel, fetchChannelFeed, setChannelCaches]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Object.values(controllersRef.current).forEach(ctrl => {
        try { ctrl?.abort(); } catch {}
      });
      controllersRef.current = {};
    };
  }, []);

  const activeCache = channelCaches[activeChannel];
  const activeItemsCount = activeCache?.items.length ?? 0;
  const activePrefs = activeCache?.prefs;
  const activeIsFetching = activeCache?.isFetching ?? false;
  const activeHasError = activeCache?.hasError ?? false;
  const activeIsExhausted = activeCache?.exhausted ?? false;
  const activeIsStale = activeCache?.stale ?? false;

  // Initial Load & Channel Switch Logic (with stale-while-revalidate background refresh)
  useEffect(() => {
    const config = homeStorageAdapter.getStoredChannelConfig(userId);
    const currentPrefs = JSON.stringify(config.prefs);
    const isCacheStale = activeIsStale || (activePrefs !== undefined && activePrefs !== currentPrefs);
    
    if (((activeItemsCount === 0 && activePrefs === undefined) || isCacheStale) && !activeIsFetching && !activeHasError) {
      void fetchChannelFeed(activeChannel, 0);
    }
  }, [activeChannel, activeItemsCount, activePrefs, activeIsFetching, activeHasError, activeIsStale, fetchChannelFeed, userId]);

  // Synchronize playback position with requested URL params (?lessonId=, ?lesson=, ?chunk=)
  useEffect(() => {
    if (!requestedLessonId && !requestedChunkId) return;
    const items = channelCaches[activeChannel].items;
    if (!items.length) return;

    const matchedIndex = items.findIndex(item =>
      (requestedChunkId && item.chunkId === requestedChunkId) ||
      (requestedLessonId && (
        item.lessonId === requestedLessonId ||
        (item.lessonOrder !== undefined && (
          String(item.lessonOrder) === requestedLessonId ||
          String(item.lessonOrder + 1) === requestedLessonId
        ))
      ))
    );

    if (matchedIndex !== -1 && matchedIndex !== channelCaches[activeChannel].currentIndex) {
      setChannelCaches(prev => {
        const cur = prev[activeChannel];
        if (!cur || cur.currentIndex === matchedIndex) return prev;
        return {
          ...prev,
          [activeChannel]: {
            ...cur,
            currentIndex: matchedIndex
          }
        };
      });
    }
  }, [requestedLessonId, requestedChunkId, activeChannel, feedItems, setChannelCaches]);

  // 80% Threshold Prefetch Logic
  useEffect(() => {
    if (!activeChunkId && feedItems.length === 0) return;
    
    // If we are near the end of loaded items, prefetch continuation once.
    if (
      currentIndex >= feedItems.length - 2 && 
      !activeIsFetching &&
      !activeIsExhausted &&
      !activeHasError &&
      feedItems.length > 0
    ) {
      void fetchChannelFeed(activeChannel, true);
    }
  }, [currentIndex, feedItems.length, activeChannel, activeIsFetching, activeIsExhausted, activeHasError, fetchChannelFeed, activeChunkId]);

  // Dynamic Player Stats & Daily Goal Calculation
  useEffect(() => {
    const items = currentCache.items;
    if (!items.length) {
      setStats(prev => (
        prev.cohortsCovered === 0 && prev.chunksRemaining === 0 && prev.estimatedMinutes === 0
          ? prev
          : { cohortsCovered: 0, chunksRemaining: 0, estimatedMinutes: 0 }
      ));
      setDailyGoalPercent(prev => (prev === 0 ? prev : 0));
      return;
    }

    const distinctCohorts = new Set(items.map(it => it.cohortId).filter(Boolean)).size;
    const remaining = Math.max(0, items.length - currentIndex);
    const remainingSeconds = items.slice(currentIndex).reduce((acc, it) => {
      const dur = (it.endSeconds !== undefined && it.startSeconds !== undefined && it.endSeconds > it.startSeconds)
        ? (it.endSeconds - it.startSeconds)
        : (it.chunkDuration ? parseDurationToSeconds(it.chunkDuration) : 180);
      return acc + dur;
    }, 0);

    const completedTodayCount = reportedChunksRef.current.size;
    const targetGoalMinutes = 20; // 20 mins standard daily goal
    const completedMinutes = Math.round(completedTodayCount * 3); // ~3 mins per chunk
    const calculatedGoalPercent = Math.min(100, Math.round((completedMinutes / targetGoalMinutes) * 100));
    const nextEstimatedMinutes = Math.ceil(remainingSeconds / 60);

    setDailyGoalPercent(prev => (prev === calculatedGoalPercent ? prev : calculatedGoalPercent));
    setStats(prev => (
      prev.cohortsCovered === distinctCohorts &&
      prev.chunksRemaining === remaining &&
      prev.estimatedMinutes === nextEstimatedMinutes
        ? prev
        : {
            cohortsCovered: distinctCohorts,
            chunksRemaining: remaining,
            estimatedMinutes: nextEstimatedMinutes,
          }
    ));
  }, [currentCache.items, currentIndex]);

  // Handle YouTube IFrame API Load
  useEffect(() => {
    if (typeof window === 'undefined' || !activeMediaSource.isYouTube) return;

    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      setYtApiError(null);
      return;
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      setYtApiReady(true);
      setYtApiError(null);
    };

    let tag = document.querySelector('script[src*="youtube.com/iframe_api"]') as HTMLScriptElement | null;
    if (!tag) {
      tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        console.warn('YouTube IFrame API failed to load (adblocker or network error)');
        setYtApiReady(false);
        setYtApiError('YouTube player unavailable (blocked by adblocker or network).');
      };
      document.head.appendChild(tag);
    } else {
      tag.addEventListener('error', () => {
        console.warn('YouTube IFrame API failed to load (adblocker or network error)');
        setYtApiReady(false);
        setYtApiError('YouTube player unavailable (blocked by adblocker or network).');
      });
    }
  }, [activeMediaSource.isYouTube]);

  // Sync state when active item changes
  useEffect(() => {
    const curItem = activeItemRef.current;
    if (!curItem) {
      setNotesText(prev => (prev === '' ? prev : ''));
      setBookmarkedState(prev => (prev === false ? prev : false));
      setMediaError(prev => (prev === null ? prev : null));
      setCompletionError(null);
      return;
    }
    const dur = curItem.endSeconds - curItem.startSeconds || parseDurationToSeconds(curItem.chunkDuration);
    setChunkDurationSeconds(prev => (prev === dur ? prev : dur));
    setCurrentTimeSeconds(prev => (prev === 0 ? prev : 0));
    setMediaError(prev => (prev === null ? prev : null));
    setCompletionError(null);

    if (activeMediaSource.isDirectVideo && videoRef.current) {
      if (curItem.startSeconds && curItem.startSeconds > 0) {
        try { videoRef.current.currentTime = curItem.startSeconds; } catch {}
      } else {
        try { videoRef.current.currentTime = 0; } catch {}
      }
      try { videoRef.current.playbackRate = playbackSpeed; } catch {}
    }

    if (typeof window !== 'undefined' && activeChunkId) {
      const savedNote = localStorage.getItem(`sidequest_note_${activeChunkId}`);
      const nextNote = savedNote !== null ? savedNote : '';
      setNotesText(prev => (prev === nextNote ? prev : nextNote));

      const savedBookmark = localStorage.getItem(`sidequest_bookmark_${activeChunkId}`) === 'true';
      setBookmarkedState(prev => (prev === savedBookmark ? prev : savedBookmark));
    } else {
      setNotesText(prev => (prev === '' ? prev : ''));
      setBookmarkedState(prev => (prev === false ? prev : false));
    }
  }, [activeChunkId, activeMediaSource.isDirectVideo, playbackSpeed]);

  // Handle YouTube player creation & video switching
  const isPlayerReadyRef = useRef(false);

  useEffect(() => {
    if (!activeMediaSource.isYouTube || !activeMediaSource.videoId) {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; }
      isPlayerReadyRef.current = false;
      return;
    }

    // Stop and pause any direct video instance when playing YouTube
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current = null;
    }

    if (!ytApiReady || !playerContainerRef.current || !activeItem) return;
    const container = playerContainerRef.current;
    const videoId = activeMediaSource.videoId;
    const startSecs = activeItem.startSeconds || 0;
    const endSecs = activeItem.endSeconds || startSecs + 180;
    const hasMount = container.querySelector('#yt-player-mount');

    // If player already exists in this container and is ready, just swap the video in-place
    if (playerRef.current && hasMount && isPlayerReadyRef.current) {
      try {
        playerRef.current.loadVideoById({ videoId, startSeconds: startSecs, endSeconds: endSecs });
        playerRef.current.setPlaybackRate(playbackSpeed);
        playerRef.current.playVideo();
        setIsPlaying(true);
        return;
      } catch (err) {
        console.warn('loadVideoById failed, recreating player in container', err);
      }
    }

    // Destroy any old player attached to a previous/unmounted slide container
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    }

    isPlayerReadyRef.current = false;
    setIsPlayerReady(false);

    try {
      container.innerHTML = '';
      const origin = window.location.origin.startsWith('http') ? window.location.origin : '';
      const params = new URLSearchParams({
        enablejsapi: '1',
        autoplay: '1',
        controls: '0',
        rel: '0',
        modestbranding: '1',
        fs: '0',
        iv_load_policy: '3',
        playsinline: '1',
        disablekb: '1',
        cc_load_policy: '0',
        start: String(startSecs),
        end: String(endSecs),
      });
      if (origin) params.set('origin', origin);

      const iframe = document.createElement('iframe');
      iframe.id = 'yt-player-mount';
      iframe.src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;';
      container.appendChild(iframe);

      playerRef.current = new window.YT.Player(iframe, {
        events: {
          onReady: (evt: any) => {
            isPlayerReadyRef.current = true;
            setIsPlayerReady(true);
            evt.target.setVolume(volumeRef.current);
            evt.target.setPlaybackRate(playbackSpeedRef.current);
            evt.target.seekTo(startSecs, true);
            evt.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (evt: any) => {
            if (evt.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            else if (evt.data === window.YT.PlayerState.PAUSED || evt.data === window.YT.PlayerState.ENDED) setIsPlaying(false);
          },
          onError: (evt: any) => {
            console.warn('YouTube Player error event:', evt.data);
            setIsPlaying(false);
            setYtApiError(`YouTube video unavailable (code ${evt.data}).`);
          },
        },
      });
    } catch (err) {
      console.error('Failed to mount YouTube player', err);
    }

    return () => {
      // If component is unmounting (or StrictMode simulated unmount), destroy player
      // so the subsequent StrictMode remount effect re-initializes cleanly.
      isPlayerReadyRef.current = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [ytApiReady, activeItem?.chunkId, currentIndex]);

  // Cleanup video listeners on component unmount
  useEffect(() => {
    return () => {
      if (videoCleanupRef.current) {
        videoCleanupRef.current();
        videoCleanupRef.current = null;
      }
    };
  }, []);

  const registerVideoElement = useCallback((node: HTMLVideoElement | null) => {
    if (videoCleanupRef.current) {
      videoCleanupRef.current();
      videoCleanupRef.current = null;
    }
    videoRef.current = node;
    const curItem = activeItemRef.current;
    if (node && curItem) {
      // Ensure any lingering YouTube playback is silenced immediately
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch {}
      }

      node.volume = volumeRef.current / 100;
      node.muted = mutedRef.current;
      node.playbackRate = playbackSpeedRef.current;
      if (curItem.startSeconds && curItem.startSeconds > 0) {
        try { node.currentTime = curItem.startSeconds; } catch {}
      }
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleError = () => {
        setIsPlaying(false);
        setMediaError('Video playback failed to load.');
      };
      node.addEventListener('play', handlePlay);
      node.addEventListener('pause', handlePause);
      node.addEventListener('error', handleError);
      videoCleanupRef.current = () => {
        node.removeEventListener('play', handlePlay);
        node.removeEventListener('pause', handlePause);
        node.removeEventListener('error', handleError);
      };
      setIsPlayerReady(prev => (prev ? prev : true));
    }
  }, []);

  // Real-time polling timer for playback progress (unified for YouTube and HTML5 video)
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (!activeItem) return;
      const startSecs = activeItem.startSeconds || 0;
      const endSecs = activeItem.endSeconds || startSecs + chunkDurationSeconds;
      const totalChunkDur = endSecs - startSecs;

      if (activeMediaSource.isDirectVideo && videoRef.current) {
        const rawCurrent = videoRef.current.currentTime;
        const relCurrent = Math.max(0, rawCurrent - startSecs);
        const clamped = Math.min(relCurrent, totalChunkDur);
        setCurrentTimeSeconds(prev => (Math.abs(prev - clamped) >= 0.2 ? clamped : prev));

        if (rawCurrent >= endSecs) {
          try { videoRef.current.pause(); } catch {}
          setIsPlaying(false);
        }

        if (rawCurrent >= endSecs - 0.5 && isPlayingRef.current) {
          if (!reportedChunksRef.current.has(activeItem.chunkId) && !completionError) {
            void completeActiveChunk();
          }
        }
        return;
      }

      if (!playerRef.current || !isPlayerReady) return;
      try {
        if (typeof playerRef.current.getCurrentTime === 'function') {
          const rawCurrent = playerRef.current.getCurrentTime();
          const relCurrent = Math.max(0, rawCurrent - startSecs);
          const clamped = Math.min(relCurrent, totalChunkDur);
          setCurrentTimeSeconds(prev => (Math.abs(prev - clamped) >= 0.2 ? clamped : prev));

          if (rawCurrent >= endSecs - 0.5 && isPlayingRef.current) {
            if (!reportedChunksRef.current.has(activeItem.chunkId) && !completionError) {
              void completeActiveChunk();
            }
          }
        }
      } catch {}
    }, 250);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [activeItem, chunkDurationSeconds, activeMediaSource.isDirectVideo, isPlayerReady, completeActiveChunk, completionError]);

  // Backward compatibility wrapper for setting index
  const setCurrentIndex = useCallback((updater: number | ((prev: number) => number)) => {
    setChannelCaches(prev => {
      const ch = prev[activeChannel];
      const newIndex = typeof updater === 'function' ? updater(ch.currentIndex) : updater;
      if (newIndex < 0 || newIndex >= ch.items.length || newIndex === ch.currentIndex) return prev;
      return { ...prev, [activeChannel]: { ...ch, currentIndex: newIndex } };
    });
  }, [activeChannel, setChannelCaches]);

  const goToIndex = useCallback((targetIndex: number) => {
    if (targetIndex < 0) return;
    const ch = channelCaches[activeChannel];
    if (ch && targetIndex >= ch.items.length) {
      if (!ch.isFetching && !ch.hasError && !ch.exhausted) {
        void fetchChannelFeed(activeChannel, true);
      }
      return;
    }
    setChannelCaches(prev => {
      const currentCh = prev[activeChannel];
      if (!currentCh) return prev;
      if (targetIndex >= currentCh.items.length || currentCh.currentIndex === targetIndex) return prev;
      return {
        ...prev,
        [activeChannel]: {
          ...currentCh,
          currentIndex: targetIndex
        }
      };
    });
  }, [activeChannel, channelCaches, fetchChannelFeed, setChannelCaches]);

  const nextChunk = useCallback(() => goToIndex(currentIndex + 1), [goToIndex, currentIndex]);
  const previousChunk = useCallback(() => goToIndex(currentIndex - 1), [goToIndex, currentIndex]);

  const togglePlayback = useCallback(() => {
    if (activeMediaSource.isDirectVideo && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (mediaError && typeof videoRef.current.load === 'function') {
          try { videoRef.current.load(); } catch {}
        }
        setMediaError(null);
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Direct video playback failed:', err);
          setIsPlaying(false);
          setMediaError('Playback could not be started.');
        });
      }
      return;
    }

    if (!playerRef.current || !isPlayerReady) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(p => !p);
    }
  }, [isPlaying, isPlayerReady, activeMediaSource.isDirectVideo, mediaError]);

  const seekToPercent = useCallback((percent: number) => {
    if (!activeItem) return;
    const targetRelSecs = (percent / 100) * chunkDurationSeconds;
    const targetAbsSecs = (activeItem.startSeconds || 0) + targetRelSecs;
    setCurrentTimeSeconds(targetRelSecs);

    if (activeMediaSource.isDirectVideo && videoRef.current) {
      try { videoRef.current.currentTime = targetAbsSecs; } catch {}
      return;
    }

    if (playerRef.current && isPlayerReady) {
      try { playerRef.current.seekTo(targetAbsSecs, true); } catch {}
    }
  }, [activeItem, chunkDurationSeconds, activeMediaSource.isDirectVideo, isPlayerReady]);

  const skipSeconds = useCallback((deltaSecs: number) => {
    if (!activeItem) return;
    const newRel = Math.max(0, Math.min(chunkDurationSeconds, currentTimeSeconds + deltaSecs));
    const targetAbsSecs = (activeItem.startSeconds || 0) + newRel;
    setCurrentTimeSeconds(newRel);

    if (activeMediaSource.isDirectVideo && videoRef.current) {
      try { videoRef.current.currentTime = targetAbsSecs; } catch {}
      return;
    }

    if (playerRef.current && isPlayerReady) {
      try { playerRef.current.seekTo(targetAbsSecs, true); } catch {}
    }
  }, [activeItem, chunkDurationSeconds, currentTimeSeconds, activeMediaSource.isDirectVideo, isPlayerReady]);

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, newVolume));
    setVolumeState(clamped);
    if (clamped > 0) {
      lastAudibleVolumeRef.current = clamped;
      setMuted(false);
    } else {
      setMuted(true);
    }
    if (playerRef.current) try { playerRef.current.setVolume(clamped); } catch {}
    if (videoRef.current) {
      try {
        videoRef.current.volume = clamped / 100;
        videoRef.current.muted = clamped === 0;
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) {
      const restoreVol = lastAudibleVolumeRef.current > 0 ? lastAudibleVolumeRef.current : 90;
      setVolume(restoreVol);
    } else {
      if (volume > 0) {
        lastAudibleVolumeRef.current = volume;
      }
      setVolume(0);
    }
  }, [muted, volume, setVolume]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (playerRef.current) try { playerRef.current.setPlaybackRate(speed); } catch {}
    if (videoRef.current) {
      try { videoRef.current.playbackRate = speed; } catch {}
    }
  }, []);

  const toggleBookmark = useCallback(() => {
    if (!activeChunkId) {
      setBookmarkedState(p => !p);
      return;
    }
    setBookmarkedState(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`sidequest_bookmark_${activeChunkId}`, String(next));
      }
      return next;
    });
  }, [activeChunkId]);

  const saveNotes = useCallback(async (notes: string) => {
    if (!activeChunkId) return;
    setNotesText(notes);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`sidequest_note_${activeChunkId}`, notes);
    }

    // Sync to workspace notes API in background
    try {
      await fetch('/api/workspace/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId: activeChunkId,
          lessonTitle: activeItem?.lessonTitle,
          content: notes,
          updatedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // Graceful offline fallback
      console.warn('Notes saved locally; cloud sync failed', err);
    }
  }, [activeChunkId, activeItem?.lessonTitle]);

  const timelineProgress = Math.min(100, Math.max(0, (currentTimeSeconds / Math.max(1, chunkDurationSeconds)) * 100));
  const hasNext = currentIndex < feedItems.length - 1;
  const hasPrevious = currentIndex > 0;
  
  const timelineMarkers: TimelineMarker[] = [];
  const lessonModel = {
    platform: 'youtube' as const,
    title: activeItem?.lessonTitle || 'Loading...',
    subtitle: activeItem ? `${activeItem.chunkTitle} • ${activeItem.cohortTitle}` : '',
    cohortTitle: activeItem?.cohortTitle || '',
    cohortId: activeItem?.cohortId || '',
    // Real season/lesson position from feed data (Bug #2 fix)
    seasonOrder: activeItem?.seasonOrder ?? 1,
    seasonNumber: activeItem?.seasonOrder ?? 1,
    currentVideo: activeItem?.lessonOrder ?? 1,
    totalVideos: activeItem?.totalLessonsInSeason ?? activeItem?.totalVideos ?? Math.max(activeItem?.lessonOrder ?? 1, 1),
    currentChunk: activeItem?.chunkOrder || 1,
    totalChunks: activeItem?.totalChunksInLesson || activeItem?.chunkOrder || 1,
    // Chunk-relative times: player always seeks to startSeconds, so from the user's POV
    // playback begins at 00:00 and runs for the chunk duration (Bug #2 fix)
    startTime: '00:00',
    endTime: formatSecs(chunkDurationSeconds),
    currentTime: formatSecs(currentTimeSeconds),
    totalDuration: formatSecs(chunkDurationSeconds),
    videoId: activeItem?.lessonVideoId,
  };

  const isChunkCompleted = useCallback((chunkId: string) => {
    return reportedChunksRef.current.has(chunkId);
  }, []);

  const itemStatuses = useMemo(() => {
    return feedItems.map(item => {
      if (reportedChunksRef.current.has(item.chunkId)) {
        return 'completed' as const;
      }
      return 'not-started' as const;
    });
  }, [feedItems, currentIndex]);

  return {
    activeItem,
    feedLoading: currentCache.items.length === 0 && (currentCache.isFetching || (currentCache.prefs === undefined && !currentCache.hasError)),
    isRefreshing: currentCache.items.length > 0 && currentCache.isFetching,
    feedError: currentCache.hasError,
    feedItems,
    currentIndex,
    lesson: lessonModel,
    timelineMarkers,
    timelineProgress,
    hasNext,
    hasPrevious,
    isPlaying,
    volume,
    muted,
    playbackSpeed,
    bookmarked,
    activeTool,
    notesText,
    dailyGoalPercent,
    stats,
    playerContainerRef,
    setCurrentIndex,
    goToIndex,
    nextChunk,
    previousChunk,
    togglePlayback,
    seekToPercent,
    skipSeconds,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    toggleBookmark,
    completeActiveChunk,
    completionPending,
    completionError,
    saveNotes,
    setActiveTool,
    ytApiReady,
    ytApiError,
    mediaError,
    setMediaError,
    registerVideoElement,
    videoRef,
    isPlayerReady,
    itemStatuses,
    isChunkCompleted,
    
    activeChannel,
    setActiveChannel,
    searchQuery,
    setSearchQuery: (q: string) => {
      setSearchQueryState(q);
      searchQueryRef.current = q;
      void fetchChannelFeed(activeChannelRef.current, 0, q);
    },
    fetchChannelFeed,
  };
}

const INITIAL_LESSON_MODEL = {
  platform: 'youtube' as const,
  title: 'Loading...',
  subtitle: '',
  cohortTitle: '',
  cohortId: '',
  seasonOrder: 1,
  seasonNumber: 1,
  currentVideo: 1,
  totalVideos: 1,
  currentChunk: 1,
  totalChunks: 1,
  startTime: '00:00',
  endTime: '03:00',
  currentTime: '00:00',
  totalDuration: '03:00',
  videoId: undefined,
};

export type UsePlaybackResult = ReturnType<typeof usePlayback>;

export const INITIAL_PLAYBACK_STATE: UsePlaybackResult = {
  activeItem: null as unknown as FeedItem,
  feedLoading: true,
  isRefreshing: false,
  feedError: false,
  feedItems: [],
  currentIndex: 0,
  lesson: INITIAL_LESSON_MODEL,
  timelineMarkers: [],
  timelineProgress: 0,
  hasNext: false,
  hasPrevious: false,
  isPlaying: false,
  volume: 1,
  muted: false,
  playbackSpeed: 1.0,
  bookmarked: false,
  activeTool: null,
  notesText: '',
  dailyGoalPercent: 0,
  stats: {
    cohortsCovered: 0,
    chunksRemaining: 0,
    estimatedMinutes: 0,
  },
  playerContainerRef: { current: null },
  setCurrentIndex: () => {},
  goToIndex: () => {},
  nextChunk: () => {},
  previousChunk: () => {},
  togglePlayback: () => {},
  seekToPercent: () => {},
  skipSeconds: () => {},
  setVolume: () => {},
  toggleMute: () => {},
  setPlaybackSpeed: () => {},
  toggleBookmark: () => {},
  completeActiveChunk: async () => false,
  completionPending: false,
  completionError: null,
  saveNotes: async () => {},
  setActiveTool: () => {},
  ytApiReady: false,
  ytApiError: null,
  mediaError: null,
  setMediaError: () => {},
  registerVideoElement: () => {},
  videoRef: { current: null },
  isPlayerReady: false,
  itemStatuses: [],
  isChunkCompleted: () => false,
  activeChannel: 'default',
  setActiveChannel: () => {},
  searchQuery: '',
  setSearchQuery: () => {},
  fetchChannelFeed: async () => {},
};

