import { useEffect, useRef, useState } from 'react';
import type { CommunityChatModel, ReplyContext } from '../../models';
import { TypingIndicator } from '../shared/TypingIndicator/TypingIndicator';
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
  // Batch C/D: Reply, typing indicator
  replyBanner?: ReplyContext | null;
  onReplyDismiss?(): void;
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
  isTyping?: boolean;
  typingUsernames?: string[];
}

interface MessageBubbleExtraProps {
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
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
  replyBanner,
  onReplyDismiss,
  onReply,
  isTyping = false,
  typingUsernames = [],
}: Props) {
  const [aboutOpen, setAboutOpen] = useState(false);
  /** Batch D6: Track dismissed pinned announcement */
  const [dismissedPinned, setDismissedPinned] = useState(false);
  /** Batch D4: Track muted channel IDs (local state for mock purposes) */
  const [mutedChannels, setMutedChannels] = useState<ReadonlySet<string>>(new Set());
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

  const handleDismissPinned = () => setDismissedPinned(true);

  /** Batch D4: Toggle mute for a channel */
  const handleToggleMute = (channelId: string, muted: boolean) => {
    if (muted) {
      setMutedChannels((prev) => new Set([...prev, channelId]));
    } else {
      setMutedChannels((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  };

  /** Batch D4: Hide unread badges for muted channels */
  const effectiveChannels = community.channels.map((ch) =>
    mutedChannels.has(ch.id) ? { ...ch, unreadCount: undefined } : ch
  );

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
        {/* Batch D4: Pass effective channels (muted ones hidden) */}
        <ChannelTabs
          channels={effectiveChannels}
          selectedChannel={community.selectedChannel}
        />
        {/* Batch D6: Hide pinned banner when dismissed */}
        {!dismissedPinned && (
          <PinnedBanner
            pinned={community.pinnedAnnouncement}
            onDismiss={handleDismissPinned}
          />
        )}
        <MessageTimeline
          messages={community.messages}
          scrollTop={scrollTop}
          onScrollChange={onScrollChange}
          onReaction={onReaction}
          onReply={onReply}
        />
        {/* Batch C/D: Reply banner + typing indicator */}
        <MessageComposer
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          onUpload={onUpload}
          replyBanner={replyBanner}
          onReplyDismiss={onReplyDismiss}
          channelName={community.selectedChannel}
        />
        {isTyping && (
          <div style={{ padding: '0 16px' }}>
            <TypingIndicator usernames={typingUsernames} />
          </div>
        )}
      </main>
      {/* Batch D4: Pass mute state + toggle to sidebar */}
      {aboutOpen && (
        <CommunitySidebar
          community={community}
          mutedChannels={mutedChannels}
          onToggleMute={handleToggleMute}
          onClose={() => setAboutOpen(false)}
        />
      )}
    </div>
  );
}
