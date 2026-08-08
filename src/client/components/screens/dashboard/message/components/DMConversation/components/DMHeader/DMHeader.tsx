import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, Check, MoreHorizontal, Phone, Video } from 'lucide-react';
import { DMUser } from '../../../../models';
import styles from './DMHeader.module.css';
interface Props {
  user: DMUser;
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
export function DMHeader({ user, aboutOpen, onBack, onToggleAbout }: Props) {
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
        aria-label="Back"
      >
        <ArrowLeft size={22} />
      </button>
      <span className={styles.avatar}>
        <Image width={40} height={40} src={user.avatar} alt={user.name} className={styles.avatar} />
        <i />
      </span>
      <div className={styles.info}>
        <h1>{user.name}</h1>
        <p>Online</p>
      </div>
      <div
        className={styles.actions}
        ref={ref}
      >
        <button
          type="button"
          aria-label="Start video"
        >
          <Video size={22} />
        </button>
        <button
          type="button"
          aria-label="Start call"
        >
          <Phone size={22} />
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
          aria-label="Toggle about panel"
          data-about-toggle
          aria-pressed={aboutOpen}
          onClick={onToggleAbout}
        >
          <MoreHorizontal size={22} />
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
