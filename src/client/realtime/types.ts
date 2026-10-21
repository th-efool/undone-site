export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unauthorized'
  | 'degraded';

export type SubscriptionStatus =
  | 'unsubscribed'
  | 'subscribing'
  | 'subscribed'
  | 'unsubscribing'
  | 'error';

export type PublicationHandler<T = unknown> = (data: T, info?: { channel: string; offset?: number }) => void;

export interface RealtimeManifestItem {
  channel: string;
  scopeType: 'user' | 'community' | 'dm' | 'group' | 'room' | 'roomchat' | 'signal';
  entityId: string;
  generation: number;
}

export interface RealtimeManifest {
  userId: string;
  generatedAt: string;
  channels: RealtimeManifestItem[];
}

export interface RealtimeContextValue {
  status: ConnectionStatus;
  clientId: string | null;
  activeChannels: string[];
  subscribe: (channel: string, handler?: PublicationHandler) => () => void;
  getSubscriptionStatus: (channel: string) => SubscriptionStatus;
  refreshManifest: () => Promise<RealtimeManifest | null>;
  disconnect: () => void;
  reconnect: () => void;
}
