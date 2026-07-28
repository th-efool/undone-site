export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface Category {
    id: string;
    label: string;
}

export interface Creator {
    id: string;
    name: string;
    avatarUrl: string;
}

export interface CohortStats {
    rating: number;
    explorerCount: number;
    completionRate: number;
}

export interface Progress {
    journeyProgress: number;
    completedQuests: number;
    totalQuests: number;
    dailyGoal: string;
    joinedDate: string;
}

export interface Cohort {
    id: string;
    coverImage: string;
    title: string;
    subtitle: string;
    description: string;
    difficulty: Difficulty;
    categories: Category[];
    creator: Creator;
    stats: CohortStats;
    progress: Progress;
}
