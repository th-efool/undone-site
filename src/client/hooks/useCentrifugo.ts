import { useEffect, useRef, useState, useCallback } from 'react';
import { Centrifuge, PublicationContext, Subscription } from 'centrifuge';
import { db } from '../db';
import Message from '../db/models/Message';

export function useCentrifugo() {
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());

  useEffect(() => {
    // 1. Initialize the Centrifuge client using a token fetched from /api/chat/centrifugo-token
    const client = new Centrifuge(process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL || 'ws://localhost:8000/connection/websocket', {
      getToken: async () => {
        const res = await fetch('/api/chat/centrifugo-token');
        if (!res.ok) {
          throw new Error('Failed to fetch centrifugo token');
        }
        const data = await res.json();
        return data.token;
      },
    });

    client.connect();
    setCentrifuge(client);

    return () => {
      client.disconnect();
    };
  }, []);

  const subscribeToConversation = useCallback((id: string) => {
    if (!centrifuge) return;

    const channelName = `conversation:${id}`;
    if (subscriptionsRef.current.has(channelName)) {
      return subscriptionsRef.current.get(channelName);
    }

    const sub = centrifuge.newSubscription(channelName);

    sub.on('publication', async (ctx: PublicationContext) => {
      const messageData = ctx.data;
      const clientId = messageData.clientId;

      try {
        // 4. When a message is received, write it to the local WatermelonDB instance
        await db.write(async () => {
          await db.get<Message>('messages').create((msg) => {
            // Set the relation via the id
            msg.conversation.id = id;
            msg.authorId = messageData.authorId;
            msg.content = messageData.content;
            msg.clientId = clientId;
            msg.status = messageData.status || 'received';
          });
        });

        // 5. After successful local write, execute a POST fetch to /api/chat/ack
        if (clientId) {
          await fetch('/api/chat/ack', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientId }),
          });
        }
      } catch (error) {
        console.error('Failed to handle incoming message:', error);
      }
    });

    sub.subscribe();
    subscriptionsRef.current.set(channelName, sub);
    
    return () => {
      sub.unsubscribe();
      subscriptionsRef.current.delete(channelName);
    };
  }, [centrifuge]);

  return { subscribeToConversation, centrifuge };
}
