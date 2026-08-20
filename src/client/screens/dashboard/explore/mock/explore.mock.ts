import type { ExploreModel } from '../models';

export const exploreMock: ExploreModel = {
  searchSuggestions: [
    { id: '1', label: 'JavaScript Fundamentals' },
    { id: '2', label: 'React Hooks Deep Dive' },
    { id: '3', label: 'Advanced CSS Layouts' },
  ],
  peopleFinishing: [],
  topics: [
    { id: '1', name: 'Web Development', icon: 'code', color: 'blue' },
    { id: '2', name: 'Data Science', icon: 'database', color: 'green' },
    { id: '3', name: 'Design Systems', icon: 'pen-tool', color: 'purple' },
  ],
  trendingSideQuests: [
    {
      id: '1',
      title: 'Build a Next.js Dashboard',
      subtitle: 'Create a full-stack dashboard with Next.js, Prisma, and PostgreSQL.',
      dailyGoal: '1h',
      thumbnail: '/mock/thumbnails/docker.avif',
      featuredParticipants: [],
      participantCount: '1.2k',
    },
    {
      id: '2',
      title: 'Master Framer Motion',
      subtitle: 'Learn advanced animation techniques for React applications.',
      dailyGoal: '45m',
      thumbnail: '/mock/thumbnails/docker.avif',
      featuredParticipants: [],
      participantCount: '850',
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
