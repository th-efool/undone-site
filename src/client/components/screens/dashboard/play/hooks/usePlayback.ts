'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { feedRepository } from '@/src/client/repositories/feedRepository';
import type { FeedItem, ChunkProgress } from '@/src/shared/feed/feedEngine.types';
import type { PlayerTool, TimelineMarker } from '../types/play';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function parseDurationToSeconds(val: string): number {
  if (!val) return 180;
  const isoMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i.exec(val.toUpperCase());
  if (isoMatch) {
    return (Number(isoMatch[1] ?? 0) * 3600) + (Number(isoMatch[2] ?? 0) * 60) + Number(isoMatch[3] ?? 0);
  }
  const hmsMatch = val.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
  if (hmsMatch) {
    if (hmsMatch[3]) return Number(hmsMatch[1]) * 3600 + Number(hmsMatch[2]) * 60 + Number(hmsMatch[3]);
    return Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]);
  }
  const minMatch = val.match(/(\d+)\s*m/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  return 180;
}

function formatSecs(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function usePlayback() {
  const searchParams = useSearchParams();
  const requestedCohortId = searchParams.get('cohort') || undefined;
  const requestedLessonId = searchParams.get('lesson') || undefined;
  const requestedChunkId = searchParams.get('chunk') || undefined;

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
  const currentIndexRef = useRef(currentIndex);
  const feedItemsRef = useRef(feedItems);
  const isPlayingRef = useRef(isPlaying);

  currentIndexRef.current = currentIndex;
  feedItemsRef.current = feedItems;
  isPlayingRef.current = isPlaying;

  const activeItem = feedItems[currentIndex] || null;

  // Initialize YouTube IFrame API
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

  // Fetch feed items from feedRepository
  const refreshFeed = useCallback(() => {
    const output = feedRepository.getFeed({
      requestedCohortId,
      requestedLessonId,
      requestedChunkId,
      feedSize: 30,
    });
    setFeedItems(output.items);
    setStats({
      cohortsCovered: output.stats.cohortsCovered,
      chunksRemaining: output.stats.chunksRemaining,
      estimatedMinutes: output.stats.estimatedMinutes,
    });
    setDailyGoalPercent(output.dailyGoalProgress.percent);
  }, [requestedCohortId, requestedLessonId, requestedChunkId]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  // Sync state when active item changes
  useEffect(() => {
    if (!activeItem) return;

    const dur = activeItem.chunk.endSeconds - activeItem.chunk.startSeconds || parseDurationToSeconds(activeItem.chunk.chunkDuration);
    setChunkDurationSeconds(dur);
    setBookmarkedState(Boolean(activeItem.progress.bookmarked));
    setNotesText(activeItem.progress.notes || '');

    const initialWatched = activeItem.progress.watchedSeconds || 0;
    setCurrentTimeSeconds(Math.min(initialWatched, dur));
  }, [activeItem]);

  // Handle YouTube player creation & video switching
  useEffect(() => {
    if (!ytApiReady || !playerContainerRef.current || !activeItem) return;
    const videoId = activeItem.chunk.lessonVideoId;
    if (!videoId) return;

    const startSecs = activeItem.chunk.startSeconds || 0;
    const endSecs = activeItem.chunk.endSeconds || startSecs + 180;

    if (!playerRef.current) {
      try {
        const mountDiv = document.createElement('div');
        mountDiv.id = 'yt-player-mount';
        playerContainerRef.current.innerHTML = '';
        playerContainerRef.current.appendChild(mountDiv);

        playerRef.current = new window.YT.Player('yt-player-mount', {
          videoId,
          playerVars: {
            autoplay: 1,
            start: startSecs,
            end: endSecs,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            playsinline: 1,
          },
          events: {
            onReady: (evt: any) => {
              setIsPlayerReady(true);
              try {
                evt.target.unloadModule("captions");
                evt.target.unloadModule("cc");
              } catch {}
              evt.target.setVolume(volume);
              evt.target.setPlaybackRate(playbackSpeed);
              evt.target.seekTo(startSecs, true);
              evt.target.playVideo();
              setIsPlaying(true);
            },
            onStateChange: (evt: any) => {
              if (evt.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (evt.data === window.YT.PlayerState.PAUSED || evt.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
              }
            },
          },
        });
      } catch (err) {
        console.error('Failed to mount YouTube player', err);
      }
    } else if (isPlayerReady && playerRef.current.loadVideoById) {
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: startSecs,
          endSeconds: endSecs,
        });
        playerRef.current.setPlaybackRate(playbackSpeed);
        playerRef.current.playVideo();
        setIsPlaying(true);
      } catch (err) {
        console.error('Failed to load video in existing player', err);
      }
    }
  }, [ytApiReady, activeItem?.chunk?.chunkId, isPlayerReady]);

  // Real-time polling timer for playback progress
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);

    syncTimerRef.current = setInterval(() => {
      if (!playerRef.current || !isPlayerReady || !activeItem) return;

      try {
        if (typeof playerRef.current.getCurrentTime === 'function') {
          const rawCurrent = playerRef.current.getCurrentTime();
          const startSecs = activeItem.chunk.startSeconds || 0;
          const endSecs = activeItem.chunk.endSeconds || startSecs + chunkDurationSeconds;
          const relCurrent = Math.max(0, rawCurrent - startSecs);
          const totalChunkDur = endSecs - startSecs;

          setCurrentTimeSeconds(Math.min(relCurrent, totalChunkDur));

          // Auto-advance if reached end of chunk segment
          if (rawCurrent >= endSecs - 0.5 && isPlayingRef.current) {
            // Mark completed and move next
            feedRepository.updateProgress(
              activeItem.chunk.chunkId,
              activeItem.chunk.lessonId,
              activeItem.chunk.cohortId,
              totalChunkDur,
              totalChunkDur,
              { forceCompleted: true },
            );
            refreshFeed();
          }
        }
      } catch {}
    }, 250);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [activeItem, chunkDurationSeconds, isPlayerReady, refreshFeed]);

  // Change Card with Premature Scroll Progress Update
  const goToIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= feedItemsRef.current.length) return;

      const currentItem = feedItemsRef.current[currentIndexRef.current];
      if (currentItem) {
        const dur = currentItem.chunk.endSeconds - currentItem.chunk.startSeconds || 180;
        // Save current progress with premature scroll check!
        feedRepository.updateProgress(
          currentItem.chunk.chunkId,
          currentItem.chunk.lessonId,
          currentItem.chunk.cohortId,
          currentTimeSeconds,
          dur,
          { isPrematureScroll: true },
        );
      }

      setCurrentIndex(targetIndex);
      refreshFeed();
    },
    [currentTimeSeconds, refreshFeed],
  );

  const nextChunk = useCallback(() => {
    goToIndex(currentIndexRef.current + 1);
  }, [goToIndex]);

  const previousChunk = useCallback(() => {
    goToIndex(currentIndexRef.current - 1);
  }, [goToIndex]);

  const togglePlayback = useCallback(() => {
    if (!playerRef.current || !isPlayerReady) {
      setIsPlaying((prev) => !prev);
      return;
    }
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying((prev) => !prev);
    }
  }, [isPlaying, isPlayerReady]);

  const seekToPercent = useCallback(
    (percent: number) => {
      if (!activeItem) return;
      const dur = chunkDurationSeconds;
      const targetRelSecs = (percent / 100) * dur;
      const targetAbsSecs = (activeItem.chunk.startSeconds || 0) + targetRelSecs;

      setCurrentTimeSeconds(targetRelSecs);
      if (playerRef.current && isPlayerReady && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetAbsSecs, true);
        } catch {}
      }
    },
    [activeItem, chunkDurationSeconds, isPlayerReady],
  );

  const skipSeconds = useCallback(
    (deltaSecs: number) => {
      if (!activeItem) return;
      const newRel = Math.max(0, Math.min(chunkDurationSeconds, currentTimeSeconds + deltaSecs));
      const targetAbsSecs = (activeItem.chunk.startSeconds || 0) + newRel;

      setCurrentTimeSeconds(newRel);
      if (playerRef.current && isPlayerReady && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(targetAbsSecs, true);
        } catch {}
      }
    },
    [activeItem, chunkDurationSeconds, currentTimeSeconds, isPlayerReady],
  );

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    setMuted(newVolume === 0);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(newVolume);
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      setVolume(90);
    } else {
      setMuted(true);
      setVolume(0);
    }
  }, [muted, setVolume]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch {}
    }
  }, []);

  const toggleBookmark = useCallback(() => {
    if (!activeItem) return;
    const newState = feedRepository.toggleBookmark(
      activeItem.chunk.chunkId,
      activeItem.chunk.lessonId,
      activeItem.chunk.cohortId,
    );
    setBookmarkedState(newState);
    refreshFeed();
  }, [activeItem, refreshFeed]);

  const completeActiveChunk = useCallback(() => {
    if (!activeItem) return;
    feedRepository.updateProgress(
      activeItem.chunk.chunkId,
      activeItem.chunk.lessonId,
      activeItem.chunk.cohortId,
      chunkDurationSeconds,
      chunkDurationSeconds,
      { forceCompleted: true },
    );
    refreshFeed();
    nextChunk();
  }, [activeItem, chunkDurationSeconds, nextChunk, refreshFeed]);

  const saveNotes = useCallback(
    (notes: string) => {
      if (!activeItem) return;
      setNotesText(notes);
      feedRepository.updateProgress(
        activeItem.chunk.chunkId,
        activeItem.chunk.lessonId,
        activeItem.chunk.cohortId,
        currentTimeSeconds,
        chunkDurationSeconds,
        { notes },
      );
    },
    [activeItem, chunkDurationSeconds, currentTimeSeconds],
  );

  const timelineProgress = Math.min(100, Math.max(0, (currentTimeSeconds / Math.max(1, chunkDurationSeconds)) * 100));

  const timelineMarkers: TimelineMarker[] = [
    { id: 'm1', position: 25, variant: 'checkpoint' },
    { id: 'm2', position: 60, variant: 'note' },
    { id: 'm3', position: 90, variant: 'quiz' },
  ];

  const lessonModel = {
    platform: 'youtube' as const,
    title: activeItem?.chunk?.lessonTitle || 'Introductory Chunk',
    subtitle: activeItem ? `${activeItem.chunk.chunkTitle} • ${activeItem.chunk.cohortTitle}` : 'Loading...',
    cohortTitle: activeItem?.chunk?.cohortTitle || '',
    cohortId: activeItem?.chunk?.cohortId || '',
    seasonOrder: activeItem?.chunk?.seasonOrder || 1,
    currentVideo: activeItem?.chunk?.lessonOrder || 1,
    totalVideos: 10,
    currentChunk: activeItem?.chunk?.chunkOrder || 1,
    totalChunks: 4,
    startTime: formatSecs(activeItem?.chunk?.startSeconds || 0),
    endTime: formatSecs(activeItem?.chunk?.endSeconds || parseDurationToSeconds(activeItem?.chunk?.chunkDuration || '180')),
    currentTime: formatSecs(currentTimeSeconds),
    totalDuration: formatSecs(chunkDurationSeconds),
    videoId: activeItem?.chunk?.lessonVideoId,
  };

  return {
    activeItem,
    feedItems,
    currentIndex,
    lesson: lessonModel,
    timelineMarkers,
    timelineProgress,
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
    refreshFeed,
  };
}
