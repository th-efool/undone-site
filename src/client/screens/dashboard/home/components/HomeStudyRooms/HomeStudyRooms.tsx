'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users } from 'lucide-react';
import type { StudyRoomCardDTO } from '@/src/shared/studyroom/contracts';
import styles from './HomeStudyRooms.module.css';

const FALLBACK_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export interface HomeStudyRoomsProps {
  className?: string;
}

export const HomeStudyRooms = React.memo(function HomeStudyRooms({ className }: HomeStudyRoomsProps) {
  const [rooms, setRooms] = useState<StudyRoomCardDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchRooms = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/studyroom?format=v2&tab=discover&limit=4', { signal });
      if (!res.ok) {
        throw new Error(`Failed to load study rooms (${res.status})`);
      }
      const data = await res.json();
      const loadedRooms: StudyRoomCardDTO[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.rooms)
        ? data.rooms
        : [];
      setRooms(loadedRooms);
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setError('Could not load studyrooms.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchRooms(controller.signal);
    return () => controller.abort();
  }, [fetchRooms, reloadKey]);

  return (
    <section className={`${styles.section} ${className || ''}`.trim()} aria-label="Studyrooms">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} aria-hidden="true">
            <Users size={16} strokeWidth={2.4} />
          </div>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>Studyrooms</h2>
            <p className={styles.subtitle}>Join focused rooms and learn together in real time.</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className={styles.loadingContainer} role="status" aria-label="Loading studyrooms">
          <p>Loading studyrooms…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className={styles.errorContainer} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && rooms.length === 0 && (
        <div className={styles.emptyContainer}>
          <p>No studyrooms available</p>
          <Link href="/studyroom" className={styles.browseLink}>
            Browse studyrooms
          </Link>
        </div>
      )}

      {!isLoading && !error && rooms.length > 0 && (
        <div className={styles.grid}>
          {rooms.map((room) => {
            const thumbSrc = room.thumbnail || FALLBACK_THUMBNAIL;
            return (
              <Link
                key={room.id || room.slug}
                href={`/studyroom/${room.slug}`}
                className={styles.card}
                aria-label={`${room.title} study room, ${room.onlineCount} online`}
              >
                <div className={styles.cardThumbWrapper}>
                  <Image
                    src={thumbSrc}
                    alt={room.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 240px"
                    className={styles.cardThumb}
                  />
                  <div className={styles.onlineBadge}>
                    <span className={styles.onlineDot} aria-hidden="true" />
                    <span>{room.onlineCount} online</span>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.roomTitle}>{room.title}</h3>
                  {room.description && <p className={styles.roomDesc}>{room.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
});
