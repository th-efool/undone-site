import { homeMock } from "../../home/mock/home.mock";
import { CommunityChatModel, ConversationPreview } from "../models";

import { communityChatMock } from "../mock/communityChat.mock";

type Cohort = typeof homeMock.activeCohorts[number] | typeof homeMock.continueLater[number];

const onlineCounts = [98, 64, 41, 22, 37, 18, 29, 33];

export function getMessageCohorts(): Cohort[] {
    return [...homeMock.activeCohorts, ...homeMock.continueLater];
}

export function mapCohortToConversation(cohort: Cohort, index: number): ConversationPreview {
    const onlineCount = onlineCounts[index % onlineCounts.length];

    return {
        id: cohort.id,
        kind: "community",
        name: cohort.title,
        avatar: cohort.thumbnail,
        sender: cohort.provider,
        preview: `${cohort.progressPercent}% complete • ${cohort.schedule.label}`,
        timestamp: "2m",
        onlineCount,
        unreadCount: index < 3 ? [32, 7, 12][index] : undefined,
        hasMention: index === 0,
        pinned: index === 1,
        statusLabel: "pausedUntil" in cohort ? "PAUSED" : undefined,
    };
}

export function mapCohortToCommunity(cohortId: string | null): CommunityChatModel {
    const cohorts = getMessageCohorts();
    const cohort = cohorts.find((item) => item.id === cohortId) ?? cohorts[0];
    const index = cohorts.findIndex((item) => item.id === cohort.id);

    return {
        ...communityChatMock,
        id: cohort.id,
        name: cohort.title,
        avatar: cohort.thumbnail,
        description: `${cohort.provider} cohort room • ${cohort.progressPercent}% complete`,
        onlineCount: onlineCounts[Math.max(index, 0) % onlineCounts.length],
    };
}
