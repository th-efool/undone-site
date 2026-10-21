'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtime } from '@/src/client/realtime';
import {
  studyRoomRepository,
  type RoomChatMessageDTO,
} from '@/src/client/repositories/studyRoomRepository';

export interface OptimisticChatMessage extends RoomChatMessageDTO {
  deliveryStatus: 'pending' | 'sent' | 'failed';
  failedError?: string;
}

export interface UseRoomChatOptions {
  channelId?: string | null;
  streamGeneration?: number;
  enabled?: boolean;
}

export interface UseRoomChatResult {
  messages: OptimisticChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (clientRequestId: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

export function useRoomChat({
  channelId,
  streamGeneration = 1,
  enabled = true,
}: UseRoomChatOptions): UseRoomChatResult {
  const { data: session } = useSession();
  const realtime = useSafeRealtime();
  const [messages, setMessages] = useState<OptimisticChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const currentUserId = session?.user?.id;
  const currentUserName = session?.user?.name || 'You';
  const currentUserImage = session?.user?.image || null;

  // 1. Fetch persistent history
  const fetchHistory = useCallback(async () => {
    if (!channelId || !enabled) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const history = await studyRoomRepository.getChannelMessages(channelId, 50);
      if (isMountedRef.current) {
        setMessages((prev) => {
          const pending = prev.filter((m) => m.deliveryStatus === 'pending');
          const canonical = history.map((m) => ({
            ...m,
            deliveryStatus: 'sent' as const,
          }));
          return [...canonical, ...pending];
        });
        setError(null);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load chat history');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [channelId, enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore || !isMountedRef.current) return;
      await fetchHistory();
    });

    return () => {
      ignore = true;
      isMountedRef.current = false;
    };
  }, [fetchHistory]);

  // 2. Realtime subscription to roomchat stream
  useEffect(() => {
    if (!channelId || !enabled || typeof realtime?.subscribe !== 'function') return;

    const channelName = `roomchat:${channelId}:g${streamGeneration}`;
    const unsubscribe = realtime.subscribe(channelName, (data: unknown) => {
      const envelope = data as {
        type?: string;
        payload?: RoomChatMessageDTO;
        message?: RoomChatMessageDTO;
      };

      const incoming = envelope?.payload || envelope?.message;
      if (!incoming || !incoming.id) return;

      setMessages((prev) => {
        // If matches a pending optimistic message by clientRequestId
        if (incoming.clientRequestId) {
          const optIdx = prev.findIndex(
            (m) => m.clientRequestId === incoming.clientRequestId
          );
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = { ...incoming, deliveryStatus: 'sent' };
            return next;
          }
        }

        // Check if already in list by id
        const existingIdx = prev.findIndex((m) => m.id === incoming.id);
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = { ...incoming, deliveryStatus: 'sent' };
          return next;
        }

        // Append new incoming message
        return [...prev, { ...incoming, deliveryStatus: 'sent' }];
      });
    });

    return () => {
      unsubscribe();
    };
  }, [channelId, streamGeneration, enabled, realtime]);

  // 3. Optimistic Send
  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !channelId) return;

      const clientRequestId =
        'req-' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));

      const optimisticMsg: OptimisticChatMessage = {
        id: 'opt-' + clientRequestId,
        content: trimmed,
        channelId,
        authorId: currentUserId || 'viewer',
        messageSequence: -1,
        clientRequestId,
        replyToId: null,
        revision: 1,
        editedAt: null,
        deletedAt: null,
        deletionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: currentUserId || 'viewer',
          name: currentUserName,
          image: currentUserImage,
          username: null,
        },
        deliveryStatus: 'pending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const canonical = await studyRoomRepository.sendChannelMessage(
          channelId,
          trimmed,
          clientRequestId
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.clientRequestId === clientRequestId
              ? { ...canonical, deliveryStatus: 'sent' }
              : m
          )
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Message failed to send';
        setMessages((prev) =>
          prev.map((m) =>
            m.clientRequestId === clientRequestId
              ? { ...m, deliveryStatus: 'failed', failedError: errMsg }
              : m
          )
        );
      }
    },
    [channelId, currentUserId, currentUserName, currentUserImage]
  );

  // 4. Retry failed message
  const retryMessage = useCallback(
    async (clientRequestId: string) => {
      if (!channelId) return;

      const msg = messages.find((m) => m.clientRequestId === clientRequestId);
      if (!msg) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.clientRequestId === clientRequestId
            ? { ...m, deliveryStatus: 'pending', failedError: undefined }
            : m
        )
      );

      try {
        const canonical = await studyRoomRepository.sendChannelMessage(
          channelId,
          msg.content,
          clientRequestId
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.clientRequestId === clientRequestId
              ? { ...canonical, deliveryStatus: 'sent' }
              : m
          )
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Message failed to send';
        setMessages((prev) =>
          prev.map((m) =>
            m.clientRequestId === clientRequestId
              ? { ...m, deliveryStatus: 'failed', failedError: errMsg }
              : m
          )
        );
      }
    },
    [channelId, messages]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    retryMessage,
    refreshMessages: fetchHistory,
  };
}
