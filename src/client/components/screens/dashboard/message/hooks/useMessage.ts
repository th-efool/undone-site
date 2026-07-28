"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { conversationFilters, sidebarTabs } from "../constants";
import { messagesRepository } from "@/src/client/repositories/messagesRepository";
import { ChatAttachmentKind, CommunityMessage, ConversationFilter, ConversationPreview, DMConversationModel, DMMessage, MessageView, SidebarTab } from "../models";
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

function mockAttachment(id: string, fileName: string, kind: ChatAttachmentKind) {
    return {
        id,
        kind,
        title: fileName,
        url: kind === "image" ? "/images/landing/screen.webp" : undefined,
        meta: kind === "image" ? "Mock upload · image" : `Mock upload · ${fileName.split(".").pop()?.toUpperCase() ?? "FILE"}`,
    };
}

const dmScripts: Record<string, Partial<DMConversationModel> & { messages: DMMessage[] }> = {
    "aarav-mehta": { messages: [
        { id: "aarav-1", type: "incoming", text: "Still pairing on the eval harness tonight?", timestamp: "Mon 7:42 PM", showAvatar: true, tail: true, dateLabel: "Monday" },
        { id: "aarav-2", type: "outgoing", text: "Yes. I cleaned up the fixtures and added two edge cases.", timestamp: "Mon 7:49 PM", status: "read", tail: true },
        { id: "aarav-3", type: "incoming", text: "Perfect. I’ll bring the failing trace. It only breaks when the prompt has a table.", timestamp: "Mon 8:03 PM", showAvatar: true, tail: true, reactions: [{ emoji: "👀", count: 1 }] },
        { id: "aarav-4", type: "outgoing", text: "Drop it here when you can.", timestamp: "Today 10:18 AM", status: "read", dateLabel: "Today", tail: true },
        { id: "aarav-5", type: "incoming", text: "Here you go — tiny but annoying bug.", timestamp: "10:22 AM", showAvatar: true, tail: true, attachment: mockAttachment("aarav-pdf", "eval_trace_notes.pdf", "pdf") },
    ] },
    "vanshika-iyer": { messages: [
        { id: "v-1", type: "incoming", text: "Your dashboard critique was SO helpful 🙌", timestamp: "Yesterday 4:13 PM", showAvatar: true, tail: true, dateLabel: "Yesterday", reactions: [{ emoji: "🙌", count: 2 }] },
        { id: "v-2", type: "outgoing", text: "The story was already there. You just needed fewer colors.", timestamp: "4:16 PM", status: "read", tail: true },
        { id: "v-3", type: "incoming", text: "I tried your annotation idea. Screenshot attached.", timestamp: "4:22 PM", showAvatar: true, tail: true, attachment: mockAttachment("v-shot", "retention_dashboard_v2.png", "image") },
    ] },
    "rohan-gupta": { messages: [
        { id: "r-1", type: "incoming", text: "I made a one-pager for fanout tradeoffs.", timestamp: "Fri 3:04 PM", showAvatar: true, tail: true, dateLabel: "Friday" },
        { id: "r-2", type: "incoming", text: "Would you sanity-check the capacity math?", timestamp: "3:05 PM", tail: true, attachment: mockAttachment("r-pdf", "chat_system_capacity.pdf", "pdf") },
        { id: "r-3", type: "outgoing", text: "Reading now. First note: call out hot celebrity accounts separately.", timestamp: "3:18 PM", status: "delivered", tail: true, replyTo: "capacity math" },
        { id: "r-4", type: "incoming", text: "Good catch. Added a separate write-amplification section.", timestamp: "3:45 PM", showAvatar: true, tail: true },
    ] },
    "samiksha-sharma": { messages: [
        { id: "s-1", type: "incoming", text: "Tomorrow still works for the short film prompt jam?", timestamp: "Today 1:12 PM", showAvatar: true, tail: true, dateLabel: "Today" },
        { id: "s-2", type: "outgoing", text: "Yep. I can do 11:30. Bring the rain-city concept.", timestamp: "1:15 PM", status: "sent", tail: true },
    ] },
    "arjun-nair": { messages: [
        { id: "a-1", type: "incoming", text: "Fixed the broken link in the JS sandbox.", timestamp: "11:58 AM", showAvatar: true, tail: true, dateLabel: "Today" },
        { id: "a-2", type: "outgoing", text: "Got it, thanks!", timestamp: "12:05 PM", status: "read", tail: true, reactions: [{ emoji: "✅", count: 1 }] },
    ] },
    "ai-filmmaking-team": { messages: [
        { id: "film-1", type: "incoming", text: "Team drop: three reference frames for tonight.", timestamp: "Yesterday 6:10 PM", showAvatar: true, dateLabel: "Yesterday", tail: true, attachment: mockAttachment("film-img", "neon_alley_reference.jpg", "image") },
        { id: "film-2", type: "incoming", text: "Also uploading the temp VO.", timestamp: "6:12 PM", tail: true, attachment: mockAttachment("film-audio", "scratch_voiceover.mp3", "audio") },
        { id: "film-3", type: "outgoing", text: "The second frame has the best mood. Use that palette.", timestamp: "6:40 PM", status: "read", tail: true },
        { id: "film-4", type: "incoming", text: "Agreed. Rendering a 5 sec motion test now 🔥", timestamp: "7:02 PM", showAvatar: true, tail: true },
    ] },
    "yash-patil": { messages: [
        { id: "y-1", type: "incoming", text: "Booked the study room for Saturday.", timestamp: "Yesterday 9:02 AM", showAvatar: true, tail: true, dateLabel: "Yesterday" },
        { id: "y-2", type: "outgoing", text: "Nice. Send location?", timestamp: "9:07 AM", status: "read", tail: true },
        { id: "y-3", type: "incoming", text: "https://maps.example.com/sidequest-room-b", timestamp: "9:08 AM", showAvatar: true, tail: true },
        { id: "y-4", type: "incoming", text: "See you there", timestamp: "9:09 AM", tail: true },
    ] },
    "design-thinkers": { messages: [
        { id: "dt-1", type: "incoming", text: "Ananya: Uploaded the interview notes from all five users.", timestamp: "Wed 5:14 PM", showAvatar: true, tail: true, dateLabel: "Wednesday", attachment: mockAttachment("dt-file", "user_interview_notes.docx", "file") },
        { id: "dt-2", type: "outgoing", text: "Skimmed them. Pattern is clear: onboarding asks too much too soon.", timestamp: "5:48 PM", status: "delivered", tail: true },
        { id: "dt-3", type: "incoming", text: "Maya: I’ll prototype a shorter first-run flow.", timestamp: "6:02 PM", showAvatar: true, tail: true, reactions: [{ emoji: "💡", count: 3 }] },
    ] },
};

