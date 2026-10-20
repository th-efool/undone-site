import { describe, it, expect } from 'vitest';
import {
  mapCommunityDtoToConversationPreview,
  mapCommunityDtoToCommunityChat,
  mapCanonicalMessageToCommunityMessage,
  formatMessageDateLabel,
} from '../communityMapping';
import type { EnrolledCommunityDTO, CanonicalMessagePayload } from '@/src/client/repositories/messagesRepository';

describe('communityMapping pure DTO transformers', () => {
  const sampleDto: EnrolledCommunityDTO = {
    cohortId: 'cohort-100',
    cohortTitle: 'Distributed Systems',
    coverImage: '/cover.png',
    role: 'EXPLORER',
    communityId: 'comm-100',
    chatEnabled: true,
    channels: [
      { id: 'chan-alpha', name: 'general' },
      { id: 'chan-beta', name: 'evals' },
    ],
  };

  it('maps EnrolledCommunityDTO to ConversationPreview without fake online counts or people', () => {
    const preview = mapCommunityDtoToConversationPreview(sampleDto, true);

    expect(preview.id).toBe('cohort-100');
    expect(preview.kind).toBe('community');
    expect(preview.name).toBe('Distributed Systems');
    expect(preview.avatar).toBe('/cover.png');
    expect(preview.preview).toBe('#general');
    expect(preview.selected).toBe(true);
    expect(preview.onlineCount).toBeUndefined();
  });

  it('maps EnrolledCommunityDTO to CommunityChat with actual channels and 0 fake members', () => {
    const chat = mapCommunityDtoToCommunityChat(sampleDto, 'chan-beta');

    expect(chat.id).toBe('cohort-100');
    expect(chat.name).toBe('Distributed Systems');
    expect(chat.selectedChannel).toBe('chan-beta');
    expect(chat.channels).toEqual([
      { id: 'chan-alpha', label: '# general' },
      { id: 'chan-beta', label: '# evals' },
    ]);
    expect(chat.members).toEqual([]);
    expect(chat.messages).toEqual([]);
    expect(chat.onlineCount).toBe(0);
  });

  it('maps CanonicalMessagePayload to CommunityMessage and marks author as You when matching current user', () => {
    const canonical: CanonicalMessagePayload = {
      id: 'msg-999',
      content: 'Distributed consensus evaluation',
      channelId: 'chan-alpha',
      authorId: 'user-me',
      messageSequence: 12,
      clientRequestId: 'req-1',
      replyToId: null,
      revision: 1,
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
      author: {
        id: 'user-me',
        name: 'My Real Name',
        image: '/my-avatar.jpg',
        username: 'myme',
      },
    };

    const uiMsg = mapCanonicalMessageToCommunityMessage(canonical, 'user-me', 'sent');

    expect(uiMsg.id).toBe('msg-999');
    expect(uiMsg.body).toBe('Distributed consensus evaluation');
    expect(uiMsg.author.name).toBe('You');
    expect(uiMsg.status).toBe('sent');
  });

  it('maps CanonicalMessagePayload with foreign author correctly', () => {
    const canonical: CanonicalMessagePayload = {
      id: 'msg-1000',
      content: 'Peer review complete',
      channelId: 'chan-alpha',
      authorId: 'user-peer',
      messageSequence: 13,
      clientRequestId: null,
      replyToId: null,
      revision: 1,
      createdAt: '2026-10-20T12:05:00.000Z',
      updatedAt: '2026-10-20T12:05:00.000Z',
      author: {
        id: 'user-peer',
        name: 'Peer Name',
        image: '/peer-avatar.jpg',
        username: 'peer',
      },
    };

    const uiMsg = mapCanonicalMessageToCommunityMessage(canonical, 'user-me', 'sent');

    expect(uiMsg.id).toBe('msg-1000');
    expect(uiMsg.author.id).toBe('user-peer');
    expect(uiMsg.author.name).toBe('Peer Name');
    expect(uiMsg.author.avatar).toBe('/peer-avatar.jpg');
  });

  it('formats date labels correctly for Today and older dates', () => {
    const nowIso = new Date().toISOString();
    expect(formatMessageDateLabel(nowIso)).toBe('Today');

    const pastDate = new Date(2025, 5, 15).toISOString();
    expect(formatMessageDateLabel(pastDate)).toContain('Jun 15');
  });
});
