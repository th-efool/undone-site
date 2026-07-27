import { CommunityChatModel } from "../../models";
import { ChannelTabs } from "./components/ChannelTabs/ChannelTabs";
import { CommunityHeader } from "./components/CommunityHeader/CommunityHeader";
import { CommunitySidebar } from "./components/CommunitySidebar/CommunitySidebar";
import { MessageComposer } from "./components/MessageComposer/MessageComposer";
import { MessageTimeline } from "./components/MessageTimeline/MessageTimeline";
import { PinnedBanner } from "./components/PinnedBanner/PinnedBanner";
import styles from "./CommunityChat.module.css";

interface Props { community: CommunityChatModel; }
export function CommunityChat({ community }: Props) {return <div className={styles.chat}><main className={styles.main}><CommunityHeader community={community}/><ChannelTabs channels={community.channels} selectedChannel={community.selectedChannel}/><PinnedBanner pinned={community.pinnedAnnouncement}/><MessageTimeline messages={community.messages}/><MessageComposer/></main><CommunitySidebar community={community}/></div>}
