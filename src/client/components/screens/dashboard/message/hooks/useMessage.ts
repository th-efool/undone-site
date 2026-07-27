"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { dmConversationMock } from "../mock/dmConversation.mock";
import { messageMock } from "../mock/message.mock";
import { CommunityMessage, ConversationFilter, ConversationPreview, DMConversationModel, DMMessage, MessageView, SidebarTab } from "../models";
import { getMessageCohorts, mapCohortToCommunity, mapCohortToConversation, mapCohortToLiveSession, mapCohortToRecentMessage, mapCohortToUpcomingEvent } from "../utils";

const me = { id: "me", name: "You", avatar: "/images/logos/floating-logo.webp", online: true };
const storageKeys = { drafts: "sidequest-message-drafts", community: "sidequest-community-messages", dm: "sidequest-dm-messages" };

function matchesSearch(conversation: ConversationPreview, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    return [conversation.name, conversation.sender, conversation.preview]
        .some((value) => value.toLowerCase().includes(normalized));
}

function nowLabel() {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function readRecord<T>(key: string): Record<string, T> {
    if (typeof window === "undefined") return {};

    try {
        return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, T>;
    } catch {
        return {};
    }
}

function makeDMConversation(conversation?: ConversationPreview): DMConversationModel {
    if (!conversation) return dmConversationMock;

    return {
        ...dmConversationMock,
        id: conversation.id,
        user: {
            ...dmConversationMock.user,
            id: conversation.id,
            name: conversation.name,
            avatar: conversation.avatar,
            role: conversation.sender || "SideQuestHQ learner",
            company: conversation.kind === "dm" ? "Learning Circle" : dmConversationMock.user.company,
            bio: `Learning partner for ${conversation.preview.toLowerCase()}`,
        },
        messages: [
            { id: `${conversation.id}-d1`, type: "incoming", text: conversation.preview, timestamp: conversation.timestamp, showAvatar: true, tail: true, dateLabel: "Today" },
            { id: `${conversation.id}-d2`, type: "outgoing", text: "Got it — I’ll follow up after my next session.", timestamp: "5:33 PM", status: "read", tail: true },
            { id: `${conversation.id}-d3`, type: "incoming", text: "Perfect. I’ll keep the resources ready here.", timestamp: "5:36 PM", showAvatar: true, tail: true },
        ],
    };
}

export function useMessage() {
    const [selectedView, setSelectedView] = useState<MessageView>("landing");
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>("community");
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
    const [selectedDMId, setSelectedDMId] = useState<string | null>(null);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [drafts, setDrafts] = useState<Record<string, string>>(() => readRecord<string>(storageKeys.drafts));
    const [communityMessages, setCommunityMessages] = useState<Record<string, CommunityMessage[]>>(() => readRecord<CommunityMessage[]>(storageKeys.community));
    const [dmMessages, setDMMessages] = useState<Record<string, DMMessage[]>>(() => readRecord<DMMessage[]>(storageKeys.dm));


    useEffect(() => {
        window.localStorage.setItem(storageKeys.drafts, JSON.stringify(drafts));
    }, [drafts]);

    useEffect(() => {
        window.localStorage.setItem(storageKeys.community, JSON.stringify(communityMessages));
    }, [communityMessages]);

    useEffect(() => {
        window.localStorage.setItem(storageKeys.dm, JSON.stringify(dmMessages));
    }, [dmMessages]);

    const messageCohorts = useMemo(() => getMessageCohorts(), []);

    const communityConversations = useMemo(() => {
        return messageCohorts.map(mapCohortToConversation);
    }, [messageCohorts]);

    const dmConversations = useMemo(() => {
        return messageMock.conversations.filter((item) => item.kind === "dm");
    }, []);

    const conversations = useMemo(() => {
        const source = selectedSidebarTab === "community" ? communityConversations : dmConversations;

        return source
            .filter((item) => {
                if (conversationFilter === "unread") return Boolean(item.unreadCount);
                if (conversationFilter === "mentions") return Boolean(item.hasMention);
                if (conversationFilter === "pinned") return Boolean(item.pinned);
                return true;
            })
            .filter((item) => matchesSearch(item, searchQuery))
            .map((item) => ({
                ...item,
                selected: item.kind === "community"
                    ? item.id === selectedCommunityId
                    : item.id === selectedDMId,
            }));
    }, [communityConversations, conversationFilter, dmConversations, searchQuery, selectedCommunityId, selectedDMId, selectedSidebarTab]);

    const communityChat = useMemo(() => {
        const community = mapCohortToCommunity(selectedCommunityId);
        return { ...community, messages: communityMessages[community.id] ?? community.messages };
    }, [communityMessages, selectedCommunityId]);

    const dmConversation = useMemo(() => {
        const conversation = dmConversations.find((item) => item.id === selectedDMId);
        const dm = makeDMConversation(conversation);
        return { ...dm, messages: dmMessages[dm.id] ?? dm.messages };
    }, [dmConversations, dmMessages, selectedDMId]);

    const selectConversation = useCallback((conversation: ConversationPreview) => {
        if (conversation.kind === "community") {
            setSelectedCommunityId(conversation.id);
            setSelectedView("community");
            return;
        }

        setSelectedDMId(conversation.id);
        setSelectedView("dm");
    }, []);

    const backToLanding = useCallback(() => {
        setSelectedView("landing");
    }, []);

    const setConversationScroll = useCallback((conversationId: string, scrollTop: number) => {
        setScrollPositions((current) => ({ ...current, [conversationId]: scrollTop }));
    }, []);

    const setDraft = useCallback((conversationId: string, draft: string) => {
        setDrafts((current) => ({ ...current, [conversationId]: draft }));
    }, []);

    const sendCommunityMessage = useCallback((conversationId: string) => {
        const draft = drafts[conversationId]?.trim();
        if (!draft) return;

        const base = mapCohortToCommunity(conversationId).messages;
        const message: CommunityMessage = {
            id: `${conversationId}-${Date.now()}`,
            author: me,
            badge: "You",
            timestamp: `Today at ${nowLabel()}`,
            body: draft,
        };

        setCommunityMessages((current) => ({ ...current, [conversationId]: [...(current[conversationId] ?? base), message] }));
        setDrafts((current) => ({ ...current, [conversationId]: "" }));
    }, [drafts]);

    const sendDMMessage = useCallback((conversationId: string) => {
        const draft = drafts[conversationId]?.trim();
        if (!draft) return;

        const base = makeDMConversation(dmConversations.find((item) => item.id === conversationId)).messages;
        const message: DMMessage = {
            id: `${conversationId}-${Date.now()}`,
            type: "outgoing",
            text: draft,
            timestamp: nowLabel(),
            status: "sent",
            tail: true,
        };

        setDMMessages((current) => ({ ...current, [conversationId]: [...(current[conversationId] ?? base), message] }));
        setDrafts((current) => ({ ...current, [conversationId]: "" }));
    }, [dmConversations, drafts]);

    return {
        view: selectedView,
        selectedCommunityId,
        selectedDMId,
        selectedSidebarTab,
        conversationFilter,
        searchQuery,
        sidebarTabs,
        conversationFilters,
        conversations,
        communityChat,
        dmConversation,
        communityScrollTop: scrollPositions[selectedCommunityId ?? ""] ?? 0,
        dmScrollTop: scrollPositions[selectedDMId ?? ""] ?? 0,
        communityDraft: drafts[selectedCommunityId ?? ""] ?? "",
        dmDraft: drafts[selectedDMId ?? ""] ?? "",
        liveSessions: messageCohorts.slice(0, 4).map(mapCohortToLiveSession),
        recentMessages: messageCohorts.map(mapCohortToRecentMessage).filter((item) => matchesSearch({
            id: item.id,
            kind: "community",
            name: item.community,
            avatar: item.sender.avatar,
            sender: item.sender.name,
            preview: item.message || item.attachment || "",
            timestamp: item.timestamp,
        }, searchQuery)),
        upcomingEvents: messageCohorts.slice(0, 3).map(mapCohortToUpcomingEvent),
        challenge: messageMock.challenge,
        friendsOnline: messageMock.friendsOnline,
        actions: {
            setSelectedSidebarTab,
            setConversationFilter,
            setSearchQuery,
            selectConversation,
            backToLanding,
            setConversationScroll,
            setDraft,
            sendCommunityMessage,
            sendDMMessage,
        },
    };
}
