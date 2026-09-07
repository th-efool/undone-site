import { useEffect, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';

export type ProviderStatus = 'connecting' | 'connected' | 'disconnected' | 'syncing' | null;

export function useHocuspocusProvider(documentName: string) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<ProviderStatus>('connecting');

  useEffect(() => {
    const newProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:4001',
      name: documentName,
      onConnect: () => setStatus('connected'),
      onDisconnect: () => setStatus('disconnected'),
      onSynced: () => setStatus('connected'),
      onStatus: ({ status }) => {
        setStatus(status as ProviderStatus);
      },
    });
    setProvider(newProvider);

    return () => {
      newProvider.destroy();
    };
  }, [documentName]);

  return { provider, status };
}
