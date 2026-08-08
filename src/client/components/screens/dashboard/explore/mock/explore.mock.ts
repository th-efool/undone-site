import type { ExploreModel } from '../models';
import { getAvatar } from '@/src/client/mock/avatars';

export const exploreMock: ExploreModel = {
  searchSuggestions: [],
  peopleFinishing: [
    {
      id: 'docker',

      title: 'Docker & Kubernetes Bootcamp',

      provider: 'youtube',

      thumbnail: '/mock/thumbnails/docker.avif',

      durationLabel: '10h 12m',

      featuredLearners: [
        { id: '24', image: getAvatar('docker-1'), alt: '24' },
        { id: '25', image: getAvatar('docker-2'), alt: '25' },
        { id: '26', image: getAvatar('docker-3'), alt: '26' },
      ],

      learnerCount: '11.6k learners',

      rating: 4.8,
    },

    {
      id: 'python',

      title: 'Python for Data Science',

      provider: 'vimeo',

      thumbnail: '/mock/thumbnails/data-science.avif',

      durationLabel: '7h 32m',

      featuredLearners: [
        { id: '27', image: getAvatar('py-1'), alt: '27' },
        { id: '28', image: getAvatar('py-2'), alt: '28' },
        { id: '29', image: getAvatar('py-3'), alt: '29' },
      ],

      learnerCount: '8.9k learners',

      rating: 4.9,
    },
    {
      id: 'machine-learning',

      title: 'Machine Learning Specialization',

      provider: 'youtube',

      thumbnail: '/mock/thumbnails/machine-learning.avif',

      durationLabel: '8h 24m',

      featuredLearners: [
        { id: '30', image: getAvatar('sd-1'), alt: '30' },
        { id: '31', image: getAvatar('sd-2'), alt: '31' },
        { id: '32', image: getAvatar('sd-3'), alt: '32' },
      ],

      learnerCount: '18.2k learners',

      rating: 4.9,
    },

    {
      id: 'react',

      title: 'Modern React From Scratch',

      provider: 'loom',

      thumbnail: '/mock/thumbnails/react.webp',

      durationLabel: '6h 45m',

      featuredLearners: [
        { id: '33', image: getAvatar('ml-1'), alt: '33' },
        { id: '34', image: getAvatar('ml-2'), alt: '34' },
        { id: '35', image: getAvatar('ml-3'), alt: '35' },
      ],

      learnerCount: '5.4k learners',

      rating: 4.7,
    },

    {
      id: 'design',

      title: 'UI Design Fundamentals',

      provider: 'vimeo',

      thumbnail: '/mock/thumbnails/ui-fundamentals.webp',

      durationLabel: '3h 18m',

      featuredLearners: [
        {
          id: '10',
          image: getAvatar('ds-1'),
          alt: 'av10',
        },
        {
          id: '11',
          image: getAvatar('ds-2'),
          alt: 'av11',
        },
        {
          id: '12',
          image: getAvatar('ds-3'),
          alt: 'av12',
        },
      ],

      learnerCount: '14.1k learners',

      rating: 4.9,
    },

    {
      id: 'system-design',

      title: 'System Design Interview Course',

      provider: 'youtube',

      thumbnail: '/mock/thumbnails/system-design.jpeg',

      durationLabel: '12h 08m',

      featuredLearners: [
        { id: '39', image: getAvatar('ai-1'), alt: '39' },
        { id: '40', image: getAvatar('ai-2'), alt: '40' },
        { id: '41', image: getAvatar('ai-3'), alt: '41' },
      ],

      learnerCount: '9.7k learners',

      rating: 4.8,
    },
  ],
  topics: [
    {
      id: 'trending',
      name: 'Trending',
      icon: 'trending',
      color: '#EAB308',
    },
    {
      id: 'acting',
      name: 'Acting & Performing Arts',
      icon: 'acting',
      color: '#A855F7',
    },
    {
      id: 'art-design',
      name: 'Art & Design',
      icon: 'design',
      color: '#EC4899',
    },
    {
      id: 'business',
      name: 'Business & Entrepreneurship',
      icon: 'business',
      color: '#22C55E',
    },
    {
      id: 'community',
      name: 'Community & Government',
      icon: 'community',
      color: '#3B82F6',
    },
    {
      id: 'film-tv',
      name: 'Film & TV',
      icon: 'film',
      color: '#EF4444',
    },
    {
      id: 'food-drink',
      name: 'Food & Drink',
      icon: 'food',
      color: '#F97316',
    },
    {
      id: 'games',
      name: 'Games & Digital Media',
      icon: 'games',
      color: '#06B6D4',
    },
    {
      id: 'health',
      name: 'Health & Wellness',
      icon: 'health',
      color: '#10B981',
    },
    {
      id: 'music',
      name: 'Music',
      icon: 'music',
      color: '#EC4899',
    },
    {
      id: 'outdoor',
      name: 'Outdoor Adventures & Events',
      icon: 'outdoor',
      color: '#84CC16',
    },
    {
      id: 'science',
      name: 'Science & Technology',
      icon: 'science',
      color: '#6366F1',
    },
    {
      id: 'sports',
      name: 'Sports & Athletics',
      icon: 'sports',
      color: '#F59E0B',
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: 'writing',
      color: '#3B82F6',
    },
    {
      id: 'it',
      name: 'IT',
      icon: 'it',
      color: '#3B82F6',
    },
  ],
  trendingSideQuests: [
    {
      id: 'deep-work',

      title: 'Deep Work Month',

      subtitle: 'Stay off.\nDo what matters.',

      dailyGoal: '20 min/day',

      thumbnail: '/mock/thumbnails/deep-work.webp',

      featuredParticipants: [
        { id: '13', image: getAvatar('dw-1'), alt: '13' },
        { id: '14', image: getAvatar('dw-2'), alt: '14' },
        { id: '15', image: getAvatar('dw-3'), alt: '15' },
      ],

      participantCount: '874 participants',
    },

    {
      id: 'reader',

      title: 'Become a Reader Again',

      subtitle: 'Rebuild the habit.\nRead with intention.',

      dailyGoal: '15 min/day',

      thumbnail: '/mock/thumbnails/reader.webp',

      featuredParticipants: [
        { id: '16', image: getAvatar('read-1'), alt: '16' },
        { id: '17', image: getAvatar('read-2'), alt: '17' },
        { id: '18', image: getAvatar('read-3'), alt: '18' },
      ],

      participantCount: '1,243 participants',
    },

    {
      id: 'body-double',

      title: 'Body Doubling Room',

      subtitle: 'Focus better\ntogether.',

      dailyGoal: '',

      thumbnail: '/mock/thumbnails/doubling.webp',

      featuredParticipants: [
        { id: '19', image: getAvatar('bd-1'), alt: '19' },
        { id: '20', image: getAvatar('bd-2'), alt: '20' },
        { id: '21', image: getAvatar('bd-3'), alt: '21' },
      ],

      participantCount: '482 participants',
    },

    {
      id: 'content-bottle',

      title: 'Your Content\nin a Bottle',

      subtitle: 'Consumption detox.\nCurate what you actually want.',

      dailyGoal: '',

      thumbnail: '/mock/thumbnails/content-bottle.webp',

      featuredParticipants: [
        { id: '21', image: getAvatar('cb-1'), alt: '21' },
        { id: '22', image: getAvatar('cb-2'), alt: '22' },
        { id: '23', image: getAvatar('cb-3'), alt: '23' },
      ],

      participantCount: '1,102 participants',
    },
    {
      id: '100-days',

      title: '100 Days of Code',

      subtitle: 'Code daily.\nStay accountable.',

      dailyGoal: '30 min/day',

      thumbnail: '/mock/thumbnails/100dcode.jpg',

      featuredParticipants: [
        { id: '30', image: getAvatar('100d-1'), alt: '30' },
        { id: '31', image: getAvatar('100d-2'), alt: '31' },
        { id: '32', image: getAvatar('100d-3'), alt: '32' },
      ],

      participantCount: '2,016 participants',
    },

    {
      id: 'journaling',

      title: 'Daily Reflection',

      subtitle: 'Think clearly.\nWrite consistently.',

      dailyGoal: '10 min/day',

      thumbnail: '/mock/thumbnails/reflections.jpeg',

      featuredParticipants: [
        { id: '33', image: getAvatar('jrn-1'), alt: '33' },
        { id: '34', image: getAvatar('jrn-2'), alt: '34' },
        { id: '35', image: getAvatar('jrn-3'), alt: '35' },
      ],

      participantCount: '691 participants',
    },
  ],
  recentlyPublished: [
    {
      id: 'productivity-systems',

      title: 'Productivity Systems That Actually Work',

      author: 'Agrim Singh',

      thumbnail: '/mock/articles/productivity.webp',

      learnerCount: '5.2K learners',

      publishedLabel: '6h ago',

      bookmarked: false,
    },

    {
      id: 'habit-formation',

      title: 'Neuroscience of Habit Formation',

      author: 'Shaqun',

      thumbnail: '/mock/articles/habits.webp',

      learnerCount: '4.1K learners',

      publishedLabel: '1d ago',

      bookmarked: false,
    },

    {
      id: 'deep-work',

      title: 'Deep Work in a Distracted World',

      author: 'Rohan Gupta',

      thumbnail: '/mock/thumbnails/deep-work.webp',

      learnerCount: '3.8K learners',

      publishedLabel: '2d ago',

      bookmarked: false,
    },

    {
      id: 'space',

      title: 'Space Exploration Explained Simply',

      author: 'Vanshika Iyer',

      thumbnail: '/mock/thumbnails/space.jpeg',

      learnerCount: '2.7K learners',

      publishedLabel: '2d ago',

      bookmarked: false,
    },
  ],
};
