import { BookOpen, Check, Clock3, Flame } from 'lucide-react';

import type { HomeModel } from '../models';

export const homeMock: HomeModel = {
  hero: {
    title: 'My Cohorts',
    subtitle: 'Your learning journeys, all in one place.',
    actionLabel: 'New Cohort',
  },
  sections: {
    activeCohorts: { title: 'Active Cohorts' },
    continueLater: {
      title: 'Continue Later',
      subtitle: "We'll bring these back when the time is right.",
    },
    recentlyCompleted: {
      title: 'Recently Completed',
      subtitle: 'Nice work! Keep the momentum going.',
    },
  },
  searchPlaceholder: 'Search cohorts, topics, lessons...',
  summaries: [
    {
      id: 'today-goal',
      title: "Today's Goal",
      value: '41 / 60 min',
      icon: (
        <Clock3
          size={28}
          strokeWidth={2.4}
        />
      ),
      iconTone: 'brand',
      progress: {
        current: 41,
        target: 60,
        unit: 'min',
        percent: 68,
      },
    },
    {
      id: 'current-streak',
      title: 'Current Streak',
      value: '82 days',
      icon: (
        <Flame
          size={28}
          strokeWidth={2.4}
          fill="currentColor"
        />
      ),
      iconTone: 'orange',
      trendPath:
        'M4 34 C19 34, 30 34, 44 34 S64 34, 76 34 S93 16, 107 24 S126 36, 139 20 S158 20, 172 11 S193 19, 212 6',
    },
    {
      id: 'active-cohorts',
      title: 'Active Cohorts',
      value: '4',
      helperText: 'Keep learning!',
      helperTone: 'brand',
      icon: (
        <BookOpen
          size={28}
          strokeWidth={2.4}
        />
      ),
      iconTone: 'brand',
    },
    {
      id: 'finished-week',
      title: 'Finished This Week',
      value: '1',
      helperText: 'Great job!',
      helperTone: 'success',
      icon: (
        <Check
          size={28}
          strokeWidth={2.7}
        />
      ),
      iconTone: 'green',
    },
  ],
  activeCohorts: [
    {
      id: 'dsa-only-whats-needed',
      rank: 1,
      title: "DSA — Only What's Needed",
      provider: 'Kunal Kushwaha',
      thumbnail: 'https://i.ytimg.com/vi/rZ41y93P2Qo/maxresdefault.jpg',
      minutesToday: 18,
      dailyGoalMinutes: 20,
      progressPercent: 15,
      schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
      featured: true,
    },
    {
      id: 'operating-systems-core',
      rank: 2,
      title: 'Operating Systems',
      provider: 'CodeHelp - by Babbar',
      thumbnail: 'https://i.ytimg.com/vi/3obEP8eLsCw/maxresdefault.jpg',
      minutesToday: 8,
      dailyGoalMinutes: 15,
      progressPercent: 8,
      schedule: { days: ['Tue', 'Thu', 'Sat'], label: 'Tue, Thu, Sat' },
    },
    {
      id: 'networking-fundamentals',
      rank: 3,
      title: 'Networking',
      provider: 'Network Kings',
      thumbnail: 'https://i.ytimg.com/vi/nGvpClgugEI/maxresdefault.jpg',
      minutesToday: 5,
      dailyGoalMinutes: 15,
      progressPercent: 10,
      schedule: {
        days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        label: 'Everyday',
      },
    },
  ],
  continueLater: [
    {
      id: 'advanced-javascript',
      title: 'Advanced JavaScript',
      provider: 'Frontend Masters',
      thumbnail: '/mock/thumbnails/javascript.jpeg',
      minutesToday: 0,
      dailyGoalMinutes: 25,
      progressPercent: 62,
      schedule: { days: ['Mon', 'Wed', 'Fri'], label: 'Mon, Wed, Fri' },
      pausedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      resumeLabel: 'Resume in 2 weeks',
    },
    {
      id: 'japanese-beginners',
      title: 'Japanese for Beginners',
      provider: 'Nihongo Lab',
      thumbnail: '/mock/thumbnails/japanese.webp',
      minutesToday: 0,
      dailyGoalMinutes: 15,
      progressPercent: 34,
      schedule: { days: ['Tue', 'Thu', 'Sat'], label: 'Tue, Thu, Sat' },
      pausedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      resumeLabel: 'Resume in 5 days',
    },
    {
      id: 'ancient-civilizations',
      title: 'Ancient Civilizations',
      provider: 'History Academy',
      thumbnail: '/mock/thumbnails/civilization.jpeg',
      minutesToday: 0,
      dailyGoalMinutes: 20,
      progressPercent: 41,
      schedule: { days: ['Sun', 'Wed'], label: 'Sun, Wed' },
      pausedUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      resumeLabel: 'Resume in 3 weeks',
    },
    {
      id: 'data-storytelling',
      title: 'Data Storytelling',
      provider: 'Observable',
      thumbnail: '/mock/thumbnails/data-storytelling.jpg',
      minutesToday: 0,
      dailyGoalMinutes: 30,
      progressPercent: 58,
      schedule: { days: ['Mon', 'Thu'], label: 'Mon, Thu' },
      pausedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      resumeLabel: 'Resume next month',
    },
  ],
  recentlyCompleted: [
    {
      id: 'intro-philosophy',
      title: 'Introduction to Philosophy',
      thumbnail: '/mock/thumbnails/philosophy.jpg',
      completedLabel: 'Completed 3 days ago',
      progressPercent: 100,
    },
    {
      id: 'productivity-systems',
      title: 'Productivity Systems',
      thumbnail: '/images/landing/coffee-break.webp',
      completedLabel: 'Completed last week',
      progressPercent: 100,
    },
  ],
  pauseOptions: [
    { id: 'tomorrow', label: 'Tomorrow', days: 1 },
    { id: 'three-days', label: 'In 3 days', days: 3 },
    { id: 'one-week', label: 'In 1 week', days: 7 },
    { id: 'two-weeks', label: 'In 2 weeks', days: 14 },
    { id: 'one-month', label: 'In 1 month', days: 30 },
    { id: 'custom', label: 'Custom number of days' },
  ],
};
