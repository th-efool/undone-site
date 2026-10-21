/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, within, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomScreen from '../StudyRoomScreen';
import type { StudyRoomCardDTO } from '@/src/shared/studyroom/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/studyroom',
  useSearchParams: () => new URLSearchParams(),
}));

const mockRooms: StudyRoomCardDTO[] = [
  {
    id: 'room-1',
    slug: 'library',
    title: 'Library',
    description: 'Quiet sanctuary with gentle rustling pages',
    thumbnail: '/images/studyrooms/scenes/library.webp',
    visualPresetId: 'library',
    status: 'OPEN',
    listing: 'LISTED',
    scopeKind: 'STANDALONE',
    cohortId: null,
    cohortTitle: null,
    owner: { id: 'u1', name: 'Alice', username: 'alice', image: null },
    onlineCount: 4,
    capacity: 25,
    tags: ['quiet', 'books'],
    language: 'en',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  },
  {
    id: 'room-2',
    slug: 'fireplace',
    title: 'Fireplace',
    description: 'Warm hearth and crackling embers',
    thumbnail: '/images/studyrooms/scenes/fireplace.webp',
    visualPresetId: 'cozy-fireplace',
    status: 'OPEN',
    listing: 'LISTED',
    scopeKind: 'STANDALONE',
    cohortId: null,
    cohortTitle: null,
    owner: { id: 'u2', name: 'Bob', username: 'bob', image: null },
    onlineCount: 2,
    capacity: 20,
    tags: ['warm', 'night'],
    language: 'en',
    createdAt: '2026-10-20T01:00:00.000Z',
    updatedAt: '2026-10-20T01:00:00.000Z',
  },
];

describe('StudyRoomScreen discovery component (Phase 3)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
  });

  it('renders the discovery header, tabs, create button, and fetches query-backed rooms', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rooms: mockRooms, nextCursor: null }),
    } as any);

    render(<StudyRoomScreen />);

    // 1. Heading and subtitle
    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    expect(
      screen.getByText('Shared rooms for quiet, focused company. Pick one and settle in.')
    ).toBeTruthy();

    // 2. Create room button and tabs
    expect(screen.getByTestId('create-room-btn')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /discover/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /my cohorts/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /my rooms/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeTruthy();

    // 3. Rooms rendered after fetch
    await waitFor(() => {
      expect(screen.getByTestId('room-card-library')).toBeTruthy();
      expect(screen.getByTestId('room-card-fireplace')).toBeTruthy();
    });

    const libraryCard = screen.getByTestId('room-card-library');
    expect(within(libraryCard).getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy();
    expect(within(libraryCard).getByText('4 / 25 studying now')).toBeTruthy();
    expect(within(libraryCard).getByText('Public')).toBeTruthy();
  });

  it('switches tabs and triggers fetch with updated tab query parameter', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: mockRooms, nextCursor: null }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: [], nextCursor: null }),
      } as any);

    render(<StudyRoomScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-library')).toBeTruthy();
    });

    // Click My Cohorts tab
    const cohortsTab = screen.getByRole('tab', { name: /my cohorts/i });
    fireEvent.click(cohortsTab);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('tab=cohorts'));
    });
  });

  it('renders empty state when no rooms are returned', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rooms: [], nextCursor: null }),
    } as any);

    render(<StudyRoomScreen />);

    await waitFor(() => {
      expect(screen.getByText('No study rooms available yet. Be the first to create one!')).toBeTruthy();
    });
  });

  it('renders error state and allows retry on fetch failure', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: mockRooms, nextCursor: null }),
      } as any);

    render(<StudyRoomScreen />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-library')).toBeTruthy();
    });
  });

  it('opens CreateRoomModal when Create Room button is clicked', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rooms: mockRooms, nextCursor: null }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cohorts: [{ id: 'cohort-1', title: 'Chem 101' }] }),
      } as any);

    render(<StudyRoomScreen />);

    const createBtn = screen.getByTestId('create-room-btn');
    fireEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Create Study Room' })).toBeTruthy();
  });

  it('hides image on error while preserving room card and fallback base', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rooms: mockRooms, nextCursor: null }),
    } as any);

    render(<StudyRoomScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-library')).toBeTruthy();
    });

    const libraryCard = screen.getByTestId('room-card-library');
    const image = libraryCard.querySelector('img');
    expect(image).toBeTruthy();

    fireEvent.error(image!);

    expect(libraryCard.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy();
    const link = libraryCard.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/studyroom/library');
  });
});
