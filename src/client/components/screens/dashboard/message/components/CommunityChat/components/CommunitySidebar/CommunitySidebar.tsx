import { CommunityChatModel } from '../../../../models';
import { MediaGallery } from '../MediaGallery/MediaGallery';
import { MembersStrip } from '../MembersStrip/MembersStrip';
import { PinnedMessages } from '../PinnedMessages/PinnedMessages';
import { UpcomingEvents } from '../UpcomingEvents/UpcomingEvents';
import styles from './CommunitySidebar.module.css';
import { X } from 'lucide-react';
interface Props {
  community: CommunityChatModel;
  onClose(): void;
}
export function CommunitySidebar({ community, onClose }: Props) {
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
      <section className={styles.card}>
        <h2>About</h2>
        <p>A space for builders learning &amp; building together.</p>
        <footer>
          Created by {community.createdBy} • {community.createdAt}
        </footer>
      </section>
      <section className={styles.card}>
        <header>
          <h2>Members online</h2>
          <span>{community.onlineCount}</span>
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
