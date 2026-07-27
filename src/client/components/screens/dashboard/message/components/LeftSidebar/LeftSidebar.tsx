import { ConversationFilter, ConversationPreview, SidebarTab } from "../../models";
import { ConversationList } from "./ConversationList/ConversationList";
import { SidebarFilters } from "./SidebarFilters/SidebarFilters";
import { SidebarHeader } from "./SidebarHeader/SidebarHeader";
import styles from "./LeftSidebar.module.css";

interface Props {
    tabs: { id: SidebarTab; label: string }[];
    filters: { id: ConversationFilter; label: string }[];
    selectedTab: SidebarTab;
    selectedFilter: ConversationFilter;
    conversations: ConversationPreview[];
    onTabChange(tab: SidebarTab): void;
    onFilterChange(filter: ConversationFilter): void;
    onSelectConversation(conversation: ConversationPreview): void;
}

export function LeftSidebar(props: Props) {
    return (
        <aside className={styles.sidebar}>
            <SidebarHeader />
            <SidebarFilters
                tabs={props.tabs}
                filters={props.filters}
                selectedTab={props.selectedTab}
                selectedFilter={props.selectedFilter}
                onTabChange={props.onTabChange}
                onFilterChange={props.onFilterChange}
            />
            <ConversationList
                conversations={props.conversations}
                onSelectConversation={props.onSelectConversation}
            />
        </aside>
    );
}
