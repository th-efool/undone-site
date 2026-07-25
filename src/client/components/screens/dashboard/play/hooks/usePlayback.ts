"use client";

import { useState } from "react";

import {
    lesson,
    timelineMarkers,
} from "../types/play.mock";

export function usePlayback() {
    const [
        isPlaying,
        setIsPlaying,
    ] = useState(true);

    const [
        volume,
        setVolume,
    ] = useState(90);

    const [
        playbackSpeed,
        setPlaybackSpeed,
    ] = useState(1);

    const [
        bookmarked,
        setBookmarked,
    ] = useState(false);

    const [
        isFullscreen,
        setIsFullscreen,
    ] = useState(false);

    return {
        lesson,

        timelineMarkers,

        isPlaying,

        volume,

        playbackSpeed,

        bookmarked,

        isFullscreen,

        setVolume,

        setPlaybackSpeed,

        setBookmarked,

        setIsFullscreen,

        togglePlayback() {
            setIsPlaying((playing) => !playing);
        },
    };
}