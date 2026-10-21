'use client';

import React, { useState } from 'react';
import { Crown, MoreHorizontal, Send, Smile, UserPlus } from 'lucide-react';
import type { RoomParticipantView, Viewer } from '../../types';
import { ParticipantAvatar } from '../../components/ParticipantAvatar';
import ParticipantActionsMenu from './ParticipantActionsMenu';
import { useRoomChat } from '../../hooks/useRoomChat';
import styles from './RoomSocial.module.css';

interface Props {
  participants: RoomParticipantView[];
  viewer: Viewer;
  onOpenPeople: (trigger: HTMLElement) => void;
  onNotify: (text: string) => void;
  showPeople?: boolean;
  roomSlug?: string;
  canManageParticipants?: boolean;
  onRosterMutated?: () => void;
  cohortTitle?: string | null;
  channelId?: string | null;
  streamGeneration?: number;
}

export default function RoomSocial({
  participants,
  viewer,
  onOpenPeople,
  onNotify,
  showPeople = true,
  roomSlug,
  canManageParticipants = false,
  onRosterMutated,
  cohortTitle,
  channelId,
  streamGeneration = 1,
}: Props) {
  const [draft, setDraft] = useState('');
  const {
    messages,
    isLoading,
    sendMessage,
    retryMessage,
    refreshMessages,
  } = useRoomChat({
    channelId,
    streamGeneration,
    enabled: Boolean(channelId),
  });

  const invite = async () => {
    try {
      if (typeof window !== 'undefined') {
        const canonicalUrl = roomSlug
          ? `${window.location.origin}/studyroom/${roomSlug}`
          : window.location.href;
        await navigator.clipboard.writeText(canonicalUrl);
        if (cohortTitle) {
          onNotify(`Room link copied. Enrolled members of ${cohortTitle} can join.`);
        } else {
          onNotify('Room link copied to clipboard.');
        }
      }
    } catch {
      onNotify('Copy the URL from your browser address bar to share.');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    void sendMessage(text);
    setDraft('');
  };

  // Build the list of participants to display, ensuring current viewer is at top
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return 0;
  });

  return (
    <aside className={styles.social} aria-label="Room community">
      {showPeople && (
        <section className={styles.peopleCard} aria-label="People in room">
          <header className={styles.cardHeader}>
            <span className={styles.cardTitle}>People · {participants.length || 3}</span>
            <button
              type="button"
              className={styles.moreBtn}
              aria-label="View all participants"
              title="View all participants"
              onClick={(e) => onOpenPeople(e.currentTarget)}
            >
              <MoreHorizontal size={18} />
            </button>
          </header>

          <ul className={styles.roster}>
            {sortedParticipants.slice(0, 3).map((person) => {
              const isOwner = person.role === 'OWNER';
              const isMod = person.role === 'MODERATOR';
              const isHost = person.role === 'HOST' || (person.isAdmin && !person.role && !isOwner);
              const isCurrent = person.isCurrentUser;
              const nameDisplay = isCurrent ? 'You' : person.displayName;

              return (
                <li key={person.userId} className={styles.rosterItem}>
                  <ParticipantAvatar
                    name={person.displayName}
                    src={person.avatarUrl}
                    size={38}
                  />
                  <div className={styles.personDetails}>
                    <div className={styles.personHeader}>
                      <span className={styles.personName}>{nameDisplay}</span>
                      {isOwner && (
                        <span className={styles.hostBadge} title="Room owner">
                          (Owner) <Crown size={12} className={styles.crownIcon} />
                        </span>
                      )}
                      {isMod && (
                        <span className={styles.hostBadge} style={{ color: '#38bdf8' }} title="Room moderator">
                          (Mod)
                        </span>
                      )}
                      {isHost && (
                        <span className={styles.hostBadge} title="Room host">
                          (Host) <Crown size={12} className={styles.crownIcon} />
                        </span>
                      )}
                    </div>
                    <p className={styles.personGoal}>
                      {person.publicGoal || 'Focusing'}
                    </p>
                  </div>
                  {canManageParticipants && roomSlug && !isCurrent && !isOwner && (
                    <ParticipantActionsMenu
                      roomSlug={roomSlug}
                      targetUserId={person.userId}
                      targetName={person.displayName}
                      targetRole={person.role}
                      canManageParticipants={canManageParticipants}
                      onActionSuccess={(msg) => onNotify(msg)}
                      onActionError={(err) => onNotify(`Error: ${err}`)}
                      onRosterMutated={onRosterMutated}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className={styles.inviteBtn}
            onClick={() => void invite()}
          >
            <UserPlus size={16} aria-hidden="true" />
            <span>Invite people</span>
          </button>
        </section>
      )}

      <section className={styles.chatCard} aria-label="Room chat">
        <header className={styles.cardHeader}>
          <span className={styles.cardTitle}>Chat</span>
          <button
            type="button"
            className={styles.moreBtn}
            aria-label="Refresh messages"
            title="Refresh messages"
            onClick={() => void refreshMessages()}
          >
            <MoreHorizontal size={18} />
          </button>
        </header>

        <div className={styles.messageFeed} role="log" aria-label="Chat messages">
          {messages.length === 0 ? (
            <div className={styles.emptyChat}>
              {isLoading ? 'Loading chat...' : 'No messages yet. Say hello!'}
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser =
                Boolean(viewer.userId) &&
                (msg.authorId === viewer.userId || msg.author?.id === viewer.userId);
              const senderName = isCurrentUser
                ? 'You'
                : msg.author?.name || msg.author?.username || 'Participant';
              const avatarSrc = isCurrentUser
                ? viewer.avatarUrl || msg.author?.image
                : msg.author?.image;
              const timeDisplay = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div key={msg.id} className={styles.messageRow}>
                  <ParticipantAvatar
                    name={senderName === 'You' ? viewer.displayName : senderName}
                    src={avatarSrc}
                    size={32}
                  />
                  <div className={styles.messageContent}>
                    <div className={styles.messageMeta}>
                      <strong className={styles.senderName}>{senderName}</strong>
                      <time className={styles.messageTime}>{timeDisplay}</time>
                      {msg.deliveryStatus === 'pending' && (
                        <span className={styles.statusPending}>(sending...)</span>
                      )}
                    </div>
                    <p className={styles.messageBody}>{msg.content}</p>
                    {msg.deliveryStatus === 'failed' && (
                      <div className={styles.statusFailed}>
                        <span>Failed to send</span>
                        {msg.clientRequestId && (
                          <button
                            type="button"
                            className={styles.retryBtn}
                            onClick={() => void retryMessage(msg.clientRequestId!)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className={styles.composerForm} onSubmit={handleSendMessage}>
          <input
            type="text"
            className={styles.composerInput}
            aria-label="Write a message"
            placeholder="Write a message..."
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className={styles.emojiBtn}
            aria-label="Insert emoji"
            title="Insert emoji"
            onClick={() => setDraft((prev) => prev + ' 👋')}
          >
            <Smile size={18} />
          </button>
          <button
            type="submit"
            className={styles.sendBtn}
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </section>
    </aside>
  );
}
