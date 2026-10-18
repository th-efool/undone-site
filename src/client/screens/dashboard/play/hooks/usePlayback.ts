'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { feedRepository } from '@/src/client/repositories/feedRepository';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { PlayerTool, TimelineMarker } from '../types/play';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { resolveMediaSource } from '../utils/mediaSource';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

type ChannelCache = {
  items: FeedItem[];
  pageIndex: number;
  isFetching: boolean;
  currentIndex: number;
  hasError: boolean;
  exhausted?: boolean;
  prefs?: string;
  query?: string;
};

const INITIAL_CACHES: Record<ChannelId, ChannelCache> = {
  default: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  spark: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  explore: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  build: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  listen: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  deep_dive: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
  quick: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined, query: undefined },
};

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
  const searchParams = useSearchParams();
  const requestedCohortId = searchParams.get('cohort') || undefined;
  const requestedLessonId = searchParams.get('lessonId') || searchParams.get('lesson') || undefined;
  const requestedChunkId = searchParams.get('chunk') || undefined;
  const initialQuery = searchParams.get('q') || '';

  // New Client Memory Cache architecture
  const [channelCaches, setChannelCaches] = useState<Record<ChannelId, ChannelCache>>(INITIAL_CACHES);
  const [searchQuery, setSearchQueryState] = useState<string>(initialQuery);
  
  // 6. Wasted Fetch on Initial Load - Lazy init for activeChannel
  const [activeChannel, setActiveChannel] = useState<ChannelId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidequest_active_channel') as ChannelId;
      return stored && INITIAL_CACHES[stored] ? stored : 'default';
    }
    return 'default';
  });
  
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
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const completing = useRef(false);
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

  // Fetch feed items via API (Prefetch Engine)
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchChannelFeed = useCallback(async (channelId: ChannelId, pageIndex: number, overrideQuery?: string) => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    setChannelCaches(prev => ({
      ...prev,
      [channelId]: { ...prev[channelId], isFetching: true }
    }));

    try {
      let rawPrefs = '';
      let prefsQuery = '';
      if (typeof window !== 'undefined') {
        rawPrefs = localStorage.getItem('sidequest_channel_prefs') || '';
        if (rawPrefs) {
          prefsQuery = `&prefs=${encodeURIComponent(rawPrefs)}`;
        }
      }
      
      const qVal = overrideQuery !== undefined ? overrideQuery : searchQueryRef.current;
      const selection = new URLSearchParams();
      if (requestedCohortId) selection.set('cohort', requestedCohortId);
      if (requestedLessonId) selection.set('lesson', requestedLessonId);
      if (requestedChunkId) selection.set('chunk', requestedChunkId);
      if (qVal.trim()) selection.set('q', qVal.trim());
      const res = await fetch(`/api/feed?channel=${channelId}&pageIndex=${pageIndex}${prefsQuery}&${selection}`, {
        signal: abortController.signal
      });
      if (!res.ok) throw new Error('Failed to fetch feed');
      const data = await res.json();
      
      setChannelCaches(prev => {
        const existingItems = pageIndex === 0 ? [] : prev[channelId].items;
        const allItems = [...existingItems, ...data.items];
        let nextIndex = prev[channelId].currentIndex;
        if (pageIndex === 0) {
          if ((requestedLessonId || requestedChunkId) && allItems.length > 0) {
            const matched = allItems.findIndex(item =>
              (requestedChunkId && item.chunkId === requestedChunkId) ||
              (requestedLessonId && (
                item.lessonId === requestedLessonId ||
                (item.lessonOrder !== undefined && (
                  String(item.lessonOrder) === requestedLessonId ||
                  String(item.lessonOrder + 1) === requestedLessonId
                ))
              ))
            );
            nextIndex = matched !== -1 ? matched : 0;
          } else {
            nextIndex = 0;
          }
        }
        return {
          ...prev,
          [channelId]: {
            ...prev[channelId],
            items: allItems,
            pageIndex: pageIndex,
            currentIndex: nextIndex,
            isFetching: false,
            hasError: false,
            exhausted: data.items.length === 0,
            prefs: rawPrefs,
            query: qVal
          }
        };
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setChannelCaches(prev => ({
          ...prev,
          [channelId]: { ...prev[channelId], isFetching: false }
        }));
        return;
      }
      console.error('Prefetch error:', error);
      // 2. Infinite API Loop on Prefetch Failure - setting hasError true
      setChannelCaches(prev => ({
        ...prev,
        [channelId]: { ...prev[channelId], isFetching: false, hasError: true }
      }));
    }
  }, [requestedCohortId, requestedLessonId, requestedChunkId]);

  const completeActiveChunk = useCallback(async () => {
    if (!activeItem || completing.current) return false;
    completing.current = true; setCompletionPending(true); setCompletionError(null);
    try {
      const duration = Math.max(1, activeItem.endSeconds - activeItem.startSeconds);
      const response = await fetch('/api/progress/chunk', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId: activeItem.chunkId, lessonId: activeItem.lessonId, cohortId: activeItem.cohortId,
          watchedSeconds: duration, totalSeconds: duration, forceStatus: 'COMPLETED' }) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to save completion.' : 'Completion could not be saved. Retry.');
      reportedChunksRef.current.add(activeItem.chunkId);

      let shouldPrefetch = false;
      let nextPage = 0;

      setChannelCaches(previous => {
        const ch = previous[activeChannel];
        if (!ch) return previous;
        const currentItem = ch.items[ch.currentIndex];
        const currentChunkId = currentItem?.chunkId;
        const itemIndex = ch.items.findIndex(it => it.chunkId === activeItem.chunkId);
        const nextItems = ch.items.filter(item => item.chunkId !== activeItem.chunkId);

        let nextIndex: number;
        // If user was viewing a different item when completion resolved, preserve that item's index
        if (currentChunkId && currentChunkId !== activeItem.chunkId) {
          const preservedIdx = nextItems.findIndex(it => it.chunkId === currentChunkId);
          nextIndex = preservedIdx !== -1 ? preservedIdx : Math.min(ch.currentIndex, Math.max(0, nextItems.length - 1));
        } else {
          // User was viewing the item that just completed; advance smoothly to the next item
          nextIndex = itemIndex === -1
            ? Math.min(ch.currentIndex, Math.max(0, nextItems.length - 1))
            : itemIndex >= nextItems.length
            ? Math.max(0, nextItems.length - 1)
            : Math.max(0, itemIndex);
        }

        if (nextItems.length < 3 && !ch.isFetching && !ch.exhausted && !ch.hasError) {
          shouldPrefetch = true;
          nextPage = ch.pageIndex + 1;
        }

        return {
          ...previous,
          [activeChannel]: {
            ...ch,
            currentIndex: nextIndex,
            items: nextItems,
          }
        };
      });

      if (shouldPrefetch) {
        void fetchChannelFeed(activeChannel, nextPage);
      }
      return true;
    } catch (error) { setCompletionError(error instanceof Error ? error.message : 'Completion could not be saved.'); return false; }
    finally { completing.current = false; setCompletionPending(false); }
  }, [activeItem, activeChannel, fetchChannelFeed]);

  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Initial Load & Channel Switch Logic
  useEffect(() => {
    let currentPrefs = '';
    if (typeof window !== 'undefined') {
      currentPrefs = localStorage.getItem('sidequest_channel_prefs') || '';
    }
    const cache = channelCaches[activeChannel];
    const isCacheStale = cache.prefs !== undefined && cache.prefs !== currentPrefs;
    
    if (((cache.items.length === 0 && cache.prefs === undefined) || isCacheStale) && !cache.isFetching && !cache.hasError) {
      // If stale, invalidate first? fetchChannelFeed sets isFetching to true and overrides everything when done for pageIndex 0
      fetchChannelFeed(activeChannel, 0);
    }
  }, [activeChannel, channelCaches, fetchChannelFeed]);

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
      setChannelCaches(prev => ({
        ...prev,
        [activeChannel]: {
          ...prev[activeChannel],
          currentIndex: matchedIndex
        }
      }));
    }
  }, [requestedLessonId, requestedChunkId, activeChannel, feedItems]);

  // 80% Threshold Prefetch Logic
  useEffect(() => {
    if (!activeItem) return;
    
    // We fetch 6 items at a time. If we are on index 4 (5th item out of 6), prefetch next.
    // Generally: if currentIndex >= length - 2
    if (
      currentIndex >= feedItems.length - 2 && 
      !channelCaches[activeChannel].isFetching &&
      !channelCaches[activeChannel].exhausted &&
      !channelCaches[activeChannel].hasError && // 2. Infinite API Loop on Prefetch Failure
      feedItems.length > 0
    ) {
      fetchChannelFeed(activeChannel, channelCaches[activeChannel].pageIndex + 1);
    }
  }, [currentIndex, feedItems.length, activeChannel, channelCaches, fetchChannelFeed, activeItem]);

  // Dynamic Player Stats & Daily Goal Calculation
  useEffect(() => {
    const items = currentCache.items;
    if (!items.length) {
      setStats({ cohortsCovered: 0, chunksRemaining: 0, estimatedMinutes: 0 });
      setDailyGoalPercent(0);
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

    setDailyGoalPercent(calculatedGoalPercent);
    setStats({
      cohortsCovered: distinctCohorts,
      chunksRemaining: remaining,
      estimatedMinutes: Math.ceil(remainingSeconds / 60),
    });
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
    if (!activeItem) {
      setNotesText('');
      setBookmarkedState(false);
      setMediaError(null);
      return;
    }
    const dur = activeItem.endSeconds - activeItem.startSeconds || parseDurationToSeconds(activeItem.chunkDuration);
    setChunkDurationSeconds(dur);
    setCurrentTimeSeconds(0);
    setMediaError(null);

    if (activeMediaSource.isDirectVideo && videoRef.current) {
      if (activeItem.startSeconds && activeItem.startSeconds > 0) {
        try { videoRef.current.currentTime = activeItem.startSeconds; } catch {}
      } else {
        try { videoRef.current.currentTime = 0; } catch {}
      }
      try { videoRef.current.playbackRate = playbackSpeed; } catch {}
    }

    if (typeof window !== 'undefined' && activeChunkId) {
      const savedNote = localStorage.getItem(`sidequest_note_${activeChunkId}`);
      setNotesText(savedNote !== null ? savedNote : '');

      const savedBookmark = localStorage.getItem(`sidequest_bookmark_${activeChunkId}`);
      setBookmarkedState(savedBookmark === 'true');
    } else {
      setNotesText('');
      setBookmarkedState(false);
    }
  }, [activeItem, activeChunkId, activeMediaSource.isDirectVideo, playbackSpeed]);

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
            evt.target.setVolume(volume);
            evt.target.setPlaybackRate(playbackSpeed);
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
  }, [ytApiReady, activeItem?.chunkId, currentIndex]);

  // Destroy player and cleanup video listeners on component unmount
  useEffect(() => {
    return () => {
      isPlayerReadyRef.current = false;
      if (videoCleanupRef.current) {
        videoCleanupRef.current();
        videoCleanupRef.current = null;
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const registerVideoElement = useCallback((node: HTMLVideoElement | null) => {
    if (videoCleanupRef.current) {
      videoCleanupRef.current();
      videoCleanupRef.current = null;
    }
    videoRef.current = node;
    if (node && activeItem) {
      node.volume = volume / 100;
      node.muted = muted;
      node.playbackRate = playbackSpeed;
      if (activeItem.startSeconds && activeItem.startSeconds > 0) {
        try { node.currentTime = activeItem.startSeconds; } catch {}
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
      setIsPlayerReady(true);
    }
  }, [volume, muted, playbackSpeed, activeItem]);

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
        setCurrentTimeSeconds(Math.min(relCurrent, totalChunkDur));

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
          setCurrentTimeSeconds(Math.min(relCurrent, totalChunkDur));

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
      if (newIndex < 0 || newIndex >= ch.items.length) return prev;
      return { ...prev, [activeChannel]: { ...ch, currentIndex: newIndex } };
    });
  }, [activeChannel]);

  const goToIndex = useCallback((targetIndex: number) => {
    if (targetIndex < 0) return;
    setChannelCaches(prev => {
      const ch = prev[activeChannel];
      if (targetIndex >= ch.items.length) {
        if (!ch.isFetching && !ch.hasError) {
          setTimeout(() => fetchChannelFeed(activeChannel, ch.pageIndex + 1), 0);
        }
        return prev;
      }
      return {
        ...prev,
        [activeChannel]: {
          ...ch,
          currentIndex: targetIndex
        }
      };
    });
  }, [activeChannel, fetchChannelFeed]);

  const nextChunk = useCallback(() => goToIndex(currentIndex + 1), [goToIndex, currentIndex]);
  const previousChunk = useCallback(() => goToIndex(currentIndex - 1), [goToIndex, currentIndex]);

  const togglePlayback = useCallback(() => {
    if (activeMediaSource.isDirectVideo && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
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
  }, [isPlaying, isPlayerReady, activeMediaSource.isDirectVideo]);

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
    feedLoading: currentCache.isFetching || (currentCache.prefs === undefined && !currentCache.hasError),
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
    itemStatuses,
    isChunkCompleted,
    
    activeChannel,
    setActiveChannel: (ch: ChannelId) => {
      setActiveChannel(ch);
      if (typeof window !== 'undefined') localStorage.setItem('sidequest_active_channel', ch);
    },
    searchQuery,
    setSearchQuery: (q: string) => {
      setSearchQueryState(q);
      searchQueryRef.current = q;
      void fetchChannelFeed(activeChannelRef.current, 0, q);
    },
    fetchChannelFeed,
  };
}

export type UsePlaybackResult = ReturnType<typeof usePlayback>;

