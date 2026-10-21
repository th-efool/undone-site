'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Loader2, RefreshCw, Compass, Users, User, Clock } from 'lucide-react';
import type { StudyRoomCardDTO, DiscoveryTab } from '@/src/shared/studyroom/contracts';
import { RoomCard } from './components/RoomCard';
import { CreateRoomModal } from './components/CreateRoomModal';
import styles from './StudyRoomScreen.module.css';

export interface StudyRoomScreenProps {
  initialRooms?: StudyRoomCardDTO[];
}

export function StudyRoomScreen({ initialRooms }: StudyRoomScreenProps) {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [rooms, setRooms] = useState<StudyRoomCardDTO[]>(initialRooms ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch rooms on tab/search/filter change
  useEffect(() => {
    let ignore = false;

    Promise.resolve().then(async () => {
      if (ignore) return;
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);

      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('format', 'v2');
      if (debouncedQuery.trim()) params.set('query', debouncedQuery.trim());
      if (language) params.set('language', language);
      if (availableOnly) params.set('availableOnly', 'true');

      try {
        const res = await fetch(`/api/studyroom?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load study rooms (${res.status})`);
        }

        const data = await res.json();
        if (!ignore) {
          const incomingRooms: StudyRoomCardDTO[] = Array.isArray(data)
            ? data
            : data.rooms || [];
          setRooms(incomingRooms);
          setNextCursor(data.nextCursor || null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setIsError(true);
          setErrorMessage(err instanceof Error ? err.message : 'Unable to fetch study rooms.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [activeTab, debouncedQuery, language, availableOnly, refreshTrigger]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('format', 'v2');
    if (debouncedQuery.trim()) params.set('query', debouncedQuery.trim());
    if (language) params.set('language', language);
    if (availableOnly) params.set('availableOnly', 'true');
    params.set('cursor', nextCursor);

    try {
      const res = await fetch(`/api/studyroom?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load study rooms (${res.status})`);
      const data = await res.json();
      const incomingRooms: StudyRoomCardDTO[] = Array.isArray(data) ? data : data.rooms || [];
      setRooms((prev) => [...prev, ...incomingRooms]);
      setNextCursor(data.nextCursor || null);
    } catch (err: unknown) {
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to fetch more study rooms.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoomCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const getEmptyStateMessage = () => {
    if (debouncedQuery.trim()) {
      return `No rooms match "${debouncedQuery}". Try another keyword or filter.`;
    }
    switch (activeTab) {
      case 'cohorts':
        return 'No cohort study rooms available. Join or create a cohort to study with group peers.';
      case 'my-rooms':
        return "You haven't created or been assigned to manage any study rooms yet.";
      case 'recent':
        return "No recently joined rooms. Explore the directory and find a room to settle into.";
      case 'discover':
      default:
        return 'No study rooms available yet. Be the first to create one!';
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <header className={styles.header}>
          <h1 className={styles.title}>Study Rooms</h1>
          <p className={styles.subtitle}>
            Shared rooms for quiet, focused company. Pick one and settle in.
          </p>
        </header>

        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setIsCreateModalOpen(true)}
          data-testid="create-room-btn"
        >
          <Plus size={16} aria-hidden="true" />
          <span>Create Room</span>
        </button>
      </div>

      {/* Controls Bar: Tabs and Filters */}
      <div className={styles.controlsBar}>
        {/* Navigation Tabs */}
        <div className={styles.tabsRow} role="tablist" aria-label="Study room categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'discover'}
            className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Compass size={16} aria-hidden="true" />
            <span>Discover</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cohorts'}
            className={`${styles.tabBtn} ${activeTab === 'cohorts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('cohorts')}
          >
            <Users size={16} aria-hidden="true" />
            <span>My Cohorts</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my-rooms'}
            className={`${styles.tabBtn} ${activeTab === 'my-rooms' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('my-rooms')}
          >
            <User size={16} aria-hidden="true" />
            <span>My Rooms</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recent'}
            className={`${styles.tabBtn} ${activeTab === 'recent' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            <Clock size={16} aria-hidden="true" />
            <span>Recent</span>
          </button>
        </div>

        {/* Filters Row */}
        <div className={styles.filtersRow}>
          {/* Search Input */}
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search study rooms"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Additional Filter Selectors */}
          <div className={styles.filterGroup}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={styles.filterSelect}
              aria-label="Filter by language"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>

            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Available Seats Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content Grid / States */}
      {isLoading && rooms.length === 0 ? (
        <div className={styles.emptyState} aria-busy="true">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p>Finding study rooms...</p>
        </div>
      ) : isError && rooms.length === 0 ? (
        <div className={styles.errorState} role="alert">
          <p>{errorMessage || 'Failed to load study rooms.'}</p>
          <button
            type="button"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className={styles.retryBtn}
          >
            <RefreshCw size={14} className="inline mr-2" />
            <span>Try Again</span>
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{getEmptyStateMessage()}</p>
          {activeTab !== 'discover' && (
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => setActiveTab('discover')}
            >
              Browse Public Rooms
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {rooms.map((room) => (
              <RoomCard key={room.id || room.slug} room={room} />
            ))}
          </div>

          {/* Load More Button */}
          {nextCursor && (
            <div className={styles.loadMoreWrapper}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading more...' : 'Load more rooms'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}

export default StudyRoomScreen;
