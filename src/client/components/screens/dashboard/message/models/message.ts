export type SidebarTab = "community" | "dm";
export type ConversationFilter = "all" | "unread" | "mentions" | "pinned";

export interface PersonPreview {
    id: string;
    name: string;
    avatar: string;
    online?: boolean;
}

export interface ConversationPreview {
    id: string;
    kind: SidebarTab;
    name: string;
    avatar: string;
    sender: string;
    preview: string;
    timestamp: string;
    onlineCount?: number;
    statusLabel?: string;
    unreadCount?: number;
    hasMention?: boolean;
    pinned?: boolean;
    selected?: boolean;
}

export interface LiveSession {
    id: string;
    title: string;
    thumbnail: string;
    avatars: PersonPreview[];
    status: string;
    onlineCount: number;
    speakingCount?: number;
    live?: boolean;
    primary?: boolean;
}

export interface RecentMessage {
    id: string;
    sender: PersonPreview;
    community: string;
    message: string;
    timestamp: string;
    unreadCount?: number;
    attachment?: string;
    live?: boolean;
}

export interface UpcomingEvent {
    id: string;
    title: string;
    subtitle: string;
    startsIn: string;
    tone: "purple" | "orange" | "blue";
}

export interface ChallengeCard {
    tag: string;
    title: string;
    description: string;
    participants: PersonPreview[];
    participantCount: number;
}

export interface MessageMock {
    conversations: ConversationPreview[];
    liveSessions: LiveSession[];
    recentMessages: RecentMessage[];
    upcomingEvents: UpcomingEvent[];
    challenge: ChallengeCard;
    friendsOnline: PersonPreview[];
}
