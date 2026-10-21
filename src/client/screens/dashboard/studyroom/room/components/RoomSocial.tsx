'use client';

import React, { useState } from 'react';
import { Crown, MicOff, MoreHorizontal, Send, Smile, UserPlus } from 'lucide-react';
import type { RoomParticipantView, Viewer } from '../../types';
import { ParticipantAvatar } from '../../components/ParticipantAvatar';
import ParticipantActionsMenu from './ParticipantActionsMenu';
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
}

interface ChatMessage {
  id: string | number;
  senderName: string;
  avatarUrl?: string | null;
  time: string;
  text: string;
  isCurrentUser: boolean;
  reaction?: {
    emoji: string;
    count: number;
  };
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    senderName: 'Aarav',
    time: '5:12 PM',
    text: 'just finished the 1st section this was actually fun 🚀',
    isCurrentUser: false,
    reaction: { emoji: '👍', count: 2 },
  },
  {
    id: 2,
    senderName: 'Priya',
    time: '5:15 PM',
    text: 'same! on to the next one?',
    isCurrentUser: false,
  },
  {
    id: 3,
    senderName: 'You',
    time: '5:16 PM',
    text: 'yess 5 min break after this then continue 💪',
    isCurrentUser: true,
  },
];

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
}: Props) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);

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

    const newMessage: ChatMessage = {
      id: Date.now(),
      senderName: 'You',
      avatarUrl: viewer.avatarUrl,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      text,
      isCurrentUser: true,
    };

    setMessages((prev) => [...prev, newMessage]);
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
                      {isCurrent ? 'Studying · System Design' : (person.publicGoal || 'Focusing')}
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
                  {!isCurrent && (
                    <span className={styles.micMuted} title="Microphone muted">
                      <MicOff size={14} aria-hidden="true" />
                    </span>
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
            aria-label="Chat options"
            title="Chat options"
          >
            <MoreHorizontal size={18} />
          </button>
        </header>

        <div className={styles.messageFeed} role="log" aria-label="Chat messages">
          {messages.map((msg) => (
            <div key={msg.id} className={styles.messageRow}>
              <ParticipantAvatar
                name={msg.senderName === 'You' ? viewer.displayName : msg.senderName}
                src={msg.avatarUrl ?? (msg.isCurrentUser ? viewer.avatarUrl : null)}
                size={32}
              />
              <div className={styles.messageContent}>
                <div className={styles.messageMeta}>
                  <strong className={styles.senderName}>{msg.senderName}</strong>
                  <time className={styles.messageTime}>{msg.time}</time>
                </div>
                <p className={styles.messageBody}>{msg.text}</p>
                {msg.reaction && (
                  <div className={styles.reactionChip}>
                    <span>{msg.reaction.emoji}</span>
                    <span>{msg.reaction.count}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
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
