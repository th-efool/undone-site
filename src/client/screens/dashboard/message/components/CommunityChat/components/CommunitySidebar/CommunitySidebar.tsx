import { Bell, BellOff, X } from 'lucide-react';
import { CommunityChatModel } from '../../../../models';
import { MediaGallery } from '../MediaGallery/MediaGallery';
import { MembersStrip } from '../MembersStrip/MembersStrip';
import { PinnedMessages } from '../PinnedMessages/PinnedMessages';
import { UpcomingEvents } from '../UpcomingEvents/UpcomingEvents';
import styles from './CommunitySidebar.module.css';

interface Props {
  community: CommunityChatModel;
  mutedChannels?: ReadonlySet<string>;
  onToggleMute?(channelId: string, muted: boolean): void;
  onClose(): void;
}

export function CommunitySidebar({ community, mutedChannels = new Set(), onToggleMute, onClose }: Props) {
  const channelIsMuted = mutedChannels.has(community.selectedChannel);
  return (
    <aside
      className={styles.sidebar}
      data-about-panel
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close about panel"
      >
        <X size={18} />
      </button>

      {/* Channel Settings / Mute Toggle */}
      <section className={`${styles.card} ${styles.muteCard}`}>
        <h2>Channel Settings</h2>
        <p className={styles.muteDescription}>
          Muting stops unread badges and notifications for this channel.
        </p>
        <button
          type="button"
          className={`${styles.muteBtn}${channelIsMuted ? ` ${styles.muted}` : ''}`}
          onClick={() => onToggleMute?.(community.selectedChannel, !channelIsMuted)}
          aria-pressed={channelIsMuted}
        >
          {channelIsMuted ? <BellOff size={16} /> : <Bell size={16} />}
          {channelIsMuted ? 'Unmute channel' : 'Mute notifications'}
        </button>
      </section>

      <section className={styles.card}>
        <h2>About</h2>
        <p>A space for builders learning &amp; building together.</p>
        <footer>
          Created by {community.createdBy} • {community.createdAt}
        </footer>
      </section>

      <section className={styles.card}>
        <header>
          <h2>Members</h2>
          <span>{community.members.length}</span>
          <button type="button">See all</button>
        </header>
        <MembersStrip
          members={community.members}
          count={community.onlineCount}
        />
      </section>

      <section className={styles.card}>
        <header>
          <h2>Pinned Messages</h2>
          <span>{community.pinnedMessages.length}</span>
          <button type="button">See all</button>
        </header>
        <PinnedMessages items={community.pinnedMessages} />
      </section>

      <section className={styles.card}>
        <header>
          <h2>Media</h2>
          <span>{community.media.length}</span>
          <button type="button">See all</button>
        </header>
        <MediaGallery items={community.media} />
      </section>

      <section className={styles.card}>
        <header>
          <h2>Upcoming Events</h2>
          <span>{community.events.length}</span>
          <button type="button">See all</button>
        </header>
        <UpcomingEvents events={community.events} />
      </section>
    </aside>
  );
}
