import { Center } from "../Center/Center";
import { CommunityChat } from "../CommunityChat/CommunityChat";
import { DMConversation } from "../DMConversation/DMConversation";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { useMessage } from "../../hooks";
import styles from "./SocialLanding.module.css";

export function SocialLanding() {
    const message = useMessage();

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

            {message.view === "community" && <CommunityChat community={message.communityChat} />}

            {message.view === "dm" && (
                <DMConversation
                    conversation={message.dmConversation}
                    onBack={message.actions.closeDMConversation}
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
