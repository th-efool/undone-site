import { useEffect, useRef, useState } from 'react';
import { CommunityChatModel } from '../../models';
import { ChannelTabs } from './components/ChannelTabs/ChannelTabs';
import { CommunityHeader } from './components/CommunityHeader/CommunityHeader';
import { CommunitySidebar } from './components/CommunitySidebar/CommunitySidebar';
import { MessageComposer } from './components/MessageComposer/MessageComposer';
import { MessageTimeline } from './components/MessageTimeline/MessageTimeline';
import { PinnedBanner } from './components/PinnedBanner/PinnedBanner';
import styles from './CommunityChat.module.css';

interface Props {
  community: CommunityChatModel;
  draft: string;
  scrollTop: number;
  onBack(): void;
  onDraftChange(value: string): void;
  onScrollChange(scrollTop: number): void;
  onSend(): void;
  onReaction(messageId: string, emoji: string): void;
  onUpload(file: File, kind: 'image' | 'pdf' | 'file' | 'video' | 'audio'): void;
}

export function CommunityChat({
  community,
  draft,
  scrollTop,
  onBack,
  onDraftChange,
  onScrollChange,
  onSend,
  onReaction,
  onUpload,
}: Props) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAboutOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-about-panel]') && !target.closest('[data-about-toggle]'))
        setAboutOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [aboutOpen]);
  return (
    <div
      className={styles.chat}
      ref={shellRef}
    >
      <main className={styles.main}>
        <CommunityHeader
          community={community}
          onBack={onBack}
          aboutOpen={aboutOpen}
          onToggleAbout={() => setAboutOpen((open) => !open)}
        />
        <ChannelTabs
          channels={community.channels}
          selectedChannel={community.selectedChannel}
        />
        <PinnedBanner pinned={community.pinnedAnnouncement} />
        <MessageTimeline
          messages={community.messages}
          scrollTop={scrollTop}
          onScrollChange={onScrollChange}
          onReaction={onReaction}
        />
        <MessageComposer
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          onUpload={onUpload}
        />
      </main>
      {aboutOpen && (
        <CommunitySidebar
          community={community}
          onClose={() => setAboutOpen(false)}
        />
      )}
    </div>
  );
}
