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
  'Business & Finance',
  'AI & Machine Learning',
  'Programming & Tech',
  'Design & Creative',
  'Marketing & Sales',
  'Productivity & Growth',
  'Science & Academics',
  'Health & Lifestyle',
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
  sources: [],
};
