import { Center } from "../Center/Center";
import { CommunityChat } from "../CommunityChat/CommunityChat";
import { DMConversation } from "../DMConversation/DMConversation";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { useMessage } from "../../hooks";
import styles from "./SocialLanding.module.css";

interface Props {
    message: ReturnType<typeof useMessage>;
}

export function SocialLanding({ message }: Props) {
    return (
        <div className={styles.landing}>
            <LeftSidebar
                tabs={message.sidebarTabs}
                filters={message.conversationFilters}
                selectedTab={message.selectedSidebarTab}
                selectedFilter={message.conversationFilter}
                conversations={message.conversations}
                onTabChange={message.actions.setSelectedSidebarTab}
                onFilterChange={message.actions.setConversationFilter}
                onSelectConversation={message.actions.selectConversation}
            />

            {message.view === "community" && (
                <CommunityChat
                    community={message.communityChat}
                    draft={message.communityDraft}
                    scrollTop={message.communityScrollTop}
                    onBack={message.actions.backToLanding}
                    onDraftChange={(value) => message.actions.setDraft(message.communityChat.id, value)}
                    onScrollChange={(scrollTop) => message.actions.setConversationScroll(message.communityChat.id, scrollTop)}
                />
            )}

            {message.view === "dm" && (
                <DMConversation
                    conversation={message.dmConversation}
                    draft={message.dmDraft}
                    scrollTop={message.dmScrollTop}
                    onBack={message.actions.backToLanding}
                    onDraftChange={(value) => message.actions.setDraft(message.dmConversation.id, value)}
                    onScrollChange={(scrollTop) => message.actions.setConversationScroll(message.dmConversation.id, scrollTop)}
                />
            )}

            {message.view === "landing" && (
                <>
                    <Center
                        query={message.searchQuery}
                        liveSessions={message.liveSessions}
                        recentMessages={message.recentMessages}
                        onSearchChange={message.actions.setSearchQuery}
                    />
                    <RightSidebar
                        upcomingEvents={message.upcomingEvents}
                        challenge={message.challenge}
                        friendsOnline={message.friendsOnline}
                    />
                </>
            )}
        </div>
    );
}
