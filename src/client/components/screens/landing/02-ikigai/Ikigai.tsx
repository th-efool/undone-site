import { Section } from "@/src/client/components/global/layout/Section";
import { IkigaiTimeline } from "./ikigaiTimeline";
import styles from "./ikigai.module.css";
import {Container} from "@/src/client/components/global/layout/Container";
import Image from "next/image";
import { CalendarMonth } from "./CalendarMonth/CalendarMonth";
import { mayDays, juneDays, julyDays } from "./CalendarMonth/calendarData";

import { LearningList } from "./learningList";

import {
    Sparkles,
    Link2,
    Target,
    TrendingUp,
} from "lucide-react";

export function Ikigai() {
    return (
        <Section
            spacing="xs"
            className={styles.ikigai}
        >
            <Container size="full">
                <IkigaiTimeline />
            </Container>

            <div className={styles.featureSection}>

                <div className={styles.videoPanel}>
                    <Image
                        src="/images/landing/screen.webp"
                        alt="SideQuestHQ AI learning interface"
                        width={1280}
                        height={720}
                        priority
                        draggable={false}
                        className={styles.videoImage}
                    />
                </div>

                <div className={styles.featureCopy}>

                    <h2 className={styles.featureTitle}>
                        We turn Interstitial
                        <br />
                        moments into meaningful
                        <br />
                        learning experience.
                    </h2>

                    <ul className={styles.featureList}>

                        <li className={styles.featureItem}>
                            <Sparkles
                                className={styles.featureIcon}
                                strokeWidth={2.25}
                            />
                            <span>Automatically picks the right next piece</span>
                        </li>

                        <li className={styles.featureItem}>
                            <Link2
                                className={styles.featureIcon}
                                strokeWidth={2.25}
                            />
                            <span>Remembers everything for you</span>
                        </li>

                        <li className={styles.featureItem}>
                            <Target
                                className={styles.featureIcon}
                                strokeWidth={2.25}
                            />
                            <span>Adapts to your time, energy, and goals</span>
                        </li>

                        <li className={styles.featureItem}>
                            <TrendingUp
                                className={styles.featureIcon}
                                strokeWidth={2.25}
                            />
                            <span>Tracks progress across all your interests</span>
                        </li>

                    </ul>

                </div>

                <aside className={styles.feedPanel}>

                    <h3 className={styles.feedTitle}>
                        Stochastic Adaptive Feed
                    </h3>

                    <p className={styles.feedDescription}>
                        A personalized feed that reshuffles throughout the day
                        using spaced repetition, priority, and your real-time
                        availability.
                    </p>

                    <div className={styles.phoneIllustration}>

                        <Image
                            src="/images/landing/phone.webp"
                            alt="SideQuestHQ adaptive feed"
                            width={170}
                            height={320}
                            draggable={false}
                            className={styles.phone}
                        />

                        <Image
                            src="/images/landing/hand.webp"
                            alt=""
                            aria-hidden="true"
                            width={110}
                            height={130}
                            draggable={false}
                            className={styles.hand}
                        />

                    </div>

                    <p className={styles.feedCaption}>
                        Just scroll—like Instagram.
                        <br />
                        We handle the rest.
                    </p>

                    <div className={styles.feedBadge}>
                        Digestible. Focused. Always relevant.
                    </div>

                </aside>

            </div>

            <div className={styles.progressSection}>

                <LearningList />

                <div className={styles.calendarPanel}>

                    <CalendarMonth
                        month="May"
                        year={2025}
                        youtubeTotal="8h 42m"
                        courseraTotal="9h 16m"
                        historyTotal="7h 48m"
                        days={mayDays}
                    />

                    <CalendarMonth
                        month="June"
                        year={2025}
                        youtubeTotal="9h 10m"
                        courseraTotal="9h 24m"
                        historyTotal="7h 20m"
                        days={juneDays}
                    />

                    <CalendarMonth
                        month="July"
                        year={2025}
                        youtubeTotal="8h 08m"
                        courseraTotal="9h 20m"
                        historyTotal="7h 40m"
                        days={julyDays}
                    />

                </div>

                <aside className={styles.progressCard}>

                    <header className={styles.progressHeader}>
                        <h3 className={styles.progressTitle}>PROGRESS</h3>
                        <p className={styles.progressSubtitle}>
                            Small fun session adds up.!
                        </p>
                    </header>

                    {/* YouTube */}

                    <div className={`${styles.progressRow} ${styles.youtube}`}>

                        <img
                            src="/images/icons/youtube-white.webp"
                            alt=""
                            className={styles.progressIcon}
                        />

                        <span className={styles.progressCheck}>
        ✓
    </span>

                        <div className={styles.progressInfo}>

                            <strong className={styles.progressHours}>
                                26h
                            </strong>

                            <span className={styles.progressMeta}>
            14 videos
        </span>

                        </div>

                    </div>

                    {/* Coursera */}

                    <div className={`${styles.progressRow} ${styles.coursera}`}>

                        <img
                            src="/images/icons/coursera-white.webp"
                            alt=""
                            className={styles.progressIcon}
                        />

                        <span className={styles.progressCheck}>
                            ✓
                        </span>

                        <div className={styles.progressInfo}>

                            <strong className={styles.progressHours}>
                                28h
                            </strong>

                            <span className={styles.progressMeta}>
                                17 modules
                            </span>

                        </div>

                    </div>

                    {/* History */}

                    <div className={`${styles.progressRow} ${styles.history}`}>

                        <img
                            src="/images/icons/youtube-white.webp"
                            alt=""
                            className={styles.progressIcon}
                        />

                        <span className={styles.progressCheck}>
        ✓
    </span>

                        <div className={styles.progressInfo}>

                            <strong className={styles.progressHours}>
                                22h
                            </strong>

                            <span className={styles.progressMeta}>
            48 videos
        </span>

                        </div>

                    </div>

                    <div className={styles.completed}>
                        ✓ All cohorts completed
                    </div>

                </aside>

            </div>
        </Section>
    );
}