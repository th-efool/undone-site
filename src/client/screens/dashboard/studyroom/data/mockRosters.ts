// DEMONSTRATION DATA — replace with live presence (see docs/plans/study-rooms-frontend-plan.md §10).
import type { MockPeer, RoomSlug } from '../types';

export const MOCK_ROSTERS: Record<RoomSlug, MockPeer[]> = {
  library: [
    {
      userId: 'demo-mira',
      displayName: 'Mira',
      avatarUrl: null,
      joinedMinutesAgo: 94,
      publicGoal: 'Finish chapter 4 notes',
    },
    {
      userId: 'demo-jonas',
      displayName: 'Jonas',
      avatarUrl: null,
      joinedMinutesAgo: 38,
      publicGoal: null,
    },
    {
      userId: 'demo-priya',
      displayName: 'Priya',
      avatarUrl: null,
      joinedMinutesAgo: 12,
      publicGoal: 'Revise organic chemistry',
    },
  ],
  fireplace: [
    {
      userId: 'demo-sam',
      displayName: 'Sam',
      avatarUrl: null,
      joinedMinutesAgo: 55,
      publicGoal: 'Outline thesis intro',
    },
    {
      userId: 'demo-lena',
      displayName: 'Lena',
      avatarUrl: null,
      joinedMinutesAgo: 7,
      publicGoal: null,
    },
  ],
  'developer-den': [
    {
      userId: 'demo-kai',
      displayName: 'Kai',
      avatarUrl: null,
      joinedMinutesAgo: 130,
      publicGoal: 'Ship the auth refactor',
    },
    {
      userId: 'demo-ada',
      displayName: 'Ada',
      avatarUrl: null,
      joinedMinutesAgo: 61,
      publicGoal: null,
    },
    {
      userId: 'demo-omar',
      displayName: 'Omar',
      avatarUrl: null,
      joinedMinutesAgo: 3,
      publicGoal: 'Fix flaky tests',
    },
  ],
};