function makeDMConversation(conversation?: ConversationPreview): DMConversationModel {
    const base = messagesRepository.getDMConversation();
    if (!conversation) return { ...base, ...dmScripts[base.id] };
    const scripted = dmScripts[conversation.id];

    return {
        ...base,
        ...scripted,
        id: conversation.id,
        user: {
            ...base.user,
            id: conversation.id,
            name: conversation.name,
            avatar: conversation.avatar,
            role: conversation.sender || "SideQuestHQ learner",
            company: conversation.id.includes("team") || conversation.id.includes("thinkers") ? "Group DM" : "Learning Circle",
            bio: `Learning partner. Last note: ${conversation.preview.toLowerCase()}`,
        },
        messages: scripted?.messages ?? base.messages,
        resources: base.resources.map((resource, index) => ({ ...resource, count: resource.count + (conversation.id.length % (index + 3)) })),
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
        return messagesRepository.getMessageBase().conversations.filter((item) => item.kind === "dm");
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


    const toggleCommunityReaction = useCallback((conversationId: string, messageId: string, emoji: string) => {
        const base = mapCohortToCommunity(conversationId).messages;
        setCommunityMessages((current) => ({
            ...current,
            [conversationId]: (current[conversationId] ?? base).map((message) => {
                if (message.id !== messageId) return message;
                const reactions = message.reactions ?? [];
                const existing = reactions.find((reaction) => reaction.emoji === emoji);
                if (!existing) return { ...message, reactions: [...reactions, { emoji, count: 1, reactedByMe: true }] };
                const next = existing.reactedByMe
                    ? { ...existing, count: Math.max(0, existing.count - 1), reactedByMe: false }
                    : { ...existing, count: existing.count + 1, reactedByMe: true };
                return { ...message, reactions: reactions.map((reaction) => reaction.emoji === emoji ? next : reaction).filter((reaction) => reaction.count > 0) };
            }),
        }));
    }, []);

    const uploadCommunityAttachment = useCallback((conversationId: string, file: File, kind: ChatAttachmentKind) => {
        const base = mapCohortToCommunity(conversationId).messages;
        const message: CommunityMessage = { id: `${conversationId}-upload-${Date.now()}`, author: me, badge: "You", timestamp: `Today at ${nowLabel()}`, body: kind === "image" ? "Uploaded an image." : `Uploaded ${file.name}.`, attachment: mockAttachment(`${conversationId}-${file.name}`, file.name, kind) };
        setCommunityMessages((current) => ({ ...current, [conversationId]: [...(current[conversationId] ?? base), message] }));
    }, []);

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

    const uploadDMAttachment = useCallback((conversationId: string, file: File, kind: ChatAttachmentKind) => {
        const base = makeDMConversation(dmConversations.find((item) => item.id === conversationId)).messages;
        const message: DMMessage = { id: `${conversationId}-upload-${Date.now()}`, type: "outgoing", text: kind === "image" ? "" : `Uploaded ${file.name}.`, timestamp: nowLabel(), status: "sent", tail: true, attachment: mockAttachment(`${conversationId}-${file.name}`, file.name, kind) };
        setDMMessages((current) => ({ ...current, [conversationId]: [...(current[conversationId] ?? base), message] }));
    }, [dmConversations]);

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
        challenge: messagesRepository.getMessageBase().challenge,
        friendsOnline: messagesRepository.getMessageBase().friendsOnline,
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
            uploadCommunityAttachment,
            toggleCommunityReaction,
            uploadDMAttachment,
        },
    };
}
