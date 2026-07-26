"use client";

import { LessonCard, LearningTimeline, PlaybackControls, PlayerSurface, PlayerToolbar } from "./components";

import { usePlayback } from "./hooks/usePlayback";

import styles from "./Play.module.css";

export function Play() {
    const playback = usePlayback();

    return (
        <div className={styles.play}>
            <PlayerSurface>
                <div className={styles.lessonCard}>
                    <LessonCard
                        lesson={playback.lesson}
                    />
                </div>

                <div className={styles.toolbar}>
                    <PlayerToolbar
                        playbackSpeed={playback.playbackSpeed}
                        bookmarked={playback.bookmarked}
                        onBookmark={() =>
                            playback.setBookmarked(
                                !playback.bookmarked,
                            )
                        }
                    />
                </div>

                <div className={styles.timeline}>
                    <LearningTimeline
                        progress={38}
                        markers={playback.timelineMarkers}
                    />
                </div>

                <div className={styles.controls}>
                    <PlaybackControls
                        currentTime={
                            playback.lesson.currentTime
                        }
                        totalDuration={
                            playback.lesson.totalDuration
                        }
                        volume={playback.volume}
                        isPlaying={playback.isPlaying}
                        onPlayPause={
                            playback.togglePlayback
                        }
                        onVolumeChange={
                            playback.setVolume
                        }
                    />
                </div>
            </PlayerSurface>
        </div>
    );
}