"use client";

import { useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { communityChatMock } from "../mock/communityChat.mock";
import { dmConversationMock } from "../mock/dmConversation.mock";
import { messageMock } from "../mock/message.mock";
import { ConversationFilter, ConversationPreview, MessageView, SidebarTab } from "../models";

export function useMessage() {
    const [selectedSidebarTab, setSelectedSidebarTab] = useState<SidebarTab>("community");
    const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
    const [selectedDMId, setSelectedDMId] = useState<string | null>(null);
    const [selectedChannel] = useState(communityChatMock.selectedChannel);

    const view: MessageView = selectedCommunityId ? "community" : selectedDMId ? "dm" : "landing";

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
                selected: item.kind === "community"
                    ? selectedCommunityId ? item.id === selectedCommunityId : item.selected
                    : selectedDMId ? item.id === selectedDMId : item.selected,
            }));
    }, [conversationFilter, selectedCommunityId, selectedDMId, selectedSidebarTab]);

    function selectConversation(conversation: ConversationPreview) {
        if (conversation.kind === "community") {
            setSelectedCommunityId(conversation.id);
            setSelectedDMId(null);
            return;
        }

        setSelectedDMId(conversation.id);
        setSelectedCommunityId(null);
    }

    function selectSidebarTab(tab: SidebarTab) {
        setSelectedSidebarTab(tab);
        setSelectedCommunityId(null);
        setSelectedDMId(null);
    }

    return {
        view,
        selectedCommunityId,
        selectedDMId,
        selectedChannel,
        selectedSidebarTab,
        conversationFilter,
        searchQuery,
        sidebarTabs,
        conversationFilters,
        conversations,
        communityChat: communityChatMock,
        dmConversation: dmConversationMock,
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
            closeDMConversation: () => setSelectedDMId(null),
        },
    };
}
