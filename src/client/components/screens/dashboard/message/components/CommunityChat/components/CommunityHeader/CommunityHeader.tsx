import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, Check, MoreHorizontal, Phone, UsersRound, Video } from 'lucide-react';
import { CommunityChatModel } from '../../../../models';
import styles from './CommunityHeader.module.css';

interface Props {
  community: CommunityChatModel;
  aboutOpen: boolean;
  onBack(): void;
  onToggleAbout(): void;
}
const settings = [
  'All Messages',
  'Mentions Only',
  'Mute 1 Hour',
  'Mute Today',
  'Mute Until I Turn It Back On',
];
export function CommunityHeader({ community, aboutOpen, onBack, onToggleAbout }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selected, setSelected] = useState(settings[0]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [notificationsOpen]);
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        aria-label="Back to social landing"
      >
        <ArrowLeft size={22} />
      </button>
      <Image fill
        className={styles.avatar}
        src={community.avatar}
        alt=""
       />
      <div className={styles.info}>
        <h1>{community.name}</h1>
        <div className={styles.meta}>
          <div className={styles.members}>
            {community.members.slice(0, 5).map((member) => (
              <Image fill
                key={member.id}
                src={member.avatar}
                alt=""
               />
            ))}
          </div>
          <span>{community.onlineCount} online</span>
          <span>•</span>
          <span>{community.description}</span>
        </div>
      </div>
      <div
        className={styles.actions}
        ref={ref}
      >
        <button
          type="button"
          aria-label="Start video"
        >
          <Video size={20} />
        </button>
        <button
          type="button"
          aria-label="Start call"
        >
          <Phone size={20} />
        </button>
        <button
          type="button"
          aria-label="Notification settings"
          onClick={() => setNotificationsOpen((open) => !open)}
        >
          <Bell size={20} />
        </button>
        <button
          type="button"
          aria-label="Members"
        >
          <UsersRound size={20} />
        </button>
        <button
          type="button"
          aria-label="Toggle about panel"
          data-about-toggle
          aria-pressed={aboutOpen}
          onClick={onToggleAbout}
        >
          <MoreHorizontal size={20} />
        </button>
        {notificationsOpen && (
          <div className={styles.popover}>
            {settings.map((setting) => (
              <button
                type="button"
                key={setting}
                onClick={() => {
                  setSelected(setting);
                  setNotificationsOpen(false);
                }}
              >
                <span>{setting}</span>
                {selected === setting && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
