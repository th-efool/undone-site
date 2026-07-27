"use client";

import { useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { communityChatMock } from "../mock/communityChat.mock";
import { messageMock } from "../mock/message.mock";
import { ConversationFilter, ConversationPreview, MessageView, SidebarTab } from "../models";

export function useMessage() {
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>("community");
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
    const [selectedChannel] = useState(communityChatMock.selectedChannel);

    const view: MessageView = selectedCommunityId ? "community" : "landing";

    const conversations = useMemo(() => {
        return messageMock.conversations
            .filter((item) => {
                if (item.kind !== selectedSidebarTab) return false;
                if (conversationFilter === "unread") return Boolean(item.unreadCount);
                if (conversationFilter === "mentions") return Boolean(item.hasMention);
                if (conversationFilter === "pinned") return Boolean(item.pinned);
                return true;
            })
            .map((item) => ({
                ...item,
                selected: selectedCommunityId ? item.id === selectedCommunityId : item.selected,
            }));
    }, [conversationFilter, selectedCommunityId, selectedSidebarTab]);

    function selectConversation(conversation: ConversationPreview) {
        if (conversation.kind !== "community") return;
        setSelectedCommunityId(conversation.id);
    }

    function selectSidebarTab(tab: SidebarTab) {
        setSelectedSidebarTab(tab);
        if (tab === "dm") setSelectedCommunityId(null);
    }

    return {
        view,
        selectedCommunityId,
        selectedChannel,
        selectedSidebarTab,
        conversationFilter,
        searchQuery,
        sidebarTabs,
        conversationFilters,
        conversations,
        communityChat: communityChatMock,
        liveSessions: messageMock.liveSessions,
        recentMessages: messageMock.recentMessages,
        upcomingEvents: messageMock.upcomingEvents,
        challenge: messageMock.challenge,
        friendsOnline: messageMock.friendsOnline,
        actions: {
            setSelectedSidebarTab: selectSidebarTab,
            setConversationFilter,
            setSearchQuery,
            selectConversation,
        },
    };
}
