import { homeMock } from "../../home/mock/home.mock";
import { CommunityChatModel, ConversationPreview, LiveSession, RecentMessage, UpcomingEvent } from "../models";

import { communityChatMock } from "../mock/communityChat.mock";

type Cohort = typeof homeMock.activeCohorts[number] | typeof homeMock.continueLater[number];

const onlineCounts = [98, 64, 41, 22, 37, 18, 29, 33];
const avatars = ["/mock/avatars/a.webp", "/mock/avatars/b.webp", "/mock/avatars/c.webp", "/mock/avatars/d.webp", "/mock/avatars/e.webp"];
const people = ["Maya Chen", "Jordan Lee", "Priya Shah", "Noah Kim", "Ava Patel"];
const eventTones: UpcomingEvent["tone"][] = ["purple", "orange", "blue"];

export function getMessageCohorts(): Cohort[] {
    return [...homeMock.activeCohorts, ...homeMock.continueLater];
}

export function mapCohortToConversation(cohort: Cohort, index: number): ConversationPreview {
    const paused = "pausedUntil" in cohort;
    const onlineCount = onlineCounts[index % onlineCounts.length];

    return {
        id: cohort.id,
        kind: "community",
        name: cohort.title,
        avatar: cohort.thumbnail,
        sender: cohort.provider,
        preview: paused ? `Paused • ${cohort.resumeLabel}` : `${cohort.progressPercent}% complete • ${cohort.schedule.label}`,
        timestamp: paused ? "Paused" : "2m",
        onlineCount,
        unreadCount: !paused && index < 3 ? [4, 3, 2][index] : undefined,
        hasMention: !paused && index === 0,
        pinned: index === 1 || paused,
        statusLabel: paused ? "PAUSED" : "GROUP",
    };
}

export function mapCohortToLiveSession(cohort: Cohort, index: number): LiveSession {
    const onlineCount = onlineCounts[index % onlineCounts.length];

    return {
        id: cohort.id,
        title: cohort.title,
        thumbnail: cohort.thumbnail,
        avatars: avatars.slice(0, 4).map((avatar, avatarIndex) => ({
            id: `${cohort.id}-${avatarIndex}`,
            name: people[avatarIndex],
            avatar,
            online: true,
        })),
        status: `${onlineCount} learners online • ${cohort.progressPercent}% complete`,
        onlineCount,
        speakingCount: index === 0 ? 6 : undefined,
        live: index === 0,
        primary: index === 1,
    };
}

export function mapCohortToRecentMessage(cohort: Cohort, index: number): RecentMessage {
    const senderIndex = index % people.length;

    return {
        id: `recent-${cohort.id}`,
        sender: {
            id: `${cohort.id}-mentor`,
            name: index === 0 ? cohort.provider : people[senderIndex],
            avatar: avatars[senderIndex],
            online: index < 3,
        },
        community: cohort.title,
        message: `New checkpoint posted for ${cohort.title}. Next session follows ${cohort.schedule.label}.`,
        timestamp: index === 0 ? "2m" : `${(index + 1) * 8}m`,
        unreadCount: index < 3 ? 4 - index : undefined,
        live: index === 0,
    };
}

export function mapCohortToUpcomingEvent(cohort: Cohort, index: number): UpcomingEvent {
    return {
        id: `event-${cohort.id}`,
        title: `${cohort.title} Group Session`,
        subtitle: `${cohort.provider} • ${cohort.schedule.label}`,
        startsIn: ["Starts in 8m", "Starts in 18m", "Today, 8:00 PM", "Tomorrow, 7:30 PM"][index % 4],
        tone: eventTones[index % eventTones.length],
    };
}

export function mapCohortToCommunity(cohortId: string | null): CommunityChatModel {
    const cohorts = getMessageCohorts();
    const cohort = cohorts.find((item) => item.id === cohortId) ?? cohorts[0];
    const index = cohorts.findIndex((item) => item.id === cohort.id);
    const paused = "pausedUntil" in cohort;

    return {
        ...communityChatMock,
        id: cohort.id,
        name: cohort.title,
        avatar: cohort.thumbnail,
        description: `${cohort.provider} course group • ${cohort.progressPercent}% complete`,
        onlineCount: onlineCounts[Math.max(index, 0) % onlineCounts.length],
        pinnedAnnouncement: {
            author: cohort.provider,
            title: paused ? `${cohort.title} is paused. Group stays open for resources and questions.` : `${cohort.title} checkpoint follows ${cohort.schedule.label}.`,
            actionLabel: paused ? "View Resources" : "Join Session",
        },
        events: [mapCohortToUpcomingEvent(cohort, Math.max(index, 0)), ...communityChatMock.events.slice(1)],
    };
}
