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
  'Productivity',
  'Focus',
  'Systems',
  'Research',
  'Creative Work',
  'Career Growth',
  'Writing',
  'AI Tools',
];

export const createCohortMockDraft: CreateCohortDraft = {
  coverImage: '/images/landing/screen.webp',
  title: 'Deep Work Mastery',
  subtitle: 'Build a focused learning journey for ambitious creators.',
  description:
    'A premium cohort for designing attention systems, building execution rituals, and shipping meaningful work without the drift of constant context switching.',
  difficulty: 'Intermediate',
  categories: ['Productivity', 'Focus', 'Creative Work'],
  visibility: 'Private',
  estimatedCompletionTime: '3-4 weeks',
  language: 'English',
  primaryTopic: 'Focus systems',
  tags: ['deep work', 'attention', 'habits', 'execution'],
  requirements: [
    'Have a consistent weekly schedule for focused work.',
    'Bring one real project you want to complete.',
    'Be ready to review your environment and habits honestly.',
  ],
  learningOutcomes: [
    'Design a distraction-resistant workflow.',
    'Build a repeatable deep work routine.',
    'Create a practical system for tracking progress.',
  ],
  sources: [
    {
      id: 'source-1',
      type: 'YouTube Playlist',
      title: 'Deep Work Foundations',
      url: 'https://www.youtube.com/playlist?list=PL-sidequest-deep-work',
      collapsed: false,
    },
    {
      id: 'source-2',
      type: 'Website',
      title: 'Attention design notes',
      url: 'https://sidequesthq.com/deep-work-notes',
      collapsed: false,
    },
    {
      id: 'source-3',
      type: 'PDF',
      title: 'Focus system playbook',
      url: 'https://cdn.sidequesthq.com/playbooks/focus-system.pdf',
      collapsed: true,
    },
  ],
};

