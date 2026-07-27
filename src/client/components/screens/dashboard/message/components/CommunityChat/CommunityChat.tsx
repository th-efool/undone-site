import { CommunityChatModel } from "../../models";
import { ChannelTabs } from "./components/ChannelTabs/ChannelTabs";
import { CommunityHeader } from "./components/CommunityHeader/CommunityHeader";
import { CommunitySidebar } from "./components/CommunitySidebar/CommunitySidebar";
import { MessageComposer } from "./components/MessageComposer/MessageComposer";
import { MessageTimeline } from "./components/MessageTimeline/MessageTimeline";
import { PinnedBanner } from "./components/PinnedBanner/PinnedBanner";
import styles from "./CommunityChat.module.css";

interface Props {
    community: CommunityChatModel;
    draft: string;
    scrollTop: number;
    onBack(): void;
    onDraftChange(value: string): void;
    onScrollChange(scrollTop: number): void;
    onSend(): void;
}

export function CommunityChat({ community, draft, scrollTop, onBack, onDraftChange, onScrollChange, onSend }: Props) {
    return (
        <div className={styles.chat}>
            <main className={styles.main}>
                <CommunityHeader community={community} onBack={onBack} />
                <ChannelTabs channels={community.channels} selectedChannel={community.selectedChannel} />
                <PinnedBanner pinned={community.pinnedAnnouncement} />
                <MessageTimeline messages={community.messages} scrollTop={scrollTop} onScrollChange={onScrollChange} />
                <MessageComposer value={draft} onChange={onDraftChange} onSend={onSend} />
            </main>
            <CommunitySidebar community={community} />
        </div>
    );
}
