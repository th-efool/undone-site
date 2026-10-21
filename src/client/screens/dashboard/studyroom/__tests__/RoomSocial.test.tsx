/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RoomSocial from '../room/components/RoomSocial';
import type { RoomParticipantView, Viewer } from '../types';
import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';

let publicationHandler: ((data: unknown) => void) | null = null;
const mockSubscribe = vi.fn((_channel: string, handler?: (data: unknown) => void) => {
  if (handler) publicationHandler = handler;
  return vi.fn();
});

vi.mock('@/src/client/realtime', () => ({
  useRealtime: () => ({
    subscribe: mockSubscribe,
    status: 'connected',
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'viewer-1', name: 'Test User' },
    },
    status: 'authenticated',
  }),
}));

describe('RoomSocial component (Phase 7 Persistent Chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicationHandler = null;
  });

  afterEach(() => {
    cleanup();
  });

  const mockViewer: Viewer = {
    userId: 'viewer-1',
    displayName: 'Test User',
    avatarUrl: null,
    role: 'admin',
  };

  const mockParticipants: RoomParticipantView[] = [
    {
      userId: 'viewer-1',
      displayName: 'Test User',
      avatarUrl: null,
      joinedAt: Date.now(),
      publicGoal: null,
      isCurrentUser: true,
      isAdmin: true,
    },
    {
      userId: 'aarav',
      displayName: 'Aarav',
      avatarUrl: null,
      joinedAt: Date.now() - 60000,
      publicGoal: 'Reading · Chapter 4',
      isCurrentUser: false,
      isAdmin: false,
    },
  ];

  it('renders people list with host indicator and participant names without fabricated media indicators', () => {
    vi.spyOn(studyRoomRepository, 'getChannelMessages').mockResolvedValue([]);

    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
      />
    );

    expect(screen.getByText('People · 2')).toBeTruthy();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.getByText(/Host/)).toBeTruthy();
    expect(screen.getAllByText('Aarav').length).toBeGreaterThan(0);
    expect(screen.queryByTitle('Microphone muted')).toBeNull();
  });

  it('renders empty chat state for an empty room without fabricated default messages', async () => {
    vi.spyOn(studyRoomRepository, 'getChannelMessages').mockResolvedValue([]);

    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
        channelId="chan-123"
        streamGeneration={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No messages yet. Say hello!')).toBeTruthy();
    });

    // Ensure removed fabricated DEFAULT_MESSAGES are not present
    expect(
      screen.queryByText('just finished the 1st section this was actually fun 🚀')
    ).toBeNull();
  });

  it('fetches and renders persistent message history from database channel', async () => {
    vi.spyOn(studyRoomRepository, 'getChannelMessages').mockResolvedValue([
      {
        id: 'msg-1',
        content: 'Hello study room!',
        channelId: 'chan-123',
        authorId: 'aarav',
        messageSequence: 1,
        clientRequestId: null,
        replyToId: null,
        revision: 1,
        editedAt: null,
        deletedAt: null,
        deletionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: 'aarav',
          name: 'Aarav',
          image: null,
          username: 'aarav',
        },
      },
    ]);

    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
        channelId="chan-123"
        streamGeneration={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello study room!')).toBeTruthy();
      expect(screen.getAllByText('Aarav').length).toBeGreaterThan(0);
    });
  });

  it('sends message optimistically and updates on success', async () => {
    vi.spyOn(studyRoomRepository, 'getChannelMessages').mockResolvedValue([]);
    const sendSpy = vi.spyOn(studyRoomRepository, 'sendChannelMessage').mockResolvedValue({
      id: 'msg-canon-1',
      content: 'Taking a 5 minute break!',
      channelId: 'chan-123',
      authorId: 'viewer-1',
      messageSequence: 2,
      clientRequestId: 'req-test-123',
      replyToId: null,
      revision: 1,
      editedAt: null,
      deletedAt: null,
      deletionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: 'viewer-1',
        name: 'Test User',
        image: null,
        username: null,
      },
    });

    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
        channelId="chan-123"
        streamGeneration={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No messages yet. Say hello!')).toBeTruthy();
    });

    const input = screen.getByLabelText('Write a message');
    fireEvent.change(input, { target: { value: 'Taking a 5 minute break!' } });

    const form = input.closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        'chan-123',
        'Taking a 5 minute break!',
        expect.stringMatching(/^req-/)
      );
      expect(screen.getByText('Taking a 5 minute break!')).toBeTruthy();
    });
  });

  it('receives and appends incoming realtime message', async () => {
    vi.spyOn(studyRoomRepository, 'getChannelMessages').mockResolvedValue([]);

    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
        channelId="chan-123"
        streamGeneration={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No messages yet. Say hello!')).toBeTruthy();
    });

    // Simulate publication from realtime stream
    await act(async () => {
      publicationHandler?.({
        type: 'message.created',
        payload: {
          id: 'msg-realtime-1',
          content: 'Incoming message from peer',
          channelId: 'chan-123',
          authorId: 'aarav',
          messageSequence: 3,
          clientRequestId: null,
          replyToId: null,
          revision: 1,
          editedAt: null,
          deletedAt: null,
          deletionReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: {
            id: 'aarav',
            name: 'Aarav',
            image: null,
            username: 'aarav',
          },
        },
      });
    });

    expect(screen.getByText('Incoming message from peer')).toBeTruthy();
  });
});
