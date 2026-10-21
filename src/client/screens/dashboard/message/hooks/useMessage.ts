'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { conversationFilters, sidebarTabs } from '../constants';
import {
  messagesRepository,
  type EnrolledCommunityDTO,
  type ConversationSummaryDTO,
  type CanonicalMessagePayload,
} from '@/src/client/repositories/messagesRepository';
import {
  type ChatAttachmentKind,
  type CommunityMessage,
  type ConversationFilter,
  type ConversationPreview,
  type DMConversationModel,
  type DMMessage,
  type MessageView,
  type ReplyContext,
  type SidebarTab,
} from '../models';
import {
  formatMessageTime,
  mapCanonicalMessageToCommunityMessage,
  mapCommunityDtoToCommunityChat,
  mapCommunityDtoToConversationPreview,
} from '../utils/communityMapping';
import { useRealtime } from '@/src/client/realtime';

const DRAFTS_STORAGE_KEY = 'sidequest-message-drafts';

function safeUseSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' };
  }
}

function safeUseRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

function matchesSearch(conversation: ConversationPreview, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [conversation.name, conversation.sender, conversation.preview].some((value) =>
    value?.toLowerCase().includes(normalized)
  );
}

function readDrafts(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(DRAFTS_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useMessage() {
  const { data: session } = safeUseSession();
  const currentUserId = session?.user?.id ?? null;
  const realtime = safeUseRealtime();

  const [selectedView, setSelectedView] = useState<MessageView>('landing');
  const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>('community');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedDMId, setSelectedDMId] = useState<string | null>(null);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

  // Communities loaded from real SQL-backed API
  const [communities, setCommunities] = useState<EnrolledCommunityDTO[]>([]);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState<boolean>(true);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // Conversations (Direct / Group) loaded from real SQL-backed API
  const [conversationsList, setConversationsList] = useState<ConversationSummaryDTO[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);

  // Selected channel per community ID: Record<communityId, channelId>
  const [selectedChannels, setSelectedChannels] = useState<Record<string, string>>({});

  // Messages by channel ID: Record<channelId, CommunityMessage[]>
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, CommunityMessage[]>>({});
  const [loadingChannels, setLoadingChannels] = useState<Record<string, boolean>>({});

  // Drafts stored per conversation/community ID (Drafts only, never accepted history)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => readDrafts());

  // In-memory DM messages for DM tab (Phase 6 connects to SQL via messagesByChannel)
  const [dmMessages, setDmMessages] = useState<Record<string, DMMessage[]>>({});

  // Pin & Mute state
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('sidequest-pinned') ?? '[]'));
    } catch {
      return new Set();
    }
  });

  const [mutedConversations, setMutedConversations] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('sidequest-muted') ?? '{}');
    } catch {
      return {};
    }
  });

  const [markedAsRead, setMarkedAsRead] = useState<Set<string>>(new Set());
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsernames, setTypingUsernames] = useState<string[]>([]);

  // Active community & channel derivation
  const currentCommunity = useMemo(
    () => communities.find((c) => c.cohortId === selectedCommunityId) ?? null,
    [communities, selectedCommunityId]
  );

  const activeChannelId = useMemo(() => {
    if (!currentCommunity) return null;
    const explicit = selectedChannels[currentCommunity.cohortId];
    if (explicit && currentCommunity.channels.some((c) => c.id === explicit)) {
      return explicit;
    }
    return currentCommunity.channels[0]?.id ?? null;
  }, [currentCommunity, selectedChannels]);

  // Active conversation derivation
  const activeConversation = useMemo(() => {
    return conversationsList.find((c) => c.id === selectedDMId) ?? null;
  }, [conversationsList, selectedDMId]);

  const activeDMChannelId = useMemo(() => {
    return activeConversation?.channelId ?? null;
  }, [activeConversation]);

  // Load real enrolled communities on mount or session change
  useEffect(() => {
    let active = true;
    setIsLoadingCommunities(true);
    setCommunityError(null);

    messagesRepository
      .fetchEnrolledCommunities()
      .then((data) => {
        if (!active) return;
        setCommunities(data);
        setIsLoadingCommunities(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load communities:', err);
        setCommunityError(err instanceof Error ? err.message : 'Failed to load communities');
        setCommunities([]);
        setIsLoadingCommunities(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId]);

  // Load real conversations on mount or session change
  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const data =
        typeof messagesRepository.fetchConversations === 'function'
          ? await messagesRepository.fetchConversations()
          : [];
      setConversationsList(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversationsList([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!currentUserId || typeof messagesRepository.fetchConversations !== 'function') return;
    try {
      const data = await messagesRepository.fetchConversations();
      setConversationsList((prev) => {
        if (prev.length !== data.length) return data;
        let changed = false;
        for (let i = 0; i < data.length; i++) {
          const a = prev[i];
          const b = data[i];
          if (
            !a ||
            a.id !== b.id ||
            a.unreadCount !== b.unreadCount ||
            a.lastMessage?.id !== b.lastMessage?.id ||
            a.updatedAt !== b.updatedAt
          ) {
            changed = true;
            break;
          }
        }
        return changed ? data : prev;
      });
    } catch (err) {
      console.warn('Failed to refresh conversations:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadConversations();

    const interval = setInterval(() => {
      refreshConversations();
    }, 3500);

    const onFocus = () => refreshConversations();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadConversations, refreshConversations]);

  // URL query parameter synchronization
  useEffect(() => {
    const syncCommunityFromUrl = () => {
      const communityId = new URLSearchParams(window.location.search).get('community');
      if (!communityId) return;

      setSelectedSidebarTab('community');
      setSelectedCommunityId(communityId);
      setSelectedView('community');
    };

    syncCommunityFromUrl();
    window.addEventListener('popstate', syncCommunityFromUrl);
    return () => window.removeEventListener('popstate', syncCommunityFromUrl);
  }, []);

  // Save drafts to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
      } catch (e) {
        console.warn('Could not save drafts to localStorage:', e);
      }
    }
  }, [drafts]);

  // Save pin & mute state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidequest-pinned', JSON.stringify([...pinnedConversations]));
    }
  }, [pinnedConversations]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidequest-muted', JSON.stringify(mutedConversations));
    }
  }, [mutedConversations]);

  // Active channel based on current view/selection
  const currentActiveChannelId = useMemo(() => {
    if (selectedSidebarTab === 'community') return activeChannelId;
    if (selectedSidebarTab === 'dm') return activeDMChannelId;
    return null;
  }, [selectedSidebarTab, activeChannelId, activeDMChannelId]);

  // Fetch channel messages on selection and poll in background for live peer updates
  useEffect(() => {
    if (!currentActiveChannelId) return;

    let active = true;

    // Initial fetch if channel messages not yet cached
    if (messagesByChannel[currentActiveChannelId] === undefined) {
      setLoadingChannels((prev) => ({ ...prev, [currentActiveChannelId]: true }));
      messagesRepository
        .fetchChannelMessages(currentActiveChannelId, 50)
        .then((rawMessages) => {
          if (!active) return;
          const mapped = rawMessages.map((m) =>
            mapCanonicalMessageToCommunityMessage(m, currentUserId, 'sent')
          );
          setMessagesByChannel((prev) => ({
            ...prev,
            [currentActiveChannelId]: mapped,
          }));
        })
        .catch((err) => {
          console.error(`Failed to load messages for channel ${currentActiveChannelId}:`, err);
          if (active) {
            setMessagesByChannel((prev) => ({
              ...prev,
              [currentActiveChannelId]: [],
            }));
          }
        })
        .finally(() => {
          if (active) {
            setLoadingChannels((prev) => ({ ...prev, [currentActiveChannelId]: false }));
          }
        });
    }

    // Background poll for newly arrived messages every 2500ms
    const pollMessages = async () => {
      if (!active) return;
      try {
        const rawMessages = await messagesRepository.fetchChannelMessages(currentActiveChannelId, 50);
        if (!active) return;

        setMessagesByChannel((prev) => {
          const existing = prev[currentActiveChannelId] ?? [];
          const pendingOptimistic = existing.filter(
            (m) => m.status === 'sending' || m.status === 'failed'
          );

          const existingIds = new Set(existing.map((m) => m.id));
          const confirmedClientReqIds = new Set(
            rawMessages.map((r) => r.clientRequestId).filter(Boolean)
          );

          const hasNewMessages = rawMessages.some((r) => !existingIds.has(r.id));
          const optimisticResolved = pendingOptimistic.some((p) => confirmedClientReqIds.has(p.id));

          if (!hasNewMessages && !optimisticResolved) {
            return prev;
          }

          const mapped = rawMessages.map((m) =>
            mapCanonicalMessageToCommunityMessage(m, currentUserId, 'sent')
          );
          const remainingPending = pendingOptimistic.filter(
            (p) => !confirmedClientReqIds.has(p.id)
          );

          return {
            ...prev,
            [currentActiveChannelId]: [...mapped, ...remainingPending],
          };
        });
      } catch (err) {
        console.warn(`Background poll failed for channel ${currentActiveChannelId}:`, err);
      }
    };

    const interval = setInterval(pollMessages, 2500);
    const onFocus = () => pollMessages();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentActiveChannelId, currentUserId]);

  // Read watermark synchronization: monotonically advances when active channel messages are visible
  const lastWatermarkRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!currentActiveChannelId) return;
    const msgs = messagesByChannel[currentActiveChannelId];
    if (!msgs || msgs.length === 0) return;

    const maxSeq = msgs.reduce((max, m) => Math.max(max, m.messageSequence ?? 0), 0);
    const prevSynced = lastWatermarkRef.current[currentActiveChannelId] ?? 0;

    if (maxSeq > prevSynced) {
      lastWatermarkRef.current[currentActiveChannelId] = maxSeq;
      messagesRepository.updateReadWatermark(currentActiveChannelId, maxSeq).catch((err) => {
        console.warn('Failed to sync read watermark:', err);
      });
    }
  }, [currentActiveChannelId, messagesByChannel]);

  // Realtime subscription via Centrifugo for active channel / conversation
  useEffect(() => {
    if (!realtime) return;

    let topic: string | null = null;
    if (selectedSidebarTab === 'community' && activeChannelId) {
      topic = `community:${activeChannelId}:g1`;
    } else if (selectedSidebarTab === 'dm' && activeConversation) {
      const prefix = activeConversation.kind === 'GROUP' ? 'group' : 'dm';
      topic = `${prefix}:${activeConversation.id}:g${activeConversation.accessGeneration || 1}`;
    }

    if (!topic) return;

    const unsubscribe = realtime.subscribe(topic, (publication: any) => {
      const raw = publication?.data ?? publication?.payload ?? publication;
      if (!raw) return;

      // 1. Ephemeral typing signals
      if (raw.type === 'typing.signal' || raw.payload?.type === 'typing.signal') {
        const signal = raw.payload?.payload || raw.payload || raw;
        if (signal.userId && signal.userId !== currentUserId) {
          const userName = signal.userName || 'Someone';
          if (signal.isTyping) {
            setTypingUsernames((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
            setTimeout(() => {
              setTypingUsernames((prev) => prev.filter((u) => u !== userName));
            }, signal.expiresInMs || 5000);
          } else {
            setTypingUsernames((prev) => prev.filter((u) => u !== userName));
          }
        }
        return;
      }

      // 2. Realtime reaction update
      if (raw.type === 'message.reaction_updated') {
        const reactData = raw.payload;
        if (!reactData || !reactData.messageId) return;
        const targetChannel = currentActiveChannelId;
        if (!targetChannel) return;

        setMessagesByChannel((prev) => {
          const currentList = prev[targetChannel] ?? [];
          return {
            ...prev,
            [targetChannel]: currentList.map((m) => {
              if (m.id !== reactData.messageId) return m;
              return {
                ...m,
                reactions: reactData.reactions?.map((r: any) => ({
                  emoji: r.emoji,
                  count: r.count,
                  reactedByMe: r.reactedByMe ?? (r.userIds ? r.userIds.includes(currentUserId) : false),
                })) ?? [],
              };
            }),
          };
        });
        return;
      }

      // 3. Realtime message edited
      if (raw.type === 'message.edited') {
        const editedMsg = raw.payload as CanonicalMessagePayload;
        if (!editedMsg || !editedMsg.id) return;
        const targetChannel = editedMsg.channelId || currentActiveChannelId;
        if (!targetChannel) return;

        setMessagesByChannel((prev) => {
          const currentList = prev[targetChannel] ?? [];
          return {
            ...prev,
            [targetChannel]: currentList.map((m) => {
              if (m.id !== editedMsg.id) return m;
              return {
                ...m,
                body: editedMsg.content,
                badge: 'edited',
              };
            }),
          };
        });
        return;
      }

      // 4. Realtime message deleted
      if (raw.type === 'message.deleted') {
        const deletedMsg = raw.payload as CanonicalMessagePayload;
        if (!deletedMsg || !deletedMsg.id) return;
        const targetChannel = deletedMsg.channelId || currentActiveChannelId;
        if (!targetChannel) return;

        setMessagesByChannel((prev) => {
          const currentList = prev[targetChannel] ?? [];
          return {
            ...prev,
            [targetChannel]: currentList.map((m) => {
              if (m.id !== deletedMsg.id) return m;
              return {
                ...m,
                body: '[This message was deleted]',
                badge: 'deleted',
              };
            }),
          };
        });
        return;
      }

      // 5. Default / message.created
      const canonicalMsg = (raw.payload && raw.type === 'message.created' ? raw.payload : raw) as CanonicalMessagePayload;
      if (!canonicalMsg || !canonicalMsg.id) return;

      const targetChannelId = canonicalMsg.channelId || currentActiveChannelId;
      if (!targetChannelId) return;
      const clientReqId = canonicalMsg.clientRequestId;

      setMessagesByChannel((prev) => {
        const currentList = prev[targetChannelId] ?? [];

        // 1. Reconcile optimistic message by clientRequestId
        if (clientReqId && currentList.some((m) => m.id === clientReqId)) {
          return {
            ...prev,
            [targetChannelId]: currentList.map((m) =>
              m.id === clientReqId
                ? mapCanonicalMessageToCommunityMessage(canonicalMsg, currentUserId, 'sent')
                : m
            ),
          };
        }

        // 2. Reconcile / deduplicate by canonical id
        if (currentList.some((m) => m.id === canonicalMsg.id)) {
          return prev;
        }

        // 3. Append new publication
        const newMsg = mapCanonicalMessageToCommunityMessage(canonicalMsg, currentUserId, 'sent');
        return {
          ...prev,
          [targetChannelId]: [...currentList, newMsg],
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [realtime, selectedSidebarTab, activeChannelId, activeConversation, currentActiveChannelId, currentUserId]);

  // Conversations list
  const communityConversations = useMemo<ConversationPreview[]>(() => {
    return communities.map((c) =>
      mapCommunityDtoToConversationPreview(c, c.cohortId === selectedCommunityId)
    );
  }, [communities, selectedCommunityId]);

  const dmConversations = useMemo<ConversationPreview[]>(() => {
    return conversationsList.map((conv) => {
      const otherUser = conv.otherParticipant;
      const title =
        conv.kind === 'DIRECT'
          ? (otherUser?.name || otherUser?.username || 'Direct Message')
          : conv.title;
      const avatar = otherUser?.image || '/undone-logo.svg';

      return {
        id: conv.id,
        kind: 'dm',
        name: title,
        avatar,
        sender: conv.lastMessage?.authorName || '',
        preview:
          conv.lastMessage?.content ||
          (conv.kind === 'GROUP' ? `${conv.participantCount} members` : 'No messages yet'),
        timestamp: conv.lastMessage ? formatMessageTime(conv.lastMessage.createdAt) : '',
        unreadCount: conv.unreadCount ?? 0,
        statusLabel: conv.kind === 'GROUP' ? `${conv.participantCount} members` : undefined,
      };
    });
  }, [conversationsList]);

  const conversations = useMemo(() => {
    const source = selectedSidebarTab === 'community' ? communityConversations : dmConversations;
    const now = Date.now();

    const activeMuted = Object.fromEntries(
      Object.entries(mutedConversations).filter(([, until]) => typeof until === 'number' && until > now)
    );

    return source
      .filter((item) => {
        if (conversationFilter === 'unread') return Boolean(item.unreadCount);
        if (conversationFilter === 'mentions') return Boolean(item.hasMention);
        if (conversationFilter === 'pinned') return pinnedConversations.has(item.id);
        return true;
      })
      .filter((item) => matchesSearch(item, searchQuery))
      .sort((a, b) => {
        const aPinned = pinnedConversations.has(a.id) ? 0 : 1;
        const bPinned = pinnedConversations.has(b.id) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;
        return source.indexOf(a) - source.indexOf(b);
      })
      .map((item) => {
        const isMarkedRead = markedAsRead.has(item.id);
        return {
          ...item,
          selected:
            item.kind === 'community' ? item.id === selectedCommunityId : item.id === selectedDMId,
          mutedUntil: activeMuted[item.id] ?? null,
          unreadCount: isMarkedRead ? 0 : item.unreadCount,
        };
      });
  }, [
    selectedSidebarTab,
    communityConversations,
    dmConversations,
    conversationFilter,
    pinnedConversations,
    searchQuery,
    mutedConversations,
    markedAsRead,
    selectedCommunityId,
    selectedDMId,
  ]);

  // View models
  const communityChat = useMemo(() => {
    if (!currentCommunity) {
      return {
        id: selectedCommunityId ?? '',
        name: 'Select a Community',
        avatar: '/undone-logo.svg',
        description: 'Choose a community from the sidebar to view channels.',
        onlineCount: 0,
        createdBy: '',
        createdAt: '',
        members: [],
        channels: [],
        selectedChannel: '',
        pinnedAnnouncement: { author: '', title: '', actionLabel: '' },
        messages: [],
        pinnedMessages: [],
        media: [],
        events: [],
      };
    }

    const baseChat = mapCommunityDtoToCommunityChat(currentCommunity, activeChannelId ?? undefined);
    const channelMsgs = activeChannelId ? (messagesByChannel[activeChannelId] ?? []) : [];

    return {
      ...baseChat,
      messages: channelMsgs,
    };
  }, [currentCommunity, activeChannelId, messagesByChannel, selectedCommunityId]);

  const dmConversation = useMemo<DMConversationModel>(() => {
    if (!activeConversation) {
      return {
        id: selectedDMId ?? '',
        user: {
          id: selectedDMId ?? '',
          name: 'Direct Message',
          avatar: '/undone-logo.svg',
          online: false,
          role: 'Learner',
          company: 'SideQuest',
          bio: '',
        },
        messages: [],
        resources: [],
        notifications: { enabled: true },
      };
    }

    const channelMsgs = activeConversation.channelId
      ? (messagesByChannel[activeConversation.channelId] ?? [])
      : [];

    const mappedMessages: DMMessage[] = channelMsgs.map((m) => ({
      id: m.id,
      type: m.author.id === currentUserId ? 'outgoing' : 'incoming',
      text: m.body || '',
      timestamp: m.timestamp,
      status: m.status === 'failed' ? 'failed' : m.status === 'sending' ? 'sending' : 'sent',
      replyTo: m.replyTo,
      dateLabel: m.dateLabel,
    }));

    const otherUser = activeConversation.otherParticipant;
    const title =
      activeConversation.kind === 'DIRECT'
        ? (otherUser?.name || otherUser?.username || 'Direct Message')
        : activeConversation.title;

    return {
      id: activeConversation.id,
      user: {
        id: otherUser?.id || activeConversation.id,
        name: title,
        avatar: otherUser?.image || '/undone-logo.svg',
        online: false,
        role: activeConversation.kind === 'GROUP' ? 'Group DM' : 'Direct Message',
        company:
          activeConversation.kind === 'GROUP'
            ? `${activeConversation.participantCount} members`
            : 'SideQuest',
        bio: otherUser?.username ? `@${otherUser.username}` : '',
      },
      messages: mappedMessages,
      resources: [],
      notifications: { enabled: true },
    };
  }, [activeConversation, selectedDMId, messagesByChannel, currentUserId]);

  // Navigation & Actions
  const selectConversation = useCallback((conversation: ConversationPreview) => {
    if (conversation.kind === 'community') {
      setSelectedCommunityId(conversation.id);
      setSelectedView('community');
      return;
    }
    setSelectedDMId(conversation.id);
    setSelectedView('dm');
    setConversationsList((prev) =>
      prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const backToLanding = useCallback(() => {
    setSelectedView('landing');
  }, []);

  const setSelectedChannel = useCallback(
    (channelId: string) => {
      if (!selectedCommunityId) return;
      setSelectedChannels((prev) => ({
        ...prev,
        [selectedCommunityId]: channelId,
      }));
    },
    [selectedCommunityId]
  );

  const lastTypingSignalTime = useRef<number>(0);
  const sendTypingSignal = useCallback(
    (isTypingState: boolean) => {
      if (!currentActiveChannelId) return;
      const now = Date.now();
      if (isTypingState && now - lastTypingSignalTime.current < 2000) return;
      lastTypingSignalTime.current = now;

      if (typeof messagesRepository.sendTypingSignal === 'function') {
        messagesRepository.sendTypingSignal(currentActiveChannelId, isTypingState).catch((err) => {
          console.warn('Failed to send typing signal:', err);
        });
      }
    },
    [currentActiveChannelId]
  );

  const setConversationScroll = useCallback((conversationId: string, scrollTop: number) => {
    setScrollPositions((current) => ({
      ...current,
      [conversationId]: scrollTop,
    }));
  }, []);

  const setDraft = useCallback((conversationId: string, draft: string) => {
    setDrafts((current) => ({ ...current, [conversationId]: draft }));
    if (draft.trim().length > 0) {
      sendTypingSignal(true);
    }
  }, [sendTypingSignal]);

  const clearReply = useCallback(() => setReplyContext(null), []);

  // Send message through durable backend API with clientRequestId and optimistic UI
  const sendCommunityMessage = useCallback(
    async (communityId: string, replyCtx?: ReplyContext | null) => {
      const draft = drafts[communityId]?.trim();
      if (!draft) return;

      const comm = communities.find((c) => c.cohortId === communityId);
      const channelId = selectedChannels[communityId] ?? comm?.channels[0]?.id;

      // Requirement 5.10: Remove "sent when no channel" behavior.
      if (!channelId) {
        console.warn('Cannot send message: no active channel in community', communityId);
        return;
      }

      const clientRequestId = generateRequestId();

      const optimisticMessage: CommunityMessage = {
        id: clientRequestId,
        body: draft,
        timestamp: formatMessageTime(new Date().toISOString()),
        dateLabel: 'Today',
        author: {
          id: currentUserId || 'me',
          name: session?.user?.name || 'You',
          avatar: session?.user?.image || '/undone-logo.svg',
          online: true,
        },
        status: 'sending',
        replyTo: replyCtx
          ? {
              messageId: replyCtx.messageId,
              authorName: replyCtx.senderName,
              authorAvatar: replyCtx.senderAvatar || '/undone-logo.svg',
              previewText: replyCtx.previewText,
            }
          : undefined,
      };

      // Add to local state immediately
      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: [...(prev[channelId] ?? []), optimisticMessage],
      }));

      // Clear draft
      setDrafts((prev) => ({ ...prev, [communityId]: '' }));
      clearReply();

      try {
        const canonical = await messagesRepository.sendChannelMessage(channelId, {
          content: draft,
          clientRequestId,
          replyToId: replyCtx?.messageId,
        });

        // Reconcile response: replace optimistic placeholder with canonical message
        setMessagesByChannel((prev) => {
          const list = prev[channelId] ?? [];
          const canonicalUi = mapCanonicalMessageToCommunityMessage(
            canonical,
            currentUserId,
            'sent'
          );
          const idx = list.findIndex(
            (m) => m.id === clientRequestId || m.id === canonical.id
          );
          if (idx === -1) {
            return {
              ...prev,
              [channelId]: [...list, canonicalUi],
            };
          }
          const updated = [...list];
          updated[idx] = canonicalUi;
          return {
            ...prev,
            [channelId]: updated,
          };
        });
      } catch (err) {
        console.error('Failed to send message:', err);
        // Mark optimistic message as failed
        setMessagesByChannel((prev) => {
          const list = prev[channelId] ?? [];
          return {
            ...prev,
            [channelId]: list.map((m) =>
              m.id === clientRequestId ? { ...m, status: 'failed' } : m
            ),
          };
        });
      }
    },
    [drafts, communities, selectedChannels, currentUserId, session, clearReply]
  );

  // Retry sending a failed message
  const retryCommunityMessage = useCallback(
    async (communityId: string, messageId: string) => {
      const comm = communities.find((c) => c.cohortId === communityId);
      const channelId = selectedChannels[communityId] ?? comm?.channels[0]?.id;
      if (!channelId) return;

      const list = messagesByChannel[channelId] ?? [];
      const failedMsg = list.find((m) => m.id === messageId);
      if (!failedMsg || !failedMsg.body) return;

      // Requirement 5.9: Retry uses the same request ID, original channel and original payload.
      const clientRequestId = messageId;

      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).map((m) =>
          m.id === messageId ? { ...m, status: 'sending' } : m
        ),
      }));

      try {
        const canonical = await messagesRepository.sendChannelMessage(channelId, {
          content: failedMsg.body,
          clientRequestId,
          replyToId: failedMsg.replyTo?.messageId,
        });

        setMessagesByChannel((prev) => {
          const currentList = prev[channelId] ?? [];
          const canonicalUi = mapCanonicalMessageToCommunityMessage(
            canonical,
            currentUserId,
            'sent'
          );
          const idx = currentList.findIndex(
            (m) => m.id === clientRequestId || m.id === canonical.id
          );
          if (idx === -1) {
            return {
              ...prev,
              [channelId]: [...currentList, canonicalUi],
            };
          }
          const updated = [...currentList];
          updated[idx] = canonicalUi;
          return {
            ...prev,
            [channelId]: updated,
          };
        });
      } catch (err) {
        console.error('Failed to retry message:', err);
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? []).map((m) =>
            m.id === messageId ? { ...m, status: 'failed' } : m
          ),
        }));
      }
    },
    [communities, selectedChannels, messagesByChannel, currentUserId]
  );

  const toggleCommunityReaction = useCallback(
    async (_communityId: string, messageId: string, emoji: string) => {
      if (!currentActiveChannelId) return;

      // Optimistic reaction update
      setMessagesByChannel((prev) => {
        const list = prev[currentActiveChannelId] ?? [];
        return {
          ...prev,
          [currentActiveChannelId]: list.map((m) => {
            if (m.id !== messageId) return m;
            const currentReactions = m.reactions ?? [];
            const existing = currentReactions.find((r) => r.emoji === emoji);
            let nextReactions;
            if (existing) {
              if (existing.reactedByMe) {
                nextReactions = currentReactions
                  .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r))
                  .filter((r) => r.count > 0);
              } else {
                nextReactions = currentReactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
                );
              }
            } else {
              nextReactions = [...currentReactions, { emoji, count: 1, reactedByMe: true }];
            }
            return { ...m, reactions: nextReactions };
          }),
        };
      });

      try {
        await messagesRepository.toggleReaction(messageId, emoji);
      } catch (err) {
        console.error('Failed to toggle reaction:', err);
      }
    },
    [currentActiveChannelId]
  );

  const editCommunityMessage = useCallback(
    async (messageId: string, content: string, expectedRevision?: number) => {
      if (!currentActiveChannelId) return;

      setMessagesByChannel((prev) => {
        const list = prev[currentActiveChannelId] ?? [];
        return {
          ...prev,
          [currentActiveChannelId]: list.map((m) =>
            m.id === messageId ? { ...m, body: content, badge: 'edited' } : m
          ),
        };
      });

      try {
        const updated = await messagesRepository.editMessage(messageId, content, expectedRevision);
        setMessagesByChannel((prev) => {
          const list = prev[currentActiveChannelId] ?? [];
          return {
            ...prev,
            [currentActiveChannelId]: list.map((m) =>
              m.id === messageId ? mapCanonicalMessageToCommunityMessage(updated, currentUserId, 'sent') : m
            ),
          };
        });
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
    },
    [currentActiveChannelId, currentUserId]
  );

  const deleteCommunityMessage = useCallback(
    async (messageId: string, reason?: string) => {
      if (!currentActiveChannelId) return;

      setMessagesByChannel((prev) => {
        const list = prev[currentActiveChannelId] ?? [];
        return {
          ...prev,
          [currentActiveChannelId]: list.map((m) =>
            m.id === messageId ? { ...m, body: '[This message was deleted]', badge: 'deleted' } : m
          ),
        };
      });

      try {
        await messagesRepository.deleteMessage(messageId, reason);
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    },
    [currentActiveChannelId]
  );

  const uploadCommunityAttachment = useCallback(
    (_communityId: string, _file: File, _kind: ChatAttachmentKind) => {
      // Future Phase private attachment upload
    },
    []
  );

  const sendDMMessage = useCallback(
    async (dmId: string, replyCtx?: ReplyContext | null) => {
      const draft = drafts[dmId]?.trim();
      if (!draft) return;

      const conv = conversationsList.find((c) => c.id === dmId);
      const channelId = conv?.channelId;
      if (!channelId) {
        console.warn('Cannot send DM message: no active channel for conversation', dmId);
        return;
      }

      const clientRequestId = generateRequestId();

      const optimisticMessage: CommunityMessage = {
        id: clientRequestId,
        body: draft,
        timestamp: formatMessageTime(new Date().toISOString()),
        dateLabel: 'Today',
        author: {
          id: currentUserId || 'me',
          name: session?.user?.name || 'You',
          avatar: session?.user?.image || '/undone-logo.svg',
          online: true,
        },
        status: 'sending',
        replyTo: replyCtx
          ? {
              messageId: replyCtx.messageId,
              authorName: replyCtx.senderName,
              authorAvatar: replyCtx.senderAvatar || '/undone-logo.svg',
              previewText: replyCtx.previewText,
            }
          : undefined,
      };

      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: [...(prev[channelId] ?? []), optimisticMessage],
      }));

      setDrafts((prev) => ({ ...prev, [dmId]: '' }));
      clearReply();

      try {
        const canonical = await messagesRepository.sendChannelMessage(channelId, {
          content: draft,
          clientRequestId,
          replyToId: replyCtx?.messageId,
        });

        setMessagesByChannel((prev) => {
          const list = prev[channelId] ?? [];
          const canonicalUi = mapCanonicalMessageToCommunityMessage(
            canonical,
            currentUserId,
            'sent'
          );
          const idx = list.findIndex(
            (m) => m.id === clientRequestId || m.id === canonical.id
          );
          if (idx === -1) {
            return {
              ...prev,
              [channelId]: [...list, canonicalUi],
            };
          }
          const updated = [...list];
          updated[idx] = canonicalUi;
          return {
            ...prev,
            [channelId]: updated,
          };
        });

        setConversationsList((prev) =>
          prev.map((c) =>
            c.id === dmId
              ? {
                  ...c,
                  lastMessage: {
                    id: canonical.id,
                    content: canonical.content,
                    createdAt: canonical.createdAt,
                    authorName: canonical.author.name,
                  },
                  updatedAt: canonical.createdAt,
                }
              : c
          )
        );
      } catch (err) {
        console.error('Failed to send DM message:', err);
        setMessagesByChannel((prev) => {
          const list = prev[channelId] ?? [];
          return {
            ...prev,
            [channelId]: list.map((m) =>
              m.id === clientRequestId ? { ...m, status: 'failed' } : m
            ),
          };
        });
      }
    },
    [drafts, conversationsList, currentUserId, session, clearReply]
  );

  const createDirectConversation = useCallback(
    async (recipientId: string): Promise<string> => {
      const result = await messagesRepository.createDirectConversation(recipientId);
      await loadConversations();
      setSelectedSidebarTab('dm');
      setSelectedDMId(result.conversationId);
      setSelectedView('dm');
      return result.conversationId;
    },
    [loadConversations]
  );

  const createGroupConversation = useCallback(
    async (title: string, participantIds: string[]): Promise<string> => {
      const result = await messagesRepository.createGroupConversation(title, participantIds);
      await loadConversations();
      setSelectedSidebarTab('dm');
      setSelectedDMId(result.conversationId);
      setSelectedView('dm');
      return result.conversationId;
    },
    [loadConversations]
  );

  const leaveGroupConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await messagesRepository.leaveGroupConversation(conversationId);
      setConversationsList((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedDMId === conversationId) {
        setSelectedDMId(null);
        setSelectedView('landing');
      }
    },
    [selectedDMId]
  );

  const uploadDMAttachment = useCallback(
    (_dmId: string, _file: File, _kind: ChatAttachmentKind) => {
      // Future Phase DM attachment upload
    },
    []
  );

  const retryDMMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const conv = conversationsList.find((c) => c.id === conversationId);
      const channelId = conv?.channelId;
      if (!channelId) return;

      const list = messagesByChannel[channelId] ?? [];
      const failedMsg = list.find((m) => m.id === messageId);
      if (!failedMsg || !failedMsg.body) return;

      const clientRequestId = messageId;

      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).map((m) =>
          m.id === messageId ? { ...m, status: 'sending' } : m
        ),
      }));

      try {
        const canonical = await messagesRepository.sendChannelMessage(channelId, {
          content: failedMsg.body,
          clientRequestId,
          replyToId: failedMsg.replyTo?.messageId,
        });

        setMessagesByChannel((prev) => {
          const currentList = prev[channelId] ?? [];
          const canonicalUi = mapCanonicalMessageToCommunityMessage(
            canonical,
            currentUserId,
            'sent'
          );
          const idx = currentList.findIndex(
            (m) => m.id === clientRequestId || m.id === canonical.id
          );
          if (idx === -1) {
            return {
              ...prev,
              [channelId]: [...currentList, canonicalUi],
            };
          }
          const updated = [...currentList];
          updated[idx] = canonicalUi;
          return {
            ...prev,
            [channelId]: updated,
          };
        });
      } catch (err) {
        console.error('Failed to retry DM message:', err);
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? []).map((m) =>
            m.id === messageId ? { ...m, status: 'failed' } : m
          ),
        }));
      }
    },
    [conversationsList, messagesByChannel, currentUserId]
  );

  const deleteDMMessage = useCallback(
    (dmId: string, messageId: string) => {
      const conv = conversationsList.find((c) => c.id === dmId);
      const channelId = conv?.channelId;
      if (channelId) {
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? []).filter((m) => m.id !== messageId),
        }));
        messagesRepository.deleteMessage(channelId, messageId).catch((err) => {
          console.error('Failed to delete DM message on server:', err);
        });
      }
    },
    [conversationsList]
  );

  const togglePinConversation = useCallback(
    (id: string) => {
      let nextPinned = false;
      setPinnedConversations((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          nextPinned = false;
        } else {
          next.add(id);
          nextPinned = true;
        }
        return next;
      });

      let channelId: string | null = null;
      const conv = conversationsList.find((c) => c.id === id);
      if (conv?.channelId) {
        channelId = conv.channelId;
      } else {
        const comm = communities.find((c) => c.cohortId === id);
        channelId = comm?.channels[0]?.id ?? null;
      }

      if (channelId) {
        messagesRepository.updateChannelPreferences(channelId, { isPinned: nextPinned }).catch((err) => {
          console.warn('Failed to persist pin preference:', err);
        });
      }
    },
    [conversationsList, communities]
  );

  const muteConversation = useCallback(
    (id: string, hours: number) => {
      const mutedUntilMs = Date.now() + hours * 60 * 60 * 1000;
      const mutedUntilIso = new Date(mutedUntilMs).toISOString();
      setMutedConversations((prev) => ({
        ...prev,
        [id]: mutedUntilMs,
      }));

      let channelId: string | null = null;
      const conv = conversationsList.find((c) => c.id === id);
      if (conv?.channelId) {
        channelId = conv.channelId;
      } else {
        const comm = communities.find((c) => c.cohortId === id);
        channelId = comm?.channels[0]?.id ?? null;
      }

      if (channelId) {
        messagesRepository.updateChannelPreferences(channelId, { mutedUntil: mutedUntilIso }).catch((err) => {
          console.warn('Failed to persist mute preference:', err);
        });
      }
    },
    [conversationsList, communities]
  );

  const markAllRead = useCallback(() => {
    setMarkedAsRead((prev) => new Set([...prev, ...conversations.map((c) => c.id)]));
  }, [conversations]);

  return {
    view: selectedView,
    selectedCommunityId,
    selectedDMId,
    selectedSidebarTab,
    conversationFilter,
    searchQuery,
    sidebarTabs,
    conversationFilters,
    conversations,
    communityChat,
    dmConversation,
    communityScrollTop: scrollPositions[selectedCommunityId ?? ''] ?? 0,
    dmScrollTop: scrollPositions[selectedDMId ?? ''] ?? 0,
    communityDraft: drafts[selectedCommunityId ?? ''] ?? '',
    dmDraft: drafts[selectedDMId ?? ''] ?? '',
    isLoadingCommunities,
    communityError,
    // Zero fake items for empty / unconfigured entities
    liveSessions: [],
    recentMessages: [],
    upcomingEvents: [],
    challenge: {
      tag: '',
      title: '',
      description: '',
      participants: [],
      participantCount: 0,
    },
    friendsOnline: [],
    replyContext,
    isTyping,
    typingUsernames,
    actions: {
      setSelectedSidebarTab,
      setConversationFilter,
      setSearchQuery,
      selectConversation,
      backToLanding,
      setSelectedChannel,
      setConversationScroll,
      setDraft,
      sendCommunityMessage,
      retryCommunityMessage,
      sendDMMessage,
      retryDMMessage,
      createDirectConversation,
      createGroupConversation,
      leaveGroupConversation,
      uploadCommunityAttachment,
      toggleCommunityReaction,
      editCommunityMessage,
      deleteCommunityMessage,
      sendTypingSignal,
      uploadDMAttachment,
      deleteDMMessage,
      togglePinConversation,
      muteConversation,
      markAllRead,
      setReplyContext,
      clearReply,
      setIsTyping,
    },
  };
}

export type UseMessageResult = ReturnType<typeof useMessage>;
