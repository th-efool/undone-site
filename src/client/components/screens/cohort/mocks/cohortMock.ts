import type { Cohort, NavigationItem } from "../models";

export const cohortMock: Cohort = {
    id: "deep-work-mastery",
    coverImage: "/images/landing/coffee-break.webp",
    title: "Deep Work Mastery",
    subtitle: "Build the focus system for ambitious creators.",
    description:
        "A guided cohort for designing your environment, protecting attention, and completing meaningful work without constant context switching.",
    difficulty: "Intermediate",
    categories: [
        {
            id: "productivity",
            label: "Productivity",
        },
        {
            id: "focus",
            label: "Focus",
        },
        {
            id: "career-growth",
            label: "Career Growth",
        },
    ],
    creator: {
        id: "maya-rivers",
        name: "Maya Rivers",
        avatarUrl: "/images/logos/floating-logo.webp",
    },
    stats: {
        rating: 4.9,
        explorerCount: 12480,
        completionRate: 68,
    },
    progress: {
        journeyProgress: 42,
        completedQuests: 9,
        totalQuests: 21,
        dailyGoal: "45 minutes of focused work",
        joinedDate: "June 12, 2026",
    },
};

export const cohortNavigationItems: NavigationItem[] = [
    {
        id: "overview",
        label: "Overview",
        href: "/cohort/deep-work-mastery/overview",
    },
    {
        id: "questline",
        label: "Questline",
        href: "/cohort/deep-work-mastery/questline",
    },
    {
        id: "archives",
        label: "Archives",
        href: "/cohort/deep-work-mastery/archives",
    },
    {
        id: "events",
        label: "Events",
        href: "/cohort/deep-work-mastery/events",
    },
    {
        id: "hall-of-fame",
        label: "Hall of Fame",
        href: "/cohort/deep-work-mastery/hall-of-fame",
    },
];

export const cohortsMock: Cohort[] = [cohortMock];
