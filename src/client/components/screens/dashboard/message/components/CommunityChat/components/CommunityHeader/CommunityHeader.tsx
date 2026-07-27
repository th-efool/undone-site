import { Bell, MoreHorizontal, Phone, UsersRound, Video } from "lucide-react";
import { CommunityChatModel } from "../../../../models";
import styles from "./CommunityHeader.module.css";

interface Props { community: CommunityChatModel; }

export function CommunityHeader({ community }: Props) {
    return (
        <header className={styles.header}>
            <img className={styles.avatar} src={community.avatar} alt="" />
            <div className={styles.info}>
                <h1>{community.name}</h1>
                <div className={styles.meta}>
                    <div className={styles.members}>{community.members.slice(0, 5).map((member) => <img key={member.id} src={member.avatar} alt="" />)}</div>
                    <span>{community.onlineCount} online</span><span>•</span><span>{community.description}</span>
                </div>
            </div>
            <div className={styles.actions}>
                {[Video, Phone, Bell, UsersRound, MoreHorizontal].map((Icon, index) => <button key={index} type="button" aria-label="Community action"><Icon size={20} /></button>)}
            </div>
        </header>
    );
}
