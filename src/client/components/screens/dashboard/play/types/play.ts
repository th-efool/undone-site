export interface Lesson {
    platform: "youtube" | "coursera" | "udemy" | "book";

    title: string;

    currentVideo: number;
    totalVideos: number;

    currentChunk: number;
    totalChunks: number;

    currentTime: string;
    totalDuration: string;
}

export interface TimelineMarker {
    id: string;

    position: number; // 0-100

    variant:
        | "checkpoint"
        | "quiz"
        | "note"
        | "chapter"
        | "bookmark";

    active?: boolean;
}

export type PlayerTool =
    | "scribe"
    | "capture"
    | "bookmark"
    | "speed"
    | "menu";