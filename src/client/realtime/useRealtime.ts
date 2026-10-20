'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRealtime } from './RealtimeContext';
import type { PublicationHandler, RealtimeManifest, SubscriptionStatus } from './types';

export { useRealtime };

export function useChannelSubscription<T = unknown>(
  channel: string | null | undefined,
  onPublication?: (payload: T, info?: { channel: string; offset?: number }) => void
): { status: SubscriptionStatus } {
  const { subscribe, getSubscriptionStatus } = useRealtime();
  const handlerRef = useRef(onPublication);
  handlerRef.current = onPublication;

  const [status, setStatus] = useState<SubscriptionStatus>(() =>
    channel ? getSubscriptionStatus(channel) : 'unsubscribed'
  );

  useEffect(() => {
    if (!channel) {
      setStatus('unsubscribed');
      return;
    }

    const handler: PublicationHandler = (data, info) => {
      if (handlerRef.current) {
        handlerRef.current(data as T, info);
      }
    };

    const unsubscribe = subscribe(channel, handler);
    setStatus(getSubscriptionStatus(channel));

    return () => {
      unsubscribe();
    };
  }, [channel, subscribe, getSubscriptionStatus]);

  return {
    status: channel ? getSubscriptionStatus(channel) : 'unsubscribed',
  };
}

export function useSubscriptionManifest(): {
  manifest: RealtimeManifest | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { refreshManifest } = useRealtime();
  const [manifest, setManifest] = useState<RealtimeManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await refreshManifest();
      setManifest(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [refreshManifest]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  return {
    manifest,
    loading,
    error,
    refetch: fetchManifest,
  };
}
