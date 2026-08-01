import { exploreMock } from '@/src/client/components/screens/dashboard/explore/mock/explore.mock';
import type { ExploreModel, TrendingCourse } from '@/src/client/components/screens/dashboard/explore/models';
import { isNativeApp } from '@/src/client/utils/isNative';
import { cohortRepository } from './cohortRepository';

const realPeopleFinishing: TrendingCourse[] = [
  {
    id: 'dsa-only-whats-needed',
    title: "DSA — Only What's Needed",
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
    durationLabel: '8h 45m',
    learnerCount: '8.4k learners',
    rating: 4.9,
    featuredLearners: [
      { id: '1', image: '/mock/avatars/a.webp', alt: 'Learner' },
      { id: '2', image: '/mock/avatars/b.webp', alt: 'Learner' },
      { id: '3', image: '/mock/avatars/c.webp', alt: 'Learner' },
    ],
  },
  {
    id: 'operating-systems-core',
    title: 'Operating Systems',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
    durationLabel: '16h 23m',
    learnerCount: '5.6k learners',
    rating: 4.7,
    featuredLearners: [
      { id: '4', image: '/mock/avatars/b.webp', alt: 'Learner' },
      { id: '5', image: '/mock/avatars/d.webp', alt: 'Learner' },
      { id: '6', image: '/mock/avatars/e.webp', alt: 'Learner' },
    ],
  },
  {
    id: 'rajvansh-dynasties-of-india',
    title: 'Rajvansh: Dynasties Of India',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/mHE5iGgQHj0/maxresdefault.jpg',
    durationLabel: '8h 30m',
    learnerCount: '5.2k learners',
    rating: 4.95,
    featuredLearners: [
      { id: '7', image: '/mock/avatars/c.webp', alt: 'Learner' },
      { id: '8', image: '/mock/avatars/e.webp', alt: 'Learner' },
      { id: '9', image: '/mock/avatars/a.webp', alt: 'Learner' },
    ],
  },
  {
    id: 'networking-fundamentals',
    title: 'Networking',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
    durationLabel: '14h 15m',
    learnerCount: '4.2k learners',
    rating: 4.8,
    featuredLearners: [
      { id: '10', image: '/mock/avatars/d.webp', alt: 'Learner' },
      { id: '11', image: '/mock/avatars/a.webp', alt: 'Learner' },
      { id: '12', image: '/mock/avatars/b.webp', alt: 'Learner' },
    ],
  },
  {
    id: 'celtic-mythology',
    title: 'Celtic Mythology',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/hMP_V2WWl3s/maxresdefault.jpg',
    durationLabel: '3h 30m',
    learnerCount: '3.1k learners',
    rating: 4.9,
    featuredLearners: [
      { id: '13', image: '/mock/avatars/e.webp', alt: 'Learner' },
      { id: '14', image: '/mock/avatars/c.webp', alt: 'Learner' },
      { id: '15', image: '/mock/avatars/d.webp', alt: 'Learner' },
    ],
  },
];

export const exploreRepository = {
  getExplore(): ExploreModel {
    const base = structuredClone(exploreMock);
    const userCohorts = cohortRepository.list();

    const userPublished = userCohorts.map((c) => ({
      id: c.id,
      title: c.title,
      author: c.creator?.name || 'Shaqun',
      thumbnail: c.coverImage || 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
      learnerCount: '1 learner',
      publishedLabel: 'Just now',
      bookmarked: false,
    }));

    if (isNativeApp()) {
      return {
        ...base,
        peopleFinishing: realPeopleFinishing,
        recentlyPublished: userPublished.length > 0 ? userPublished : base.recentlyPublished.slice(0, 2),
      };
    }

    return {
      ...base,
      recentlyPublished: [...userPublished, ...base.recentlyPublished],
    };
  },
};
