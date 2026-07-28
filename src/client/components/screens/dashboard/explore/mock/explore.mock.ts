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
                id: "docker",

                title: "Docker & Kubernetes Bootcamp",

                provider: "youtube",

                thumbnail: "/mock/thumbnails/docker.avif",

                durationLabel: "10h 12m",

                featuredLearners: [
                    {
                        id: "24",
                        image: "/mock/avatars/a.webp",
                        alt: "24",
                    },
                    {
                        id: "25",
                        image: "/mock/avatars/c.webp",
                        alt: "25",
                    },
                    {
                        id: "26",
                        image: "/mock/avatars/e.webp",
                        alt: "26",
                    },
                ],

                learnerCount: "11.6k learners",

                rating: 4.8,
            },

            {
                id: "python",

                title: "Python for Data Science",

                provider: "vimeo",

                thumbnail: "/mock/thumbnails/data-science.avif",

                durationLabel: "7h 32m",

                featuredLearners: [
                    {
                        id: "27",
                        image: "/mock/avatars/b.webp",
                        alt: "27",
                    },
                    {
                        id: "28",
                        image: "/mock/avatars/d.webp",
                        alt: "28",
                    },
                    {
                        id: "29",
                        image: "/mock/avatars/f.webp",
                        alt: "29",
                    },
                ],

                learnerCount: "8.9k learners",

                rating: 4.9,
            },
            {
                id: "machine-learning",

                title: "Machine Learning Specialization",

                provider: "youtube",


                thumbnail: "/mock/thumbnails/machine-learning.avif",

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
                id: "react",

                title: "Modern React From Scratch",

                provider: "loom",

                thumbnail: "/mock/thumbnails/react.webp",

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

                thumbnail: "/mock/thumbnails/ui-fundamentals.webp",

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


            {
                id: "system-design",

                title: "System Design Interview Course",

                provider: "youtube",

                thumbnail: "/mock/thumbnails/system-design.jpeg",

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
        ],
    topics: [
        {
            id: "ai",
            name: "AI & ML",
            icon: "🧠",
            color: "#5B5BF7",
        },
        {
            id: "programming",
            name: "Programming",
            icon: "</>",
            color: "#3B82F6",
        },
        {
            id: "design",
            name: "Design",
            icon: "✏️",
            color: "#8B5CF6",
        },
        {
            id: "psychology",
            name: "Psychology",
            icon: "🧠",
            color: "#EC4899",
        },
        {
            id: "history",
            name: "History",
            icon: "🏛️",
            color: "#F97316",
        },
        {
            id: "math",
            name: "Math",
            icon: "π",
            color: "#6366F1",
        },
        {
            id: "business",
            name: "Business",
            icon: "📈",
            color: "#22C55E",
        },
        {
            id: "philosophy",
            name: "Philosophy",
            icon: "💡",
            color: "#8B5CF6",
        },
        {
            id: "languages",
            name: "Languages",
            icon: "文",
            color: "#F97316",
        },
        {
            id: "finance",
            name: "Finance",
            icon: "$",
            color: "#22C55E",
        },
        {
            id: "writing",
            name: "Writing",
            icon: "✍️",
            color: "#3B82F6",
        },
    ],
    trendingSideQuests: [
        {
            id: "deep-work",

            title: "Deep Work Month",

            subtitle: "Stay off.\nDo what matters.",

            dailyGoal: "20 min/day",

            thumbnail: "/mock/thumbnails/deep-work.webp",

            featuredParticipants: [
                {
                    id: "13",
                    image: "/mock/avatars/a.webp",
                    alt: "13"
                },
                {
                    id: "14",
                    image: "/mock/avatars/b.webp",
                    alt: "14",
                },
                {
                    id: "15",
                    image: "/mock/avatars/c.webp",
                    alt: "15",
                },
            ],

            participantCount: "874 participants",
        },

        {
            id: "reader",

            title: "Become a Reader Again",

            subtitle: "Rebuild the habit.\nRead with intention.",

            dailyGoal: "15 min/day",

            thumbnail: "/mock/thumbnails/reader.webp",

            featuredParticipants: [
                {
                    id: "16",
                    image: "/mock/avatars/d.webp",
                    alt: "16",
                },
                {
                    id: "17",
                    image: "/mock/avatars/e.webp",
                    alt: "17"
                },
                {
                    id: "18",
                    image: "/mock/avatars/f.webp",
                    alt: "18"
                },
            ],

            participantCount: "1,243 participants",
        },

        {
            id: "body-double",

            title: "Body Doubling Room",

            subtitle: "Focus better\ntogether.",

            dailyGoal: "",

            thumbnail: "/mock/thumbnails/doubling.webp",

            featuredParticipants: [
                {
                    id: "19",
                    image: "/mock/avatars/a.webp",
                    alt: "19",
                },
                {
                    id: "20",
                    image: "/mock/avatars/b.webp",
                    alt: "20",
                },
                {
                    id: "21",
                    image: "/mock/avatars/c.webp",
                    alt: "21"
                },
            ],

            participantCount: "482 participants",
        },

        {
            id: "content-bottle",

            title: "Your Content\nin a Bottle",

            subtitle: "Consumption detox.\nCurate what you actually want.",

            dailyGoal: "",

            thumbnail: "/mock/thumbnails/content-bottle.webp",

            featuredParticipants: [
                {
                    id: "21",
                    image: "/mock/avatars/d.webp",
                    alt: "21",
                },
                {
                    id: "22",
                    image: "/mock/avatars/e.webp",
                    alt : "22",
                },
                {
                    id: "23",
                    image: "/mock/avatars/f.webp",
                    alt: "23",
                },
            ],

            participantCount: "1,102 participants",
        },
        {
            id: "100-days",

            title: "100 Days of Code",

            subtitle: "Code daily.\nStay accountable.",

            dailyGoal: "30 min/day",

            thumbnail: "/mock/thumbnails/100dcode.jpg",

            featuredParticipants: [
                {
                    id: "30",
                    image: "/mock/avatars/a.webp",
                    alt: "30",
                },
                {
                    id: "31",
                    image: "/mock/avatars/d.webp",
                    alt: "31",
                },
                {
                    id: "32",
                    image: "/mock/avatars/e.webp",
                    alt: "32",
                },
            ],

            participantCount: "2,016 participants",
        },

        {
            id: "journaling",

            title: "Daily Reflection",

            subtitle: "Think clearly.\nWrite consistently.",

            dailyGoal: "10 min/day",

            thumbnail: "/mock/thumbnails/reflections.jpeg",

            featuredParticipants: [
                {
                    id: "33",
                    image: "/mock/avatars/b.webp",
                    alt: "33",
                },
                {
                    id: "34",
                    image: "/mock/avatars/c.webp",
                    alt: "34",
                },
                {
                    id: "35",
                    image: "/mock/avatars/f.webp",
                    alt: "35",
                },
            ],

            participantCount: "691 participants",
        },
    ],
    recentlyPublished: [
        {
            id: "productivity-systems",

            title: "Productivity Systems That Actually Work",

            author: "Agrim Singh",

            thumbnail: "/mock/articles/productivity.webp",

            learnerCount: "5.2K learners",

            publishedLabel: "6h ago",

            bookmarked: false,
        },

        {
            id: "habit-formation",

            title: "Neuroscience of Habit Formation",

            author: "Shaqun",

            thumbnail: "/mock/articles/habits.webp",

            learnerCount: "4.1K learners",

            publishedLabel: "1d ago",

            bookmarked: false,
        },

        {
            id: "deep-work",

            title: "Deep Work in a Distracted World",

            author: "Rohan Gupta",

            thumbnail: "/mock/thumbnails/deep-work.webp",

            learnerCount: "3.8K learners",

            publishedLabel: "2d ago",

            bookmarked: false,
        },

        {
            id: "space",

            title: "Space Exploration Explained Simply",

            author: "Vanshika Iyer",

            thumbnail: "/mock/thumbnails/space.jpeg",

            learnerCount: "2.7K learners",

            publishedLabel: "2d ago",

            bookmarked: false,
        },
    ],
}


