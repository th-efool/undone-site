export type HallAccent = "amber" | "slate" | "green" | "violet" | "orange" | "blue";

export interface HallFilter {
    id: string;
    label: string;
    active?: boolean;
}

export interface TimeRangeOption {
    id: string;
    label: string;
    active?: boolean;
}

export interface LeaderboardWinner {
    name: string;
    avatarUrl: string;
}

export interface HallCategory {
    id: string;
    title: string;
    subtitle: string;
    rank: number;
    winner: LeaderboardWinner;
    primaryMetric: string;
    growthMetric: string;
    badge: string;
    accent: HallAccent;
}

export interface LegendEntry {
    id: string;
    rank: number;
    avatarUrl: string;
    name: string;
    achievementTitle: string;
    primaryMetric: string;
}

export interface HighlightEntry {
    id: string;
    rank: string;
    label: string;
    metric: string;
    icon: string;
}

export interface AchievementEntry {
    id: string;
    icon: string;
    title: string;
    description: string;
    earnedTime: string;
}

export interface CohortHallOfFame {
    title: string;
    subtitle: string;
    filters: HallFilter[];
    timeRanges: TimeRangeOption[];
    categories: HallCategory[];
    legends: LegendEntry[];
    userHighlights: HighlightEntry[];
    recentAchievements: AchievementEntry[];
}
