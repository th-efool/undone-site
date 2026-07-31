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
  'Programming',
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
  coverImage: '',
  title: '',
  subtitle: '',
  description: '',
  difficulty: 'Beginner',
  categories: [],
  visibility: 'Public',
  estimatedCompletionTime: '2-4 weeks',
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
      title: '',
      url: '',
      collapsed: false,
    },
  ],
};
