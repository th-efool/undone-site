"use client"
import { Maximize2, Pause } from "lucide-react";

import { VolumeControl } from "./VolumeControl";

import styles from "./PlaybackControls.module.css";

export interface PlaybackControlsProps {
    currentTime: string;
    totalDuration: string;

    volume: number;

    isPlaying: boolean;

    onPlayPause?: () => void;
    onVolumeChange?: (volume: number) => void;
    onFullscreen?: () => void;
}

export function PlaybackControls({
                                     currentTime= "00:00",
                                     totalDuration="00:00",
                                     volume=95,
                                     isPlaying=true,
                                     onPlayPause = () => {},
                                     onVolumeChange = () => {},
                                     onFullscreen = () => {},
                                 }: PlaybackControlsProps) {
    return (
        <div className={styles.controls}>
            <div className={styles.left}>
                <button
                    className={styles.button}
                    onClick={onPlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    <Pause
                        size={18}
                        fill="currentColor"
                    />
                </button>

                <span className={styles.time}>
                    {currentTime} / {totalDuration}
                </span>
            </div>

            <div className={styles.right}>
                <VolumeControl
                    volume={volume}
                    onChange={onVolumeChange}
                />

                <button
                    className={styles.button}
                    onClick={onFullscreen}
                    aria-label="Fullscreen"
                >
                    <Maximize2 size={18} />
                </button>
            </div>
        </div>
    );
}