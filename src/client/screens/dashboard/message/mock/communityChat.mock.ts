import type { CommunityChatModel } from '../models';

export const communityChatMock: CommunityChatModel = {
  id: 'mock-community',
  name: 'Community Mock',
  avatar: '/mock/thumbnails/docker.avif',
  description: 'A mock community for development',
  onlineCount: 42,
  createdBy: 'System',
  createdAt: 'Jan 1, 2026',
  members: [],
  channels: [{ id: 'general', label: '# general' }],
  selectedChannel: 'general',
  pinnedAnnouncement: {
    author: 'System',
    title: 'Welcome to the community!',
    actionLabel: 'Read rules',
  },
  messages: [
    {
      id: 'msg-1',
      author: { id: 'user-1', name: 'Alice', avatar: '/mock/avatars/avatar-1.webp' },
      timestamp: 'Today at 10:00 AM',
      body: 'Hello everyone!',
    },
    {
      id: 'msg-2',
      author: { id: 'user-2', name: 'Bob', avatar: '/mock/avatars/avatar-2.webp' },
      timestamp: 'Today at 10:05 AM',
      body: 'Hi Alice, how are you?',
    },
    {
      id: 'msg-3',
      author: { id: 'user-3', name: 'Charlie', avatar: '/mock/avatars/avatar-3.webp' },
      timestamp: 'Today at 10:15 AM',
      body: 'Does anyone have the notes from yesterday?',
    }
  ],
  pinnedMessages: [
    {
      id: 'pin-1',
      author: { id: 'user-0', name: 'Admin', avatar: '/mock/avatars/avatar-0.webp' },
      preview: 'Please check the resources channel for the latest updates.',
      timestamp: 'Yesterday',
    }
  ],
  media: [],
  events: [],
};
