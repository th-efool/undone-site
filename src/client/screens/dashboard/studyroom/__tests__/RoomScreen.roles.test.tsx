/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomScreen } from '../room/RoomScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-viewer', name: 'Test Viewer', image: null },
    },
    status: 'authenticated',
  }),
}));

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' = 'running';
  destination = { connect: vi.fn(), disconnect: vi.fn() };

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
    };
  }

  createBiquadFilter() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'lowpass',
      frequency: { value: 350 },
      Q: { value: 1 },
    };
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
    return Promise.resolve();
  });

  close = vi.fn().mockImplementation(async () => {
    return Promise.resolve();
  });
}

describe('RoomScreen role-dependent environment controls and dock persistence', () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    cleanup();
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    } else {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('renders read-only Room Info for member without customization options', async () => {
    await act(async () => {
      render(<RoomScreen roomSlug="library" viewAsOverride="member" />);
    });

    // 1. Top bar button shows "Room info", not "Customize room"
    expect(screen.getByRole('button', { name: 'Room information' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Customize room environment' })).toBeNull();

    // 2. Open room panel
    const infoBtn = screen.getByRole('button', { name: 'Room information' });
    fireEvent.click(infoBtn);

    // 3. Panel header is "Room Info"
    expect(screen.getByRole('heading', { name: 'Room Info' })).toBeTruthy();
    expect(screen.getByText('Only the host can change the room.')).toBeTruthy();

    // 4. Assert absence of "Set room music" and interactive inputs
    expect(screen.queryByRole('button', { name: 'Set room music' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('toggles bottom background customization dock when admin clicks Customize room', async () => {
    await act(async () => {
      render(<RoomScreen roomSlug="library" viewAsOverride="admin" />);
    });

    // 1. Initially bottom dock is closed
    expect(screen.queryByLabelText('Room backgrounds')).toBeNull();

    // 2. Top bar button shows "Customize room environment"
    const customizeBtn = screen.getByRole('button', { name: 'Customize room environment' });
    expect(customizeBtn).toBeTruthy();

    // 3. Click to open customization dock
    fireEvent.click(customizeBtn);

    // 4. Bottom background dock is now rendered
    expect(screen.getByLabelText('Room backgrounds')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close background picker' })).toBeTruthy();

    // 5. Clicking close button hides the dock again
    fireEvent.click(screen.getByRole('button', { name: 'Close background picker' }));
    expect(screen.queryByLabelText('Room backgrounds')).toBeNull();
  });

  it('persists the music player dock iframe across panel open/close transitions', async () => {
    await act(async () => {
      render(<RoomScreen roomSlug="library" viewAsOverride="admin" />);
    });

    // 1. Open Music modal from the timer widget and set a music source
    const musicBtn = screen.getByRole('button', { name: 'Room music' });
    fireEvent.click(musicBtn);

    const musicInput = screen.getByPlaceholderText('Paste a YouTube, Spotify, or playlist link');
    fireEvent.change(musicInput, { target: { value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to room' }));

    // 2. Iframe is mounted in bottom row
    const iframeNodeBefore = screen.getByTitle('Room music (YouTube)');
    expect(iframeNodeBefore).toBeTruthy();

    // 3. Close the music modal
    const closeMusicBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeMusicBtn);

    // 4. Query the iframe again: must be the EXACT SAME DOM NODE (persists, didn't remount)
    const iframeNodeAfterClose = screen.getByTitle('Room music (YouTube)');
    expect(iframeNodeAfterClose).toBe(iframeNodeBefore);

    // 5. Open another panel (e.g. Session panel)
    const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
    fireEvent.click(sessionBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();

    // 6. Iframe node still unchanged
    const iframeNodeAfterSessionOpen = screen.getByTitle('Room music (YouTube)');
    expect(iframeNodeAfterSessionOpen).toBe(iframeNodeBefore);
  });
});
