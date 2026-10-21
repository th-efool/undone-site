/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParticipantActionsMenu } from '../room/components/ParticipantActionsMenu';
import { RoomSettingsModal } from '../components/RoomSettingsModal';
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
      user: { id: 'user-viewer', name: 'Viewer User', image: null },
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
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
    };
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return { numberOfChannels: channels, length, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false };
  }
  createBiquadFilter() {
    return { connect: vi.fn(), disconnect: vi.fn(), type: 'lowpass', frequency: { value: 350 }, Q: { value: 1 } };
  }
  createOscillator() {
    return { connect: vi.fn(), disconnect: vi.fn(), type: 'sine', frequency: { setValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn() };
  }
  close = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
}

const originalAudioContext = window.AudioContext;
const originalFetch = global.fetch;

beforeEach(() => {
  (window as any).AudioContext = MockAudioContext;
  (window as any).webkitAudioContext = MockAudioContext;
});

afterEach(() => {
  cleanup();
  (window as any).AudioContext = originalAudioContext;
  (window as any).webkitAudioContext = originalAudioContext;
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe('Phase 5: Roles, Governance & Sharing UI', () => {
  describe('ParticipantActionsMenu', () => {
    it('does not render if canManageParticipants is false', () => {
      const { container } = render(
        <ParticipantActionsMenu
          roomSlug="dev-room"
          targetUserId="peer-1"
          targetName="Alice"
          targetRole="PARTICIPANT"
          canManageParticipants={false}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('does not render for the OWNER', () => {
      const { container } = render(
        <ParticipantActionsMenu
          roomSlug="dev-room"
          targetUserId="owner-1"
          targetName="Owner Bob"
          targetRole="OWNER"
          canManageParticipants={true}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('opens dropdown and allows promoting a participant to Host', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      const onSuccess = vi.fn();

      render(
        <ParticipantActionsMenu
          roomSlug="dev-room"
          targetUserId="peer-1"
          targetName="Alice"
          targetRole="PARTICIPANT"
          canManageParticipants={true}
          onActionSuccess={onSuccess}
        />
      );

      const trigger = screen.getByRole('button', { name: /moderation actions for alice/i });
      fireEvent.click(trigger);

      const makeHostBtn = screen.getByRole('menuitem', { name: /make host/i });
      await act(async () => {
        fireEvent.click(makeHostBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/studyroom/dev-room/controllers/peer-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ role: 'HOST' }),
        })
      );
      expect(onSuccess).toHaveBeenCalledWith('Promoted Alice to Host');
    });

    it('allows kicking a participant from the room', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      const onSuccess = vi.fn();

      render(
        <ParticipantActionsMenu
          roomSlug="dev-room"
          targetUserId="peer-2"
          targetName="Charlie"
          targetRole="PARTICIPANT"
          canManageParticipants={true}
          onActionSuccess={onSuccess}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /moderation actions for charlie/i }));

      const kickBtn = screen.getByRole('menuitem', { name: /remove \(kick\)/i });
      await act(async () => {
        fireEvent.click(kickBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/studyroom/dev-room/participants/peer-2/remove',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(onSuccess).toHaveBeenCalledWith('Removed Charlie from the room');
    });
  });

  describe('RoomSettingsModal tabs & governance', () => {
    const mockRoom = {
      id: 'room-1',
      slug: 'test-room',
      title: 'Test Focus Room',
      description: 'Focus and study',
      listing: 'LISTED' as const,
      status: 'OPEN' as const,
      capacity: 25,
      rules: 'Be quiet',
      tags: ['coding', 'focus'],
      language: 'en',
      revision: 2,
    };

    it('switches between General, Controllers, Transfer, and Audit tabs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ controllers: [], logs: [] }),
      });
      global.fetch = fetchMock;

      render(
        <RoomSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          room={mockRoom}
          isOwner={true}
        />
      );

      expect(screen.getByRole('tab', { name: /general/i }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByDisplayValue('Test Focus Room')).toBeTruthy();

      // Switch to Controllers tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: /controllers/i }));
      });
      expect(screen.getByText(/assign user as controller/i)).toBeTruthy();

      // Switch to Transfer tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: /transfer/i }));
      });
      expect(screen.getByText(/transfer ownership of this room/i)).toBeTruthy();

      // Switch to Audit tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: /audit log/i }));
      });
      expect(screen.getByText(/recent management history/i)).toBeTruthy();
    });

    it('allows assigning a new controller in Controllers tab', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ controllers: [] }),
        });
      });
      global.fetch = fetchMock;

      render(
        <RoomSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          room={mockRoom}
          isOwner={true}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: /controllers/i }));
      });

      const input = screen.getByPlaceholderText(/user id or username/i);
      fireEvent.change(input, { target: { value: 'target-user-123' } });

      const assignBtn = screen.getByRole('button', { name: /assign/i });
      await act(async () => {
        fireEvent.click(assignBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/studyroom/test-room/controllers/target-user-123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ role: 'HOST' }),
        })
      );
    });
  });

  describe('Pending Ownership Transfer Banner', () => {
    it('renders invitation banner when viewer is the designated transfer recipient and accepts', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (url.includes('/ownership-transfers/') && opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        if (url.includes('/api/studyroom/fireplace')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              room: { id: 'room-fp', slug: 'fireplace', title: 'Fireplace Room', capacity: 20 },
              capabilities: { canJoin: true, canEditRoom: false, canManageParticipants: false },
              userRole: 'PARTICIPANT',
              pendingTransfer: {
                id: 'transfer-99',
                recipientId: 'user-viewer',
                status: 'PENDING',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, roster: [] }),
        });
      });
      global.fetch = fetchMock;

      await act(async () => {
        render(<RoomScreen roomSlug="fireplace" />);
      });

      // The banner should appear
      expect(
        screen.getByText(/you have been invited to become the owner of this study room/i)
      ).toBeTruthy();

      const acceptBtn = screen.getByRole('button', { name: /accept ownership/i });
      await act(async () => {
        fireEvent.click(acceptBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/studyroom/fireplace/ownership-transfers/transfer-99/accept',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
