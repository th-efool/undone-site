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
    peopleFinishing: [],
    topics: [],
    trendingSideQuests: [],
    recentlyPublished: [],
}


