"use client";

import { useCallback, useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { dmConversationMock } from "../mock/dmConversation.mock";
import { messageMock } from "../mock/message.mock";
import { ConversationFilter, ConversationPreview, MessageView, SidebarTab } from "../models";
import { getMessageCohorts, mapCohortToCommunity, mapCohortToConversation } from "../utils";

function matchesSearch(conversation: ConversationPreview, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;

    return [conversation.name, conversation.sender, conversation.preview]
        .some((value) => value.toLowerCase().includes(normalized));
}

export function useMessage() {
    const [selectedView, setSelectedView] = useState<MessageView>("landing");
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>("community");
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
    const [selectedDMId, setSelectedDMId] = useState<string | null>(null);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const communityConversations = useMemo(() => {
        return getMessageCohorts().map(mapCohortToConversation);
    }, []);

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
        return mapCohortToCommunity(selectedCommunityId);
    }, [selectedCommunityId]);

    const dmConversation = useMemo(() => {
        return {
            ...dmConversationMock,
            id: selectedDMId ?? dmConversationMock.id,
        };
    }, [selectedDMId]);

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
        liveSessions: messageMock.liveSessions,
        recentMessages: messageMock.recentMessages.filter((item) => matchesSearch({
            id: item.id,
            kind: "community",
            name: item.community,
            avatar: item.sender.avatar,
            sender: item.sender.name,
            preview: item.message || item.attachment || "",
            timestamp: item.timestamp,
        }, searchQuery)),
        upcomingEvents: messageMock.upcomingEvents,
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
        },
    };
}
