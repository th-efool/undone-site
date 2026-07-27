import type {
    Lesson,
    TimelineMarker,
} from "./play";

export const lesson: Lesson = {
    platform: "youtube",

    title: "Machine Learning in 2 Weeks",

    currentVideo: 7,
    totalVideos: 14,

    currentChunk: 9,
    totalChunks: 32,

    currentTime: "15:42",
    totalDuration: "22:01",
};

export const timelineMarkers: TimelineMarker[] = [
    {
        id: "chapter-1",
        position: 18,
        variant: "checkpoint",
    },
    {
        id: "quiz",
        position: 49,
        variant: "quiz",
        active: true,
    },
    {
        id: "chapter-2",
        position: 72,
        variant: "chapter",
    },
    {
        id: "bookmark",
        position: 90,
        variant: "bookmark",
    },
];