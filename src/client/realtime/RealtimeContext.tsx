'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Centrifuge, UnauthorizedError } from 'centrifuge';
import type {
  ConnectionStatus,
  SubscriptionStatus,
  PublicationHandler,
  RealtimeManifest,
  RealtimeContextValue,
} from './types';
import { SubscriptionRegistry } from './subscription-registry';

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: React.ReactNode;
  userId?: string | null;
  wsEndpoint?: string;
}

export function RealtimeProvider({
  children,
  userId,
  wsEndpoint,
}: RealtimeProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeChannels, setActiveChannels] = useState<string[]>([]);

  const clientRef = useRef<Centrifuge | null>(null);
  const registryRef = useRef<SubscriptionRegistry | null>(null);
  const currentUserIdRef = useRef<string | null | undefined>(userId);

  // Initialize or maintain subscription registry
  if (!registryRef.current) {
    registryRef.current = new SubscriptionRegistry({
      onRevocation: (channel) => {
        console.warn(`[Realtime] Subscription access revoked for channel: ${channel}`);
        updateActiveChannels();
      },
    });
  }

  const updateActiveChannels = useCallback(() => {
    if (registryRef.current) {
      setActiveChannels(registryRef.current.getActiveChannels());
    }
  }, []);

  const fetchToken = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/realtime/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      setStatus('unauthorized');
      throw new UnauthorizedError('Account is unauthorized for realtime connections');
    }

    if (!res.ok) {
      throw new Error(`Token fetch failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.token;
  }, []);

  const connect = useCallback(() => {
    if (!userId) {
      setStatus('disconnected');
      return;
    }

    if (clientRef.current) {
      return;
    }

    const endpoint =
      wsEndpoint ||
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ||
      'ws://localhost:8000/connection/websocket';

    setStatus('connecting');

    const client = new Centrifuge(endpoint, {
      getToken: fetchToken,
      maxReconnectDelay: 10000,
      minReconnectDelay: 1000,
    });

    client.on('connecting', () => {
      setStatus('connecting');
    });

    client.on('connected', (ctx) => {
      setStatus('connected');
      setClientId(ctx.client);
    });

    client.on('disconnected', (ctx) => {
      if (ctx.code === 3000 || ctx.reason === 'Unauthorized') {
        setStatus('unauthorized');
      } else {
        setStatus('reconnecting');
      }
      setClientId(null);
    });

    client.on('error', (ctx) => {
      console.error('[Realtime Client Error]:', ctx.error);
    });

    clientRef.current = client;
    if (registryRef.current) {
      registryRef.current.setClient(client);
    }

    client.connect();
  }, [userId, wsEndpoint, fetchToken]);

  const disconnect = useCallback(() => {
    if (registryRef.current) {
      registryRef.current.clearAll();
    }
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch (err) {
        console.error('Error disconnecting Centrifuge client:', err);
      }
      clientRef.current = null;
    }
    setStatus('disconnected');
    setClientId(null);
    setActiveChannels([]);
  }, []);

  // Handle user changes / logout
  useEffect(() => {
    if (currentUserIdRef.current !== userId) {
      currentUserIdRef.current = userId;
      disconnect();
    }

    if (userId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  const subscribe = useCallback(
    (channel: string, handler?: PublicationHandler) => {
      if (!registryRef.current) {
        throw new Error('Subscription registry is not initialized');
      }
      const release = registryRef.current.acquire(channel, handler);
      updateActiveChannels();

      return () => {
        release();
        updateActiveChannels();
      };
    },
    [updateActiveChannels]
  );

  const getSubscriptionStatus = useCallback((channel: string): SubscriptionStatus => {
    if (!registryRef.current) return 'unsubscribed';
    return registryRef.current.getStatus(channel);
  }, []);

  const refreshManifest = useCallback(async (): Promise<RealtimeManifest | null> => {
    if (!userId) return null;
    try {
      const res = await fetch('/api/realtime/subscriptions', {
        headers: { 'Cache-Control': 'no-store' },
      });
      if (!res.ok) return null;
      const data: RealtimeManifest = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to fetch realtime subscriptions manifest:', err);
      return null;
    }
  }, [userId]);

  const contextValue = useMemo<RealtimeContextValue>(
    () => ({
      status,
      clientId,
      activeChannels,
      subscribe,
      getSubscriptionStatus,
      refreshManifest,
      disconnect,
      reconnect: connect,
    }),
    [status, clientId, activeChannels, subscribe, getSubscriptionStatus, refreshManifest, disconnect, connect]
  );

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}
