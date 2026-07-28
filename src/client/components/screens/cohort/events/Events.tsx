import type { ReactNode } from "react";
import Image from "next/image";
import { Clock, MoreVertical, Users, Zap } from "lucide-react";

import { useCohort } from "../hooks";
import { EventStatus, type CohortEvents, type EventItem } from "../models";

import styles from "./Events.module.css";

interface EventsProps { cohortId: string; }

export function Events({ cohortId }: EventsProps) {
    const { events } = useCohort(cohortId);
    return <EventsPage events={events} />;
}

function EventsPage({ events }: { events: CohortEvents }) {
    return (
        <div className={styles.page}>
            <section className={styles.main}>
                <EventsHeader events={events} />
                <EventsFilters events={events} />
                <EventList items={events.upcomingEvents} />
                <button className={styles.load}>View Full Calendar <span>→</span></button>
            </section>
            <EventsSidebar events={events} />
        </div>
    );
}

function EventsHeader({ events }: { events: CohortEvents }) {
    return <header><h2>{events.title}</h2><p>{events.description}</p></header>;
}

function EventsFilters({ events }: { events: CohortEvents }) {
    return <div className={styles.filters}>{events.filters.map((f) => <button key={f.id} className={f.active ? styles.active : ""}>{f.label}{f.id === "filter" ? "⌄" : ""}</button>)}</div>;
}

function EventList({ items }: { items: EventItem[] }) {
    return <div className={styles.list}>{items.map((item) => <EventCard key={item.id} item={item} />)}</div>;
}

function EventCard({ item }: { item: EventItem }) {
    return (
        <article className={styles.eventCard}>
            <EventDateCard item={item} />
            <div className={styles.eventIcon}><Users size={20} /></div>
            <div className={styles.eventBody}>
                <h3>{item.title}</h3><p>{item.description}</p>
                <EventAttendance item={item} />
            </div>
            <EventActions item={item} />
        </article>
    );
}

function EventDateCard({ item }: { item: EventItem }) {
    return <div className={styles.date}><span>{item.date.month}</span><strong>{item.date.day}</strong><span>{item.date.weekday}</span></div>;
}

function EventAttendance({ item }: { item: EventItem }) {
    return <div className={styles.attendance}>{item.avatars.map((a) => <Image key={a.id} src={a.avatarUrl} alt="" width={24} height={24} />)}<span>{item.attendeeCount}</span></div>;
}

function EventStatusBadge({ item }: { item: EventItem }) {
    return <span className={`${styles.platform} ${styles[item.status]}`}>{statusText[item.status]} ({item.platform})</span>;
}

function RSVPButton() { return <button className={styles.rsvp}>RSVP</button>; }

function EventActions({ item }: { item: EventItem }) {
    return <div className={styles.actions}><div><Clock size={16} /> <strong>{item.time}</strong><span>{item.timezone}</span><EventStatusBadge item={item} /></div><RSVPButton /><button className={styles.more}><MoreVertical size={18} /></button></div>;
}

function EventsSidebar({ events }: { events: CohortEvents }) {
    return <aside className={styles.sidebar}><ThisWeek events={events} /><CalendarSync events={events} /><SuggestEvent events={events} /></aside>;
}

function ThisWeek({ events }: { events: CohortEvents }) {
    return <Card title="This Week" desc="See what's happening soon." action="View Calendar"><div className={styles.week}>{events.weeklySchedule.map((e) => <div key={e.id}><span>{e.icon}</span><p>{e.date} · {e.time}</p><strong>{e.title}</strong></div>)}</div><a>View All Upcoming Events →</a></Card>;
}

function CalendarSync({ events }: { events: CohortEvents }) {
    return <Card title="Sync Your Calendar" desc="Add events to your personal calendar and get reminders."><div className={styles.sync}>{events.calendarSync.map((a) => <button key={a.id}><span>{a.icon}</span>{a.label}</button>)}</div></Card>;
}

function SuggestEvent({ events }: { events: CohortEvents }) {
    return <Card title={events.suggestEvent.title} desc={events.suggestEvent.description}><div className={styles.cta}><button><Zap size={16} />{events.suggestEvent.buttonLabel}</button><span>{events.suggestEvent.illustration}</span></div></Card>;
}

function Card({ title, desc, action, children }: { title: string; desc: string; action?: string; children: ReactNode }) {
    return <section className={styles.sideCard}><div className={styles.sideHead}><div><h3>{title}</h3><p>{desc}</p></div>{action ? <button>{action}</button> : null}</div>{children}</section>;
}

const statusText = { [EventStatus.Upcoming]: "Online", [EventStatus.Live]: "Live", [EventStatus.Completed]: "Completed", [EventStatus.Cancelled]: "Cancelled" };
