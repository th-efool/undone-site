import { CommunityChatModel } from '../models';
import { ALL_MOCK_AVATARS, getAvatar } from '@/src/client/mock/avatars';

const avatars = ALL_MOCK_AVATARS;
const chart = '/images/landing/hand.webp';

const people = {
  shaqun: { id: 'shaqun', name: 'Shaqun', avatar: getAvatar('shaqun'), online: true },
  vanshika: {
    id: 'vanshika',
    name: 'Vanshika Iyer',
    avatar: getAvatar('vanshika'),
    online: true,
  },
  rohan: { id: 'rohan', name: 'Rohan Gupta', avatar: getAvatar('rohan'), online: true },
  arjun: { id: 'arjun', name: 'Arjun Nair', avatar: getAvatar('arjun'), online: true },
  samiksha: {
    id: 'samiksha',
    name: 'Samiksha Sharma',
    avatar: getAvatar('samiksha'),
    online: true,
  },
  ananya: {
    id: 'ananya',
    name: 'Ananya Singh',
    avatar: getAvatar('ananya'),
    online: true,
  },
};

export const communityChatMock: CommunityChatModel = {
  id: 'ai-builders',
  name: 'AI Builders',
  avatar: '/mock/thumbnails/machine-learning.avif',
  description: 'Cohort room for AI builders & tinkerers',
  onlineCount: 143,
  createdBy: 'Shaqun',
  createdAt: 'Feb 5, 2025',
  members: [people.shaqun, people.rohan, people.arjun, people.vanshika, people.samiksha],
  channels: [
    { id: 'general', label: '# general', unreadCount: 3 },
    { id: 'resources', label: '# resources' },
    { id: 'wins', label: '# wins', unreadCount: 7 },
    { id: 'help', label: '# · help' },
    { id: 'voice', label: '🎙️ voice', unreadCount: 12 },
    { id: 'events', label: '📅 events' },
  ],
  selectedChannel: 'general',
  pinnedAnnouncement: {
    author: 'Shaqun',
    title: 'Checkpoint 3 — Model Evaluation starts in 20 mins!',
    actionLabel: 'Join Session',
  },
  messages: [
    {
      id: 'm1',
      author: people.shaqun,
      badge: 'Admin',
      dateLabel: 'Yesterday',
      timestamp: 'Yesterday at 11:45 AM',
      body: "Welcome to the AI Builders cohort! Please introduce yourself below.",
    },
    {
      id: 'm2',
      author: people.vanshika,
      dateLabel: 'Yesterday',
      timestamp: 'Yesterday at 12:03 PM',
      body: "Hi everyone! Excited to be here. Currently working on a diffusion model for image generation.",
    },
    {
      id: 'm3',
      author: people.rohan,
      dateLabel: 'Yesterday',
      timestamp: 'Yesterday at 12:15 PM',
      body: "Same here — GANs have been my focus this month.",
    },
    {
      id: 'm4',
      author: people.arjun,
      dateLabel: 'Today',
      timestamp: 'Today at 9:02 AM',
      body: "Good morning! Who's joining the checkpoint today?",
    },
    {
      id: 'm5',
      author: people.samiksha,
      dateLabel: 'Today',
      timestamp: 'Today at 9:05 AM',
      body: "I'm in! Let's go 🚀",
    },
    {
      id: 'm6',
      author: people.shaqun,
      badge: 'Admin',
      dateLabel: 'Today',
      timestamp: 'Today at 5:28 PM',
      body: "Checkpoint starting in 5 mins. Let's go! 🚀",
      reactions: [
        { emoji: '🔥', count: 24 },
        { emoji: '🚀', count: 12 },
      ],
    },
    {
      id: 'm7',
      author: people.vanshika,
      dateLabel: 'Today',
      timestamp: 'Today at 5:29 PM',
      body: 'Finally got Adam optimizer intuition. This visualization helped a ton!',
      attachment: {
        id: 'a1',
        kind: 'image',
        title: 'Adam Optimizer',
        url: chart,
        caption: 'Adam optimizer learning rate and parameter updates',
        meta: '1280 × 720',
      },
      reactions: [
        { emoji: '🔥', count: 18 },
        { emoji: '👏', count: 7 },
      ],
    },
    {
      id: 'm8',
      author: people.rohan,
      dateLabel: 'Today',
      timestamp: 'Today at 5:31 PM',
      body: 'Does anyone have the roadmap for the next 2 weeks?',
      reactions: [{ emoji: '👍', count: 6 }],
      replies: {
        avatars: [people.shaqun, people.vanshika, people.ananya],
        count: 3,
        lastReplyBy: 'Ananya Singh',
        timestamp: '5:36 PM',
      },
    },
    {
      id: 'm9',
      author: people.arjun,
      dateLabel: 'Today',
      timestamp: 'Today at 5:32 PM',
      attachment: {
        id: 'a2',
        kind: 'pdf',
        title: 'ML_2_Week_Roadmap.pdf',
        meta: '1.2 MB · PDF',
      },
      reactions: [{ emoji: '🔥', count: 12 }],
    },
    {
      id: 'm10',
      author: people.samiksha,
      dateLabel: 'Today',
      timestamp: 'Today at 5:34 PM',
      body: 'Look at this transition! 🔥',
    },
  ],
  pinnedMessages: [
    {
      id: 'p1',
      author: people.shaqun,
      preview: 'Checkpoint 3 — Model Evaluation starts in 20 mins!',
      timestamp: 'Today at 5:20 PM',
    },
    {
      id: 'p2',
      author: people.rohan,
      preview: 'Roadmap for next 2 weeks',
      timestamp: 'Today at 5:31 PM',
    },
    {
      id: 'p3',
      author: people.arjun,
      preview: 'Please review the evaluation checklist before tomorrow.',
      timestamp: 'Today at 4:42 PM',
    },
  ],
  media: [
    { id: 'g1', kind: 'image', title: 'Optimizer chart', url: chart },
    {
      id: 'g2',
      kind: 'image',
      title: 'Model notes',
      url: '/images/landing/screen.webp',
    },
    {
      id: 'g3',
      kind: 'image',
      title: 'Checklist',
      url: '/images/auth/claude.webp',
    },
    {
      id: 'g4',
      kind: 'image',
      title: 'Code review',
      url: '/images/auth/maker.webp',
    },
    {
      id: 'g5',
      kind: 'image',
      title: 'Attention deck',
      url: '/images/auth/phone.webp',
    },
    {
      id: 'g6',
      kind: 'image',
      title: 'Voice recap',
      url: '/images/landing/before-sleep.webp',
      duration: '0:45',
    },
  ],
  events: [
    {
      id: 'e1',
      title: 'Checkpoint 3',
      subtitle: 'Model Evaluation',
      startsIn: 'Starts in 20m',
    },
    {
      id: 'e2',
      title: 'Q&A + Doubt Clearing',
      subtitle: 'With Shaqun',
      startsIn: 'Today, 8:00 PM',
    },
  ],
};
