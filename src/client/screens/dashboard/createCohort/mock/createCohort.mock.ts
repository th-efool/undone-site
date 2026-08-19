import type {
  CreateCohortDraft,
  CreateCohortDifficulty,
  CreateCohortSourceType,
  CreateCohortVisibility,
} from '../models/createCohort';

export const difficultyOptions: CreateCohortDifficulty[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
];

export const visibilityOptions: CreateCohortVisibility[] = ['Private', 'Unlisted', 'Public'];

export const sourceTypeOptions: CreateCohortSourceType[] = [
  'YouTube Playlist',
  'YouTube Video',
  'Website',
  'PDF',
  'Markdown',
  'GitHub Repository',
  'Custom Link',
];

export const categoryOptions = [
  'Software Engineering',
  'Web & Mobile Dev',
  'AI & Machine Learning',
  'Data & Analytics',
  'UI/UX & Product Design',
  '3D & Game Development',
  'Business & Startups',
  'Product Management',
  'Marketing & Growth',
  'Finance & Crypto',
  'Productivity & Mindset',
  'Communication & Public Speaking',
  'Languages & Writing',
  'Science & Mathematics',
  'Health & Fitness',
  'Music & Audio Production',
];

export const durationPresetOptions = [
  '1 Week',
  '2 Weeks',
  '3-4 Weeks',
  '1-2 Months',
  '3-6 Months',
  'Self-Paced / Custom',
];

export const createCohortMockDraft: CreateCohortDraft = {
  coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop',
  title: '',
  subtitle: '',
  description: '',
  difficulty: 'Beginner',
  categories: [],
  visibility: 'Public',
  estimatedCompletionTime: '3-4 Weeks',
  language: 'English',
  primaryTopic: '',
  tags: [],
  requirements: [
    'A computer with internet access.',
    'Dedication to complete daily practice sessions.',
  ],
  learningOutcomes: [
    'Master key concepts through practical exercises.',
    'Build real projects and prove your skills.',
  ],
  sources: [
    {
      id: 'source-1',
      type: 'YouTube Playlist',
      title: 'Full Stack Web Development Course',
      url: 'https://www.youtube.com/playlist?list=PL4cUxeGkcC9gC88BEo9czbfg72KH7-O60',
      collapsed: false,
      thumbnailUrl: 'https://img.youtube.com/vi/u6gSSpfsoOQ/hqdefault.jpg',
      domain: 'youtube.com',
      metaTitle: 'Full Stack Web Dev Playlist',
    },
    {
      id: 'source-2',
      type: 'YouTube Video',
      title: 'Next.js 14 App Router Crash Course',
      url: 'https://www.youtube.com/watch?v=wm5gMKCOB4U',
      collapsed: false,
      thumbnailUrl: 'https://img.youtube.com/vi/wm5gMKCOB4U/hqdefault.jpg',
      domain: 'youtube.com',
      metaTitle: 'Next.js 14 Crash Course',
    },
  ],
};
