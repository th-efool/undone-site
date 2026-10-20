/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StudyRoomScreen from '../StudyRoomScreen';
import { ROOM_CATALOG } from '../data/roomCatalog';
import { MOCK_ROSTERS } from '../data/mockRosters';

describe('StudyRoomScreen discovery component', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
  });

  it('renders the discovery header and three curated study rooms', () => {
    render(<StudyRoomScreen />);

    // 1. Heading and subtitle
    expect(screen.getByRole('heading', { level: 1, name: 'Study Rooms' })).toBeTruthy();
    expect(
      screen.getByText('Shared rooms for quiet, focused company. Pick one and settle in.')
    ).toBeTruthy();

    // 2. Three rooms with titles, atmospheres, and scoped counts
    ROOM_CATALOG.forEach((room) => {
      const card = screen.getByTestId(`room-card-${room.slug}`);
      expect(card).toBeTruthy();

      expect(within(card).getByRole('heading', { level: 2, name: room.title })).toBeTruthy();
      expect(within(card).getByText(room.atmosphere)).toBeTruthy();

      const enterLink = card.querySelector('a');
      expect(enterLink).toBeTruthy();
      expect(enterLink?.getAttribute('href')).toBe(`/studyroom/${room.slug}`);

      // Count matching MOCK_ROSTERS
      const expectedCount = MOCK_ROSTERS[room.slug]?.length ?? 0;
      expect(within(card).getByText(`${expectedCount} studying now · demo`)).toBeTruthy();
    });
  });

  it('does not make any network fetch calls (fully static discovery)', () => {
    render(<StudyRoomScreen />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('contains no fake skeleton or shimmer loading classes', () => {
    const { container } = render(<StudyRoomScreen />);
    const skeletonElements = container.querySelectorAll('[class*="skeleton"], [class*="shimmer"]');
    expect(skeletonElements).toHaveLength(0);
  });

  it('hides the image on error while preserving room card and fallback base', () => {
    render(<StudyRoomScreen />);

    // Find the library image
    const libraryCard = screen.getByTestId('room-card-library');
    const image = libraryCard.querySelector('img');
    expect(image).toBeTruthy();

    // Fire image error event
    fireEvent.error(image!);

    // Image is now hidden / removed from card DOM
    expect(libraryCard.querySelector('img')).toBeNull();

    // Card content and link remain fully intact
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeTruthy();
    const link = libraryCard.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/studyroom/library');
  });
});
