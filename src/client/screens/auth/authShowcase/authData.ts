export type StudyRoom = {
  id: string;
  roomName: string;
  learnerName: string;
  activity: string;
  members: number;
  isLive: boolean;
  video: string;
};

export const STUDY_ROOMS: StudyRoom[] = [
  {
    id: 'library',
    roomName: 'Deep Work Library',
    learnerName: 'Kavya',
    activity: 'Reviewing AI Automation (A–Z)',
    members: 128,
    isLive: true,
    video: '/videos/auth/1.webm',
  },

  {
    id: 'cafe',
    roomName: 'Quiet Café',
    learnerName: 'Xu Fang',
    activity: 'Practicing Japanese N5',
    members: 76,
    isLive: true,
    video: '/videos/auth/8.webm',
  },

  {
    id: 'midnight',
    roomName: 'Midnight Loft',
    learnerName: 'Tara',
    activity: 'Watching Claude for Content Automation',
    members: 61,
    isLive: true,
    video: '/videos/auth/2.webm',
  },

  {
    id: 'systems',
    roomName: 'Systems Workshop',
    learnerName: 'Mia',
    activity: 'Building CoinPicking Genesis',
    members: 94,
    isLive: true,
    video: '/videos/auth/9.webm',
  },

  {
    id: 'focus',
    roomName: 'Focus Garden',
    learnerName: 'Nishu',
    activity: 'Editing CapCut Creator Bootcamp',
    members: 52,
    isLive: true,
    video: '/videos/auth/3.webm',
  },

  {
    id: 'hackers',
    roomName: "Hacker's Lounge",
    learnerName: 'Arpita',
    activity: 'Working through System Design Interview',
    members: 83,
    isLive: true,
    video: '/videos/auth/4.webm',
  },

  {
    id: 'philosophy',
    roomName: 'Philosophy Corner',
    learnerName: 'Natasha',
    activity: 'Reading Meditations',
    members: 48,
    isLive: true,
    video: '/videos/auth/7.webm',
  },

  {
    id: 'commons',
    roomName: 'Study Commons',
    learnerName: 'Maya',
    activity: 'Learning Distributed Systems',
    members: 69,
    isLive: true,
    video: '/videos/auth/5.webm',
  },

  {
    id: 'lab',
    roomName: 'Data Lab',
    learnerName: 'Mark',
    activity: 'Practicing SQL Exercises',
    members: 39,
    isLive: true,
    video: '/videos/auth/6.webm',
  },
];

export type FeaturedCard = {
  id: string;

  title: string;

  subtitle: string;

  members: string;

  progress: string;

  online: string;

  image: string;
};

export const FEATURED_CONTENT: FeaturedCard[] = [
  {
    id: 'ali',
    title: 'Maker School: AI Automation',
    subtitle: 'Get your first client for an AI automation business in 90 days or your money back.',
    members: '124k learners',
    progress: '78%',
    online: '4,200 online',
    image: '/images/auth/maker.webp',
  },

  {
    id: 'claude',
    title: 'The Claude Code Club',
    subtitle: 'Build products, automate work, and make money online.',
    members: '71k members',
    progress: '54%',
    online: '856 online',
    image: '/images/auth/claude.webp',
  },

  {
    id: 'faceless',
    title: 'Faceless YouTube',
    subtitle: 'Create and grow faceless YouTube channels using AI.',
    members: '2.8k members',
    progress: '32%',
    online: '432 online',
    image: '/images/auth/faceless.webp',
  },
];
