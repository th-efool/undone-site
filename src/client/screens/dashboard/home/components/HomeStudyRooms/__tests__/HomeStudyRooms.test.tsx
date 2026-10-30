/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeStudyRooms } from '../HomeStudyRooms';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <span data-testid="mock-img" data-src={props.src} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('HomeStudyRooms', () => {
  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<HomeStudyRooms />);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Loading studyrooms…')).toBeTruthy();
  });

  it('renders honest empty state when no rooms are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rooms: [] }),
      }),
    );
    render(<HomeStudyRooms />);

    await waitFor(() => {
      expect(screen.getByText('No studyrooms available')).toBeTruthy();
    });
    const link = screen.getByRole('link', { name: 'Browse studyrooms' });
    expect(link.getAttribute('href')).toBe('/studyroom');
  });

  it('renders error state and retry button on fetch failure, retrying when clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rooms: [
            {
              id: 'r1',
              slug: 'library',
              title: 'Quiet Library',
              description: 'Silent reading',
              thumbnail: '/lib.jpg',
              onlineCount: 4,
              capacity: 25,
              status: 'OPEN',
            },
          ],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);
    render(<HomeStudyRooms />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Could not load studyrooms.')).toBeTruthy();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Quiet Library')).toBeTruthy();
      expect(screen.getByText('4 online')).toBeTruthy();
    });
  });

  it('renders real studyroom cards with actual slug links and truthful onlineCount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          rooms: [
            {
              id: 'r1',
              slug: 'fireplace',
              title: 'Cozy Fireplace',
              description: 'Warm study beats',
              thumbnail: '/fire.jpg',
              onlineCount: 2,
              capacity: 30,
              status: 'OPEN',
            },
          ],
        }),
      }),
    );
    render(<HomeStudyRooms />);

    await waitFor(() => {
      expect(screen.getByText('Cozy Fireplace')).toBeTruthy();
    });

    const link = screen.getByRole('link', { name: /Cozy Fireplace study room, 2 online/i });
    expect(link.getAttribute('href')).toBe('/studyroom/fireplace');
    expect(screen.getByText('2 online')).toBeTruthy();
    expect(screen.getByText('Warm study beats')).toBeTruthy();
    // Does NOT say "Active studyrooms"
    expect(screen.queryByText('Active studyrooms')).toBeNull();
  });
});
