'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { feedRepository } from '@/src/client/repositories/feedRepository';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { PlayerTool, TimelineMarker } from '../types/play';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';

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
  prefs?: string;
};

const INITIAL_CACHES: Record<ChannelId, ChannelCache> = {
  default: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  spark: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  explore: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  build: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  listen: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  deep_dive: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
  quick: { items: [], pageIndex: 0, isFetching: false, currentIndex: 0, hasError: false, prefs: undefined },
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
  const requestedLessonId = searchParams.get('lesson') || undefined;
  const requestedChunkId = searchParams.get('chunk') || undefined;

  // New Client Memory Cache architecture
  const [channelCaches, setChannelCaches] = useState<Record<ChannelId, ChannelCache>>(INITIAL_CACHES);
  
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
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [dailyGoalPercent, setDailyGoalPercent] = useState(68);
  const [stats, setStats] = useState({ cohortsCovered: 3, chunksRemaining: 20, estimatedMinutes: 90 });

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  const activeChannelRef = useRef(activeChannel);
  
  // 3. Duplicate Progress Reporting - Set to track reported chunks
  const reportedChunksRef = useRef<Set<string>>(new Set());
  
  isPlayingRef.current = isPlaying;
  activeChannelRef.current = activeChannel;

  const activeItem = feedItems[currentIndex] || null;

  // Fetch feed items via API (Prefetch Engine)
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchChannelFeed = useCallback(async (channelId: ChannelId, pageIndex: number) => {
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
      
      const res = await fetch(`/api/feed?channel=${channelId}&pageIndex=${pageIndex}${prefsQuery}`, {
        signal: abortController.signal
      });
      if (!res.ok) throw new Error('Failed to fetch feed');
      const data = await res.json();
      
      setChannelCaches(prev => {
        const existingItems = pageIndex === 0 ? [] : prev[channelId].items;
        return {
          ...prev,
          [channelId]: {
            ...prev[channelId],
            items: [...existingItems, ...data.items],
            pageIndex: pageIndex,
            isFetching: false,
            prefs: rawPrefs
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
  }, []);

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
    
    if ((cache.items.length === 0 || isCacheStale) && !cache.isFetching && !cache.hasError) {
      // If stale, invalidate first? fetchChannelFeed sets isFetching to true and overrides everything when done for pageIndex 0
      fetchChannelFeed(activeChannel, 0);
    }
  }, [activeChannel, channelCaches, fetchChannelFeed]);

  // 80% Threshold Prefetch Logic
  useEffect(() => {
    if (!activeItem) return;
    
    // We fetch 6 items at a time. If we are on index 4 (5th item out of 6), prefetch next.
    // Generally: if currentIndex >= length - 2
    if (
      currentIndex >= feedItems.length - 2 && 
      !channelCaches[activeChannel].isFetching &&
      !channelCaches[activeChannel].hasError && // 2. Infinite API Loop on Prefetch Failure
      feedItems.length > 0
    ) {
      fetchChannelFeed(activeChannel, channelCaches[activeChannel].pageIndex + 1);
    }
  }, [currentIndex, feedItems.length, activeChannel, channelCaches, fetchChannelFeed, activeItem]);

  // Handle YouTube IFrame API Load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      setYtApiReady(true);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  }, []);

  // Sync state when active item changes
  useEffect(() => {
    if (!activeItem) return;
    const dur = activeItem.endSeconds - activeItem.startSeconds || parseDurationToSeconds(activeItem.chunkDuration);
    setChunkDurationSeconds(dur);
    setBookmarkedState(false);
    setNotesText('');
    setCurrentTimeSeconds(0);
  }, [activeItem]);

  // Handle YouTube player creation & video switching
  const isPlayerReadyRef = useRef(false);

  useEffect(() => {
    if (!ytApiReady || !playerContainerRef.current || !activeItem) return;
    const videoId = activeItem.lessonVideoId || 'oHg5SJYRHA0';
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
        },
      });
    } catch (err) {
      console.error('Failed to mount YouTube player', err);
    }
  }, [ytApiReady, activeItem?.chunkId, currentIndex]);

  // Destroy player only on component unmount, not on every dep change
  useEffect(() => {
    return () => {
      isPlayerReadyRef.current = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // Real-time polling timer for playback progress
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (!playerRef.current || !isPlayerReady || !activeItem) return;
      try {
        if (typeof playerRef.current.getCurrentTime === 'function') {
          const rawCurrent = playerRef.current.getCurrentTime();
          const startSecs = activeItem.startSeconds || 0;
          const endSecs = activeItem.endSeconds || startSecs + chunkDurationSeconds;
          const relCurrent = Math.max(0, rawCurrent - startSecs);
          const totalChunkDur = endSecs - startSecs;

          setCurrentTimeSeconds(Math.min(relCurrent, totalChunkDur));

          if (rawCurrent >= endSecs - 0.5 && isPlayingRef.current) {
            // 3. Duplicate Progress Reporting
            if (!reportedChunksRef.current.has(activeItem.chunkId)) {
              reportedChunksRef.current.add(activeItem.chunkId);
              
              // Background API call to mark completed
              fetch('/api/progress/chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chunkId: activeItem.chunkId,
                  lessonId: activeItem.lessonId,
                  cohortId: activeItem.cohortId,
                  watchedSeconds: totalChunkDur,
                  totalSeconds: totalChunkDur,
                  status: 'completed', // 4. Missing status field
                }),
              });
              
              // 3. Out-of-bounds Advance 
              setChannelCaches(prev => {
                const ch = prev[activeChannelRef.current];
                if (ch.currentIndex + 1 < ch.items.length) {
                  return {
                    ...prev,
                    [activeChannelRef.current]: {
                      ...ch,
                      currentIndex: ch.currentIndex + 1
                    }
                  };
                }
                return prev;
              });
            }
          }
        }
      } catch {}
    }, 250);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [activeItem, chunkDurationSeconds, isPlayerReady]);

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
    if (!playerRef.current || !isPlayerReady) return setIsPlaying(p => !p);
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
  }, [isPlaying, isPlayerReady]);

  const seekToPercent = useCallback((percent: number) => {
    if (!activeItem || !playerRef.current || !isPlayerReady) return;
    const targetRelSecs = (percent / 100) * chunkDurationSeconds;
    const targetAbsSecs = (activeItem.startSeconds || 0) + targetRelSecs;
    setCurrentTimeSeconds(targetRelSecs);
    try { playerRef.current.seekTo(targetAbsSecs, true); } catch {}
  }, [activeItem, chunkDurationSeconds, isPlayerReady]);

  const skipSeconds = useCallback((deltaSecs: number) => {
    if (!activeItem || !playerRef.current || !isPlayerReady) return;
    const newRel = Math.max(0, Math.min(chunkDurationSeconds, currentTimeSeconds + deltaSecs));
    const targetAbsSecs = (activeItem.startSeconds || 0) + newRel;
    setCurrentTimeSeconds(newRel);
    try { playerRef.current.seekTo(targetAbsSecs, true); } catch {}
  }, [activeItem, chunkDurationSeconds, currentTimeSeconds, isPlayerReady]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    setMuted(newVolume === 0);
    if (playerRef.current) try { playerRef.current.setVolume(newVolume); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) { setMuted(false); setVolume(90); }
    else { setMuted(true); setVolume(0); }
  }, [muted, setVolume]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (playerRef.current) try { playerRef.current.setPlaybackRate(speed); } catch {}
  }, []);

  const toggleBookmark = useCallback(() => setBookmarkedState(p => !p), []);
  const completeActiveChunk = useCallback(() => nextChunk(), [nextChunk]);
  const saveNotes = useCallback((notes: string) => setNotesText(notes), []);

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
    seasonOrder: 1,
    currentVideo: 1,
    totalVideos: 10,
    currentChunk: activeItem?.chunkOrder || 1,
    totalChunks: activeItem?.totalChunksInLesson || activeItem?.chunkOrder || 1,
    startTime: formatSecs(activeItem?.startSeconds || 0),
    endTime: formatSecs(activeItem?.endSeconds || parseDurationToSeconds(activeItem?.chunkDuration || '180')),
    currentTime: formatSecs(currentTimeSeconds),
    totalDuration: formatSecs(chunkDurationSeconds),
    videoId: activeItem?.lessonVideoId || 'oHg5SJYRHA0',
  };

  return {
    activeItem,
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
    saveNotes,
    setActiveTool,
    
    activeChannel,
    setActiveChannel: (ch: ChannelId) => {
      setActiveChannel(ch);
      if (typeof window !== 'undefined') localStorage.setItem('sidequest_active_channel', ch);
    },
    fetchChannelFeed,
  };
}

export type UsePlaybackResult = ReturnType<typeof usePlayback>;

