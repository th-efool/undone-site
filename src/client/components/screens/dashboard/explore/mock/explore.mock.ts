import type {ExploreModel} from "../models"

export const exploreMock: ExploreModel = {
    searchSuggestions: [],
    continueExploring: [
        {
            id: "ai-fundamentals",
            title: "AI Fundamentals",
            icon: "🧠",
            subtitle: "73% complete",
            progressPercent: 73,
            statusColor: "#5B5BF7",
        },
        {
            id: "psychology",
            title: "Psychology Basics",
            icon: "🧠",
            subtitle: "Next lesson • 11 min",
            statusColor: "#FF6B8A",
        },
        {
            id: "git",
            title: "Git & GitHub",
            icon: ">_",
            subtitle: "Review today",
            statusColor: "#22C55E",
        },
        {
            id: "german",
            title: "German Language",
            icon: "A",
            subtitle: "3 lessons pending",
            statusColor: "#F97316",
        },
        {
            id: "system-design",
            title: "System Design",
            icon: "⬡",
            subtitle: "67% complete",
            progressPercent: 67,
            statusColor: "#2563EB",
        },
    ],
        peopleFinishing: [
            {
                id: "machine-learning",

                title: "Machine Learning Specialization",

                provider: "youtube",

                thumbnail: "/images/auth/claude.webp",

                durationLabel: "8h 24m",

                featuredLearners: [
                    {
                        id: "1",
                        image: "/mock/avatars/d.webp",
                        alt: "av1"
                    },
                    {
                        id: "2",
                        image: "/mock/avatars/e.webp",
                        alt: "av2"
                    },
                    {
                        id: "3",
                        image: "/mock/avatars/a.webp",
                        alt: "av3"
                    },
                ],

                learnerCount: "18.2k learners",

                rating: 4.9,
            },

            {
                id: "system-design",

                title: "System Design Interview Course",

                provider: "youtube",

                thumbnail: "/images/auth/faceless.webp",

                durationLabel: "12h 08m",

                featuredLearners: [
                    {
                        id: "4",
                        image: "/mock/avatars/b.webp",
                        alt: "av4"
                    },
                    {
                        id: "5",
                        image: "/mock/avatars/c.webp",
                        alt: "av5"
                    },
                    {
                        id: "6",
                        image: "/mock/avatars/d.webp",
                        alt: "av6"
                    },
                ],

                learnerCount: "9.7k learners",

                rating: 4.8,
            },

            {
                id: "react",

                title: "Modern React From Scratch",

                provider: "loom",

                thumbnail: "/images/auth/maker.webp",

                durationLabel: "6h 45m",

                featuredLearners: [
                    {
                        id: "7",
                        image: "/mock/avatars/e.webp",
                        alt: "av7"
                    },
                    {
                        id: "8",
                        image: "/mock/avatars/a.webp",
                        alt: "av8"
                    },
                    {
                        id: "9",
                        image: "/mock/avatars/b.webp",
                        alt: "av9"
                    },
                ],

                learnerCount: "5.4k learners",

                rating: 4.7,
            },

            {
                id: "design",

                title: "UI Design Fundamentals",

                provider: "vimeo",

                thumbnail: "/images/auth/phone.webp",

                durationLabel: "3h 18m",

                featuredLearners: [
                    {
                        id: "10",
                        image: "/mock/avatars/c.webp",
                        alt: "av10"
                    },
                    {
                        id: "11",
                        image: "/mock/avatars/d.webp",
                        alt: "av11"
                    },
                    {
                        id: "12",
                        image: "/mock/avatars/e.webp",
                        alt: "av12"
                    },
                ],

                learnerCount: "14.1k learners",

                rating: 4.9,
            },
        ],
    topics: [],
    trendingSideQuests: [],
    recentlyPublished: [],
}


