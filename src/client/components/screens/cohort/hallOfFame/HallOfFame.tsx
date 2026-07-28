import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Crown, Medal, Star, Trophy } from "lucide-react";

import { useCohort } from "../hooks";
import type { CohortHallOfFame, HallAccent, HallCategory, LegendEntry } from "../models";

import styles from "./HallOfFame.module.css";

interface HallOfFameProps {
    cohortId: string;
}

export function HallOfFame({ cohortId }: HallOfFameProps) {
    const { hallOfFame } = useCohort(cohortId);

    return <HallOfFamePage hall={hallOfFame} />;
}

function HallOfFamePage({ hall }: { hall: CohortHallOfFame }) {
    return (
        <div className={styles.page}>
            <section className={styles.mainCard}>
                <div className={styles.topBar}>
                    <HallOfFameHeader hall={hall} />
                    <TimeRangeDropdown hall={hall} />
                </div>
                <CategoryFilters hall={hall} />
                <LeaderboardGrid items={hall.categories} />
                <button className={styles.fullButton}>See Full Leaderboards <ArrowRight size={17} /></button>
            </section>

            <HallSidebar hall={hall} />
            <HallOfLegends hall={hall} />
        </div>
    );
}

function HallOfFameHeader({ hall }: { hall: CohortHallOfFame }) {
    return (
        <header className={styles.header}>
            <h2><Trophy size={22} />{hall.title}</h2>
            <p>{hall.subtitle}</p>
        </header>
    );
}

function CategoryFilters({ hall }: { hall: CohortHallOfFame }) {
    return (
        <div className={styles.filters}>
            {hall.filters.map((item) => <CategoryFilter key={item.id} item={item} />)}
        </div>
    );
}

function CategoryFilter({ item }: { item: CohortHallOfFame["filters"][number] }) {
    return <button className={item.active ? styles.activeFilter : ""}>{item.label}</button>;
}

function TimeRangeDropdown({ hall }: { hall: CohortHallOfFame }) {
    const selected = hall.timeRanges.find((item) => item.active) ?? hall.timeRanges[0];

    return <button className={styles.timeRange}>{selected.label}⌄</button>;
}

function LeaderboardGrid({ items }: { items: HallCategory[] }) {
    return <div className={styles.grid}>{items.map((item) => <LeaderboardCard key={item.id} item={item} />)}</div>;
}

function LeaderboardCard({ item }: { item: HallCategory }) {
    return (
        <article className={`${styles.leaderCard} ${styles[item.accent]}`}>
            <h3>{item.title}</h3>
            <p>{item.subtitle}</p>
            <MedalIcon rank={item.rank} accent={item.accent} />
            <Image className={styles.avatar} src={item.winner.avatarUrl} alt="" width={58} height={58} />
            <strong>{item.winner.name}</strong>
            <b>{item.primaryMetric}</b>
            <MetricBadge value={item.growthMetric} />
            <AchievementBadge label={item.badge} accent={item.accent} />
        </article>
    );
}

function MedalIcon({ rank, accent }: { rank: number; accent: HallAccent }) {
    if (rank === 0) return <div className={`${styles.medal} ${styles[accent]}`}><Star size={22} /></div>;

    return <div className={`${styles.medal} ${styles[accent]}`}><Medal size={26} /><span>{rank}</span></div>;
}

function MetricBadge({ value }: { value: string }) {
    return <span className={styles.metric}>↗ {value}</span>;
}

function AchievementBadge({ label, accent }: { label: string; accent: HallAccent }) {
    return <span className={`${styles.achievement} ${styles[accent]}`}>✧ {label}</span>;
}

function HallOfLegends({ hall }: { hall: CohortHallOfFame }) {
    return (
        <section className={styles.legends}>
            <div className={styles.legendsHead}>
                <div><h3><Crown size={19} />Hall of Legends</h3><p>All-time legends of this cohort.</p></div>
                <button>View Hall of Legends <ArrowRight size={16} /></button>
            </div>
            <div className={styles.legendRows}>{hall.legends.map((item) => <LegendsRow key={item.id} item={item} />)}</div>
        </section>
    );
}

function LegendsRow({ item }: { item: LegendEntry }) {
    return (
        <article className={styles.legendRow}>
            <span>{item.rank}</span>
            <Image src={item.avatarUrl} alt="" width={36} height={36} />
            <div><strong>{item.name}</strong><p>{item.achievementTitle}</p></div>
            <b>{item.primaryMetric}</b>
        </article>
    );
}

function HallSidebar({ hall }: { hall: CohortHallOfFame }) {
    return (
        <aside className={styles.sidebar}>
            <HighlightsCard hall={hall} />
            <AchievementsCard hall={hall} />
        </aside>
    );
}

function HighlightsCard({ hall }: { hall: CohortHallOfFame }) {
    return (
        <SideCard title="Your Highlights" desc="See how you rank across categories.">
            <div className={styles.highlights}>{hall.userHighlights.map((item) => <HighlightRow key={item.id} item={item} />)}</div>
            <button className={styles.profileButton}>View My Profile</button>
        </SideCard>
    );
}

function HighlightRow({ item }: { item: CohortHallOfFame["userHighlights"][number] }) {
    return <div className={styles.highlightRow}><span>{item.icon}</span><strong>{item.rank}</strong><p>{item.label}</p><b>{item.metric}</b></div>;
}

function AchievementsCard({ hall }: { hall: CohortHallOfFame }) {
    return (
        <SideCard title="Recent Achievements" desc="Your latest badges and milestones.">
            <div className={styles.achievements}>{hall.recentAchievements.map((item) => <AchievementRow key={item.id} item={item} />)}</div>
            <button className={styles.allButton}>View All Achievements <ArrowRight size={16} /></button>
        </SideCard>
    );
}

function AchievementRow({ item }: { item: CohortHallOfFame["recentAchievements"][number] }) {
    return <div className={styles.achievementRow}><span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><em>{item.earnedTime}</em></div>;
}

function SideCard({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
    return <section className={styles.sideCard}><h3>{title}</h3><p>{desc}</p>{children}</section>;
}
