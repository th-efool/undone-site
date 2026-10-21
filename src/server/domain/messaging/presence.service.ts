import 'server-only';
import { randomUUID } from 'node:crypto';
import { centrifugoTransport } from '@/src/server/infrastructure/realtime/centrifugo-transport';
import { buildDestinationChannel } from './contracts';
import { interactionService } from './interaction.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

const TYPING_THROTTLE_MS = 2000; // 2 seconds
const typingThrottleMap = new Map<string, number>();

export const presenceService = {
  /**
   * Broadcasts an ephemeral typing signal for an authorized user in a channel.
   * Throttled to 1 signal per 2 seconds per user/channel.
   */
  async handleTypingSignal(userId: string, channelId: string, isTyping = true) {
    const channel = await interactionService.authorizeChannelAccess(userId, channelId);

    const throttleKey = `${userId}:${channelId}`;
    const now = Date.now();
    const lastSignal = typingThrottleMap.get(throttleKey);

    if (lastSignal && now - lastSignal < TYPING_THROTTLE_MS) {
      return { success: true, throttled: true };
    }

    typingThrottleMap.set(throttleKey, now);

    // Fetch user details for typing broadcast
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    });

    const destination = buildDestinationChannel({
      channelId,
      generation: 1,
      communityId: (channel as any).communityId || channel.community?.cohortId,
      conversationId: (channel as any).conversationId || channel.conversation?.id,
      conversationKind: channel.conversation?.kind,
      studyRoomId: (channel as any).studyRoomId || channel.studyRoom?.id,
    });

    const typingEvent = {
      eventId: randomUUID(),
      schemaVersion: 1,
      type: 'typing.signal',
      streamId: `signal:${channelId}`,
      sequence: 0,
      generation: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        channelId,
        userId,
        userName: user?.name || user?.username || 'Someone',
        isTyping,
        expiresInMs: 5000,
      },
    };

    try {
      await centrifugoTransport.publish(destination, typingEvent);
    } catch (err) {
      // Ephemeral signals fail open without erroring the HTTP response
      console.warn('Failed to publish typing signal to Centrifugo:', err);
    }

    return { success: true, throttled: false };
  },

  /**
   * Clear in-memory throttle cache (used for unit tests)
   */
  clearThrottleForTests() {
    typingThrottleMap.clear();
  },
};
