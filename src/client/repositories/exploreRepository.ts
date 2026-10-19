import type { ExploreModel, TrendingCourse } from '@/src/client/screens/dashboard/explore/models';
import { isNativeApp } from '@/src/client/utils/isNative';
import { cohortRepository } from './cohortRepository';
import { getAvatarSlice } from '@/src/client/mock/avatars';

const realPeopleFinishing: TrendingCourse[] = [
  {
    id: 'dsa-only-whats-needed',
    title: "DSA — Only What's Needed",
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
    durationLabel: '8h 45m',
    learnerCount: '8.4k learners',
    rating: 4.9,
    featuredLearners: getAvatarSlice(3, 0).map((image, i) => ({ id: `dsa-${i}`, image, alt: 'Learner' })),
  },
  {
    id: 'operating-systems-core',
    title: 'Operating Systems',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
    durationLabel: '16h 23m',
    learnerCount: '5.6k learners',
    rating: 4.7,
    featuredLearners: getAvatarSlice(3, 3).map((image, i) => ({ id: `os-${i}`, image, alt: 'Learner' })),
  },
  {
    id: 'rajvansh-dynasties-of-india',
    title: 'Rajvansh: Dynasties Of India',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/mHE5iGgQHj0/maxresdefault.jpg',
    durationLabel: '8h 30m',
    learnerCount: '5.2k learners',
    rating: 4.95,
    featuredLearners: getAvatarSlice(3, 6).map((image, i) => ({ id: `raj-${i}`, image, alt: 'Learner' })),
  },
  {
    id: 'networking-fundamentals',
    title: 'Networking',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
    durationLabel: '14h 15m',
    learnerCount: '4.2k learners',
    rating: 4.8,
    featuredLearners: getAvatarSlice(3, 9).map((image, i) => ({ id: `net-${i}`, image, alt: 'Learner' })),
  },
  {
    id: 'celtic-mythology',
    title: 'Celtic Mythology',
    provider: 'youtube',
    thumbnail: 'https://i.ytimg.com/vi/hMP_V2WWl3s/maxresdefault.jpg',
    durationLabel: '3h 30m',
    learnerCount: '3.1k learners',
    rating: 4.9,
    featuredLearners: getAvatarSlice(3, 11).map((image, i) => ({ id: `celtic-${i}`, image, alt: 'Learner' })),
  },
];

const EXPLORE_CACHE_KEY = 'sidequest_explore_cache_v1';

const FALLBACK_EXPLORE: ExploreModel = {
  searchSuggestions: [
    { id: '1', label: 'DSA' },
    { id: '2', label: 'Operating Systems' },
    { id: '3', label: 'Networking' },
    { id: '4', label: 'Dynasties of India' },
    { id: '5', label: 'Celtic Mythology' },
  ],
  peopleFinishing: realPeopleFinishing,
  topics: [
    { id: 'cs-core', name: 'Computer Science Core', icon: 'cpu', color: '#6366f1' },
    { id: 'history', name: 'World & Indian History', icon: 'globe', color: '#ec4899' },
    { id: 'systems', name: 'Systems & Networking', icon: 'layers', color: '#3b82f6' },
    { id: 'mythology', name: 'Mythology & Culture', icon: 'sparkles', color: '#f59e0b' },
  ],
  trendingSideQuests: realPeopleFinishing.map((item) => ({
    id: item.id,
    cohortId: item.id,
    title: item.title,
    subtitle: `${item.durationLabel} • ${item.learnerCount}`,
    dailyGoal: '20 min/day',
    thumbnail: item.thumbnail,
    featuredParticipants: item.featuredLearners,
    participantCount: item.learnerCount,
  })),
  recentlyPublished: realPeopleFinishing.map((item) => ({
    id: item.id,
    cohortId: item.id,
    title: item.title,
    author: 'SideQuest Guide',
    thumbnail: item.thumbnail,
    learnerCount: item.learnerCount,
    publishedLabel: 'Featured',
    bookmarked: false,
  })),
};

let memoryExploreCache: ExploreModel | null = null;
let lastExploreFetchTime = 0;
const EXPLORE_TTL_MS = 60_000;

export const exploreRepository = {
  getInitialExplore(): ExploreModel {
    if (memoryExploreCache) return memoryExploreCache;
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const raw = localStorage.getItem(EXPLORE_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ExploreModel;
          if (parsed && Array.isArray(parsed.trendingSideQuests)) {
            memoryExploreCache = parsed;
            return parsed;
          }
        }
      } catch {}
    }
    return FALLBACK_EXPLORE;
  },

  async getExplore(): Promise<ExploreModel> {
    if (
      memoryExploreCache &&
      Date.now() - lastExploreFetchTime < EXPLORE_TTL_MS &&
      process.env.NODE_ENV !== 'test'
    ) {
      return memoryExploreCache;
    }

    const res = await fetch('/api/explore');
    if (!res.ok) {
      throw new Error('Failed to fetch explore data');
    }
    const base: ExploreModel = await res.json();

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

    const result: ExploreModel = isNativeApp()
      ? {
          ...base,
          peopleFinishing: realPeopleFinishing,
          recentlyPublished: userPublished.length > 0 ? userPublished : base.recentlyPublished.slice(0, 2),
        }
      : {
          ...base,
          recentlyPublished: [...userPublished, ...base.recentlyPublished],
        };

    memoryExploreCache = result;
    lastExploreFetchTime = Date.now();
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        localStorage.setItem(EXPLORE_CACHE_KEY, JSON.stringify(result));
      } catch {}
    }
    return result;
  },
};
