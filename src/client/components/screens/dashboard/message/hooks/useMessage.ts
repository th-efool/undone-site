"use client";

import { useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { messageMock } from "../mock/message.mock";
import { ConversationFilter, SidebarTab } from "../models";

export function useMessage() {
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>("community");
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const conversations = useMemo(() => {
        return messageMock.conversations.filter((item) => {
            if (item.kind !== selectedSidebarTab) return false;
            if (conversationFilter === "unread") return Boolean(item.unreadCount);
            if (conversationFilter === "mentions") return Boolean(item.hasMention);
            if (conversationFilter === "pinned") return Boolean(item.pinned);
            return true;
        });
    }, [conversationFilter, selectedSidebarTab]);

    return {
        selectedSidebarTab,
        conversationFilter,
        searchQuery,
        sidebarTabs,
        conversationFilters,
        conversations,
        liveSessions: messageMock.liveSessions,
        recentMessages: messageMock.recentMessages,
        upcomingEvents: messageMock.upcomingEvents,
        challenge: messageMock.challenge,
        friendsOnline: messageMock.friendsOnline,
        actions: { setSelectedSidebarTab, setConversationFilter, setSearchQuery },
    };
}
