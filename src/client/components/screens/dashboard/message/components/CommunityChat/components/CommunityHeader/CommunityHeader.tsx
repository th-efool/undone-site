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
        <ArrowLeft size={20} />
      </button>
      <Image width={44} height={44} className={styles.avatar} src={community.avatar} alt="" />
      <div className={styles.info}>
        <h1>{community.name}</h1>
        {community.description && <p className={styles.description}>{community.description}</p>}
      </div>
      <div
        className={styles.actions}
        ref={ref}
      >
        {community.members.length > 0 && (
          <div className={styles.members} title={`${community.onlineCount} members`}>
            {community.members.slice(0, 4).map((member) => (
              <Image key={member.id} width={24} height={24} src={member.avatar} alt={member.name} />
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Start video"
        >
          <Video size={18} />
        </button>
        <button
          type="button"
          aria-label="Start call"
        >
          <Phone size={18} />
        </button>
        <button
          type="button"
          aria-label="Notification settings"
          onClick={() => setNotificationsOpen((open) => !open)}
        >
          <Bell size={18} />
        </button>
        <button
          type="button"
          aria-label="Members"
        >
          <UsersRound size={18} />
        </button>
        <button
          type="button"
          aria-label="Toggle about panel"
          data-about-toggle
          aria-pressed={aboutOpen}
          onClick={onToggleAbout}
        >
          <MoreHorizontal size={18} />
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
