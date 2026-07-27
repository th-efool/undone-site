import { Center } from "../Center/Center";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { useMessage } from "../../hooks";
import styles from "./SocialLanding.module.css";
export function SocialLanding(){const message=useMessage();return <div className={styles.landing}><LeftSidebar tabs={message.sidebarTabs} filters={message.conversationFilters} selectedTab={message.selectedSidebarTab} selectedFilter={message.conversationFilter} conversations={message.conversations} onTabChange={message.actions.setSelectedSidebarTab} onFilterChange={message.actions.setConversationFilter}/><Center query={message.searchQuery} liveSessions={message.liveSessions} recentMessages={message.recentMessages} onSearchChange={message.actions.setSearchQuery}/><RightSidebar upcomingEvents={message.upcomingEvents} challenge={message.challenge} friendsOnline={message.friendsOnline}/></div>}
