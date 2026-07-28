import { LessonStatus, LessonType, SeasonStatus } from "../models";
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
    questline: {
        title: "The Questline",
        description: "Follow the path. Complete quests and level up your focus.",
        filters: [
            { id: "all", label: "All" },
            { id: "quests", label: "Quests" },
            { id: "assignments", label: "Assignments" },
            { id: "projects", label: "Projects" },
        ],
        skipSeasonLabel: "Skip to Season",
        seasons: [
            {
                id: "foundation",
                badge: "Season 1",
                title: "Foundation",
                status: SeasonStatus.Completed,
                progress: 100,
                estimatedDuration: "~6.5 hrs",
                questCount: 6,
                summaryLabel: "View Season Summary",
                lessons: [
                    {
                        id: "what-is-deep-work",
                        title: "What Is Deep Work?",
                        type: LessonType.Video,
                        duration: "12 min",
                        status: LessonStatus.Completed,
                        thumbnail: "/images/landing/coffee-break.webp",
                    },
                    {
                        id: "four-disciplines",
                        title: "The Four Disciplines",
                        type: LessonType.Video,
                        duration: "18 min",
                        status: LessonStatus.Completed,
                        thumbnail: "/images/landing/before-sleep.webp",
                    },
                    {
                        id: "focus-vs-distraction",
                        title: "Focus vs Distraction",
                        type: LessonType.Reading,
                        duration: "10 min read",
                        status: LessonStatus.Completed,
                        thumbnail: "/images/landing/metro-ride.webp",
                    },
                    {
                        id: "environment-design",
                        title: "Environment Design",
                        type: LessonType.Video,
                        duration: "14 min",
                        status: LessonStatus.InProgress,
                        thumbnail: "/images/landing/waiting.webp",
                    },
                    {
                        id: "deep-work-rituals",
                        title: "Deep Work Rituals",
                        type: LessonType.Reading,
                        duration: "8 min read",
                        status: LessonStatus.InProgress,
                        thumbnail: "/images/landing/cab-ride.webp",
                    },
                    {
                        id: "season-one-challenge",
                        title: "Season 1 Challenge",
                        type: LessonType.Assignment,
                        duration: "~20 min",
                        status: LessonStatus.Ready,
                        thumbnail: "/images/landing/hand.webp",
                    },
                ],
            },
            {
                id: "deep-practices",
                badge: "Season 2",
                title: "Deep Practices",
                status: SeasonStatus.Locked,
                progress: 0,
                estimatedDuration: "~7 hrs",
                questCount: 5,
                summaryLabel: "View Season Summary",
                lockedMessage: "Complete all Season 1 quests to unlock",
                lessons: [
                    {
                        id: "time-blocking-depth",
                        title: "Time Blocking for Depth",
                        type: LessonType.Video,
                        duration: "16 min",
                        status: LessonStatus.Locked,
                        thumbnail: "/images/landing/phone.webp",
                    },
                    {
                        id: "handling-shallow-work",
                        title: "Handling Shallow Work",
                        type: LessonType.Video,
                        duration: "15 min",
                        status: LessonStatus.Locked,
                        thumbnail: "/images/landing/screen.webp",
                    },
                ],
            },
        ],
        feedTitle: "Assignments & Projects",
        feedDescription: "Complete to earn points. Share your work with the community or just mark as done.",
        feedSeasonLabel: "Season 1",
        feedViewAllLabel: "View All Assignments & Projects",
        assignmentFeed: [
            {
                id: "season-one-challenge-feed",
                title: "Season 1 Challenge",
                type: LessonType.Assignment,
                description: "Design your ideal deep work setup.",
                duration: "~20 min",
                thumbnail: "/images/landing/hand.webp",
                icon: "assignment",
                participants: [
                    { id: "one", avatarUrl: "/images/logos/floating-logo.webp" },
                    { id: "two", avatarUrl: "/images/logos/floating-logo.png" },
                    { id: "three", avatarUrl: "/images/logos/sidequesthq-logo.webp" },
                ],
                submittedCount: "+238 submitted",
                shareLabel: "Share Work",
                doneLabel: "Mark as Done",
            },
            {
                id: "deep-work-journal",
                title: "Deep Work Journal",
                type: LessonType.Assignment,
                description: "Track your daily focus for 7 days.",
                duration: "~15 min",
                thumbnail: "/images/landing/waiting.webp",
                icon: "clock",
                participants: [
                    { id: "four", avatarUrl: "/images/logos/floating-logo.webp" },
                    { id: "five", avatarUrl: "/images/logos/floating-logo.png" },
                    { id: "six", avatarUrl: "/images/logos/sidequesthq-logo.webp" },
                ],
                submittedCount: "+142 submitted",
                shareLabel: "Share Work",
                doneLabel: "Mark as Done",
            },
            {
                id: "mini-project",
                title: "Season 1 Mini Project",
                type: LessonType.Project,
                description: "Build your personal focus system.",
                duration: "~2–3 hrs",
                thumbnail: "/images/landing/metro-ride.webp",
                icon: "project",
                participants: [
                    { id: "seven", avatarUrl: "/images/logos/floating-logo.webp" },
                    { id: "eight", avatarUrl: "/images/logos/floating-logo.png" },
                    { id: "nine", avatarUrl: "/images/logos/sidequesthq-logo.webp" },
                ],
                submittedCount: "+89 submitted",
                shareLabel: "Share Work",
                doneLabel: "Mark as Done",
            },
        ],
        lockedFutureNotice: {
            icon: "compass",
            title: "Upcoming items from future seasons are locked.",
            description: "Skip to a new season anytime to begin.",
        },
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
