import type { ExploreModel } from '../models';

export const exploreMock: ExploreModel = {
  searchSuggestions: [
    { id: '1', title: 'JavaScript Fundamentals', type: 'recent' },
    { id: '2', title: 'React Hooks Deep Dive', type: 'trending' },
    { id: '3', title: 'Advanced CSS Layouts', type: 'popular' },
  ],
  peopleFinishing: [],
  topics: [
    { id: '1', name: 'Web Development', icon: 'code', count: 124 },
    { id: '2', name: 'Data Science', icon: 'database', count: 89 },
    { id: '3', name: 'Design Systems', icon: 'pen-tool', count: 56 },
  ],
  trendingSideQuests: [
    {
      id: '1',
      title: 'Build a Next.js Dashboard',
      description: 'Create a full-stack dashboard with Next.js, Prisma, and PostgreSQL.',
      difficulty: 'Intermediate',
      reward: '500 XP',
    },
    {
      id: '2',
      title: 'Master CSS Grid',
      description: 'Learn advanced CSS Grid techniques by building complex layouts.',
      difficulty: 'Beginner',
      reward: '300 XP',
    },
  ],
  recentlyPublished: [
    {
      id: '1',
      title: 'Understanding React Server Components',
      author: 'Jane Doe',
      thumbnail: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
      learnerCount: '1.2k learners',
      publishedLabel: '2 days ago',
      bookmarked: false,
    },
  ],
};
