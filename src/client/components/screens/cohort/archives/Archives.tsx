import type { ReactNode } from "react";
import Image from "next/image";
import { Bookmark, MessageCircle, Search, SlidersHorizontal, TrendingUp } from "lucide-react";

import { useCohort } from "../hooks";
import { ArchiveType, type ArchiveItem, type CohortArchives } from "../models";

import styles from "./Archives.module.css";

interface ArchivesProps { cohortId: string; }

export function Archives({ cohortId }: ArchivesProps) {
    const { archives } = useCohort(cohortId);
    return <ArchivesPage archives={archives} />;
}

function ArchivesPage({ archives }: { archives: CohortArchives }) {
    return <div className={styles.page}><section className={styles.main}><ArchivesHeader archives={archives} /><ArchiveFilters archives={archives} /><div className={styles.tools}><ArchiveSearch /><SortingControls archives={archives} /></div><ArchiveFeed items={archives.items} /><button className={styles.load}>Load More⌄</button></section><ArchivesSidebar archives={archives} /></div>;
}

function ArchivesHeader({ archives }: { archives: CohortArchives }) { return <header><h2>{archives.title}</h2><p>{archives.description}</p></header>; }
function ArchiveFilters({ archives }: { archives: CohortArchives }) { return <div className={styles.filters}>{archives.categories.map((c) => <button key={c.id} className={c.active ? styles.active : ""}>{c.label}{c.id === "flashcards" || c.id === "more" ? "⌄" : ""}</button>)}</div>; }
function ArchiveSearch() { return <label className={styles.search}><Search size={18} /><input placeholder="Search archives..." /></label>; }
function SortingControls({ archives }: { archives: CohortArchives }) { return <div className={styles.sort}>{archives.sortControls.map((c) => <button key={c.id}>{c.id === "filters" ? <SlidersHorizontal size={15} /> : null}{c.label}⌄</button>)}</div>; }
function ArchiveFeed({ items }: { items: ArchiveItem[] }) { return <div className={styles.feed}>{items.map((item) => <ArchiveCard key={item.id} item={item} />)}</div>; }

function ArchiveCard({ item }: { item: ArchiveItem }) {
    return <article className={styles.card}><ArchiveThumbnail item={item} /><div className={styles.body}><h3>{item.title} <ArchiveTypeBadge type={item.type} /></h3><p>{item.description}</p><div className={styles.author}><Image src={item.author.avatarUrl} alt="" width={24} height={24} />{item.author.name}<span>·</span>{item.publishedAt}</div></div><ArchiveVoting count={item.voteCount} /><button className={styles.icon}><Bookmark size={18} /></button><button className={styles.comments}><MessageCircle size={18} />{item.commentCount}</button></article>;
}

function ArchiveThumbnail({ item }: { item: ArchiveItem }) { return <Image className={styles.thumb} src={item.thumbnail} alt="" width={168} height={78} />; }
function ArchiveVoting({ count }: { count: number }) { return <div className={styles.votes}><button>⌃</button><strong>{count}</strong><button>⌄</button></div>; }
function ArchiveTypeBadge({ type }: { type: ArchiveType }) { return <span className={`${styles.badge} ${styles[typeClass[type]]}`}>{type}</span>; }

function ArchivesSidebar({ archives }: { archives: CohortArchives }) { return <aside className={styles.sidebar}><ContributorsCard archives={archives} /><TrendingCard archives={archives} /><ShareKnowledgeCard archives={archives} /></aside>; }
function ContributorsCard({ archives }: { archives: CohortArchives }) { return <SideCard title="Top Contributors" desc="Explorers who consistently share valuable knowledge."><ol className={styles.contributors}>{archives.contributors.map((c) => <li key={c.id}><span>{archives.contributors.indexOf(c)+1}</span><Image src={c.avatarUrl} alt="" width={24} height={24} /><strong>{c.name}</strong><em>{c.notes} notes</em></li>)}</ol></SideCard>; }
function TrendingCard({ archives }: { archives: CohortArchives }) { return <SideCard title="Trending This Week" desc="Most active and gaining traction."><ol className={styles.trending}>{archives.trending.map((t) => <li key={t.id}><TrendingUp size={15} /><span>{t.title}</span><strong>{t.score}</strong></li>)}</ol></SideCard>; }
function ShareKnowledgeCard({ archives }: { archives: CohortArchives }) { const cta = archives.shareKnowledge; return <section className={styles.share}><span>{cta.illustration}</span><div><h3>{cta.title}</h3><p>{cta.description}</p><button>{cta.buttonLabel}</button></div></section>; }
function SideCard({ title, desc, children }: { title: string; desc: string; children: ReactNode }) { return <section className={styles.sideCard}><h3>{title}</h3><p>{desc}</p>{children}</section>; }

const typeClass = { [ArchiveType.FieldNote]: "field", [ArchiveType.MindMap]: "mind", [ArchiveType.CheatSheet]: "cheat", [ArchiveType.Diagram]: "diagram", [ArchiveType.CodeSnippet]: "code", [ArchiveType.Flashcard]: "flash" };
