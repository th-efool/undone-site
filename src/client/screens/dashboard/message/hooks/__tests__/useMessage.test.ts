// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMessage } from '../useMessage';
import { messagesRepository } from '@/src/client/repositories/messagesRepository';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-auth-1', name: 'Tester User' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/client/realtime', () => ({
  useRealtime: () => null,
}));

vi.mock('@/src/client/repositories/messagesRepository', () => ({
  messagesRepository: {
    fetchEnrolledCommunities: vi.fn(),
    fetchChannelMessages: vi.fn(),
    sendChannelMessage: vi.fn(),
  },
}));

describe('useMessage Hook - Phase 5 Community Realtime Integration', () => {
  const sampleCommunities = [
    {
      cohortId: 'cohort-alpha',
      cohortTitle: 'Alpha Cohort',
      coverImage: '/cover-a.png',
      role: 'EXPLORER',
      communityId: 'comm-alpha',
      chatEnabled: true,
      channels: [
        { id: 'chan-1', name: 'general' },
        { id: 'chan-2', name: 'random' },
      ],
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(messagesRepository.fetchEnrolledCommunities).mockResolvedValue(sampleCommunities);
    vi.mocked(messagesRepository.fetchChannelMessages).mockResolvedValue([]);
  });

  it('loads real enrolled communities on mount without mock fallback', async () => {
    const { result } = renderHook(() => useMessage());

    await waitFor(() => {
      expect(result.current.isLoadingCommunities).toBe(false);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe('cohort-alpha');
    expect(result.current.conversations[0].name).toBe('Alpha Cohort');
    expect(result.current.conversations[0].preview).toBe('#general');

    // No fake data in dashboard cards
    expect(result.current.liveSessions).toEqual([]);
    expect(result.current.upcomingEvents).toEqual([]);
    expect(result.current.friendsOnline).toEqual([]);
  });

  it('selects a community, derives active channel and chat model', async () => {
    const { result } = renderHook(() => useMessage());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.selectConversation(result.current.conversations[0]);
    });

    expect(result.current.view).toBe('community');
    expect(result.current.selectedCommunityId).toBe('cohort-alpha');
    expect(result.current.communityChat.id).toBe('cohort-alpha');
    expect(result.current.communityChat.selectedChannel).toBe('chan-1');
    expect(result.current.communityChat.channels).toEqual([
      { id: 'chan-1', label: '# general' },
      { id: 'chan-2', label: '# random' },
    ]);
  });

  it('switches selected channel within the active community', async () => {
    const { result } = renderHook(() => useMessage());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.selectConversation(result.current.conversations[0]);
    });

    act(() => {
      result.current.actions.setSelectedChannel('chan-2');
    });

    expect(result.current.communityChat.selectedChannel).toBe('chan-2');
  });

  it('sends community message through messagesRepository with clientRequestId and optimistic UI', async () => {
    const { result } = renderHook(() => useMessage());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.selectConversation(result.current.conversations[0]);
    });

    act(() => {
      result.current.actions.setDraft('cohort-alpha', 'Hello cohort peers!');
    });

    const canonicalMsg = {
      id: 'server-msg-123',
      content: 'Hello cohort peers!',
      channelId: 'chan-1',
      authorId: 'user-auth-1',
      messageSequence: 1,
      clientRequestId: 'test-req-id',
      replyToId: null,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: 'user-auth-1',
        name: 'Tester User',
        image: null,
        username: 'tester',
      },
    };

    vi.mocked(messagesRepository.sendChannelMessage).mockResolvedValue(canonicalMsg);

    await act(async () => {
      await result.current.actions.sendCommunityMessage('cohort-alpha');
    });

    expect(messagesRepository.sendChannelMessage).toHaveBeenCalledWith(
      'chan-1',
      expect.objectContaining({
        content: 'Hello cohort peers!',
        clientRequestId: expect.any(String),
      })
    );

    // Canonical message reflected in timeline
    expect(result.current.communityChat.messages).toHaveLength(1);
    expect(result.current.communityChat.messages[0].id).toBe('server-msg-123');
    expect(result.current.communityChat.messages[0].body).toBe('Hello cohort peers!');
    expect(result.current.communityChat.messages[0].status).toBe('sent');
  });

  it('suppresses message sending when no channel exists', async () => {
    vi.mocked(messagesRepository.fetchEnrolledCommunities).mockResolvedValue([
      {
        cohortId: 'cohort-no-channels',
        cohortTitle: 'No Channels Cohort',
        coverImage: null,
        role: 'EXPLORER',
        communityId: 'comm-empty',
        chatEnabled: true,
        channels: [],
      },
    ]);

    const { result } = renderHook(() => useMessage());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.selectConversation(result.current.conversations[0]);
      result.current.actions.setDraft('cohort-no-channels', 'Trying to send without channel');
    });

    await act(async () => {
      await result.current.actions.sendCommunityMessage('cohort-no-channels');
    });

    expect(messagesRepository.sendChannelMessage).not.toHaveBeenCalled();
    expect(result.current.communityChat.messages).toHaveLength(0);
  });
});
