/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, Bell, MoreHorizontal, Phone, UsersRound, Video } from "lucide-react";
import { CommunityChatModel } from "../../../../models";
import styles from "./CommunityHeader.module.css";

interface Props {
    community: CommunityChatModel;
    onBack(): void;
}

export function CommunityHeader({ community, onBack }: Props) {
    return (
        <header className={styles.header}>
            <button type="button" className={styles.back} onClick={onBack} aria-label="Back to social landing"><ArrowLeft size={22} /></button>
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
