"use client";

import styles from "./heroRibbon.module.css";

export function HeroRibbon() {
    return (
        <svg
            className={styles.ribbon}
            viewBox="0 0 1600 900"
            preserveAspectRatio="none"
            aria-hidden
        >
            <defs>
                <linearGradient id="trail" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F7D8FF" />
                    <stop offset="25%" stopColor="#E8C4FF" />
                    <stop offset="55%" stopColor="#C58CFF" />
                    <stop offset="100%" stopColor="#7B4DFF" />
                </linearGradient>

                <filter id="glow">
                    <feGaussianBlur stdDeviation="12" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Glow */}
            <path
                className={styles.glow}
                d="
                    M110 160
                    C220 120 270 300 420 250
                    S650 120 760 250
                    S940 430 1120 410
                    S1320 280 1450 420
                "
            />

            {/* Main ribbon */}
            <path
                className={styles.main}
                d="
                    M110 160
                    C220 120 270 300 420 250
                    S650 120 760 250
                    S940 430 1120 410
                    S1320 280 1450 420
                "
            />

            {/* Inner highlight */}
            <path
                className={styles.highlight}
                d="
                    M110 160
                    C220 120 270 300 420 250
                    S650 120 760 250
                    S940 430 1120 410
                    S1320 280 1450 420
                "
            />
        </svg>
    );
}