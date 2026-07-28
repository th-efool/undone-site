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
        role: "Author, Professor, Researcher",
        bio: "I write about digital minimalism, deep work, and how to live a focused life.",
        ctaLabel: "View Quest Guide Profile",
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
    overview: {
        description:
            "Deep Work Mastery is a comprehensive journey created to help you build the skill of deep focus in a world of constant distraction. You'll learn the theory, practice the habits, and implement systems that make deep work your superpower.",
        pillars: [
            {
                id: "build-focus",
                icon: "target",
                title: "Build Focus",
                description: "Eliminate shallow work and train your attention.",
            },
            {
                id: "do-better-work",
                icon: "brain",
                title: "Do Better Work",
                description: "Create high-value work that compounds.",
            },
            {
                id: "live-better-life",
                icon: "leaf",
                title: "Live A Better Life",
                description: "More depth in your work. More meaning in your time.",
            },
        ],
        learningObjectives: [
            {
                id: "philosophy",
                text: "The philosophy behind deep work",
            },
            {
                id: "focus-strategies",
                text: "Advanced focus strategies",
            },
            {
                id: "eliminate-shallow-work",
                text: "How to eliminate shallow work",
            },
            {
                id: "distraction-free-systems",
                text: "Systems for distraction-free execution",
            },
            {
                id: "routine",
                text: "Build a deep work routine that sticks",
            },
            {
                id: "lifestyle",
                text: "Sustaining a deep work lifestyle",
            },
        ],
        journeySummary: [
            {
                id: "quest-length",
                icon: "clock",
                label: "Quest Length",
                value: "20–25 hours",
            },
            {
                id: "quests",
                icon: "brain",
                label: "Quests",
                value: "116 quests",
            },
            {
                id: "side-quests",
                icon: "assignment",
                label: "Side Quests",
                value: "8 assignments",
            },
        ],
        expeditionStats: [
            {
                id: "lessons",
                icon: "lesson",
                label: "Lessons",
                value: "116",
            },
            {
                id: "seasons",
                icon: "book",
                label: "Seasons",
                value: "2",
            },
            {
                id: "assignments",
                icon: "assignment",
                label: "Assignments",
                value: "8",
            },
            {
                id: "projects",
                icon: "project",
                label: "Projects",
                value: "3",
            },
            {
                id: "public-notes",
                icon: "notes",
                label: "Public Notes",
                value: "189",
            },
            {
                id: "estimated-completion",
                icon: "clock",
                label: "Estimated Completion",
                value: "3–4 weeks",
            },
        ],
        expeditionProgress: [
            {
                id: "current-streak",
                icon: "flame",
                label: "Current Streak",
                value: "18 days",
            },
            {
                id: "time-invested",
                icon: "clock",
                label: "Total Time Invested",
                value: "9h 42m",
            },
            {
                id: "field-notes",
                icon: "file",
                label: "Field Notes Shared",
                value: "24",
            },
            {
                id: "helpful-notes",
                icon: "heart",
                label: "Helpful Notes",
                value: "6",
            },
        ],
        activeExplorers: [
            "/images/logos/floating-logo.webp",
            "/images/logos/floating-logo.png",
            "/images/logos/sidequesthq-logo.webp",
            "/images/logos/floating-logo.webp",
            "/images/logos/floating-logo.png",
            "/images/logos/sidequesthq-logo.webp",
        ],
        activeExplorerOverflow: "+256",
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
