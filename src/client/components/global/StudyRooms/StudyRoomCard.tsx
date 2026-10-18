'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Copy, Pin, UserPlus, Check } from 'lucide-react';
import { LiveSession } from '@/src/client/types/dashboard';
import styles from './StudyRoomCard.module.css';

export interface StudyRoomCardProps {
  session: LiveSession;
  variant?: 'standard' | 'compact';
}

const ROOM_MEMBER_COUNTS: Record<string, number> = {
  fireplace: 324,
  library: 412,
  seaside: 298,
  shrine: 176,
  canal: 253,
  ruins: 198,
};

const FALLBACK_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export const StudyRoomCard = React.memo(function StudyRoomCard({ session, variant = 'standard' }: StudyRoomCardProps) {
  const isCompact = variant === 'compact';
  const memberCount =
    ROOM_MEMBER_COUNTS[session.id.toLowerCase()] ||
    ROOM_MEMBER_COUNTS[session.title.toLowerCase()] ||
    (session.onlineCount ? session.onlineCount * 70 + 84 : 250);

  const [thumbSrc, setThumbSrc] = useState(session.thumbnail || FALLBACK_THUMBNAIL);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThumbSrc(session.thumbnail || FALLBACK_THUMBNAIL);
  }, [session.thumbnail]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => setFeedbackToast(null), 2400);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const roomUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/message?room=${encodeURIComponent(session.id)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomUrl).catch(() => {});
    }
    setIsMenuOpen(false);
    setFeedbackToast('Room link copied!');
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPinned((prev) => !prev);
    setIsMenuOpen(false);
    setFeedbackToast(!isPinned ? 'Room pinned to top!' : 'Room unpinned');
  };

  const handleInviteFriends = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const roomUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/message?room=${encodeURIComponent(session.id)}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Join ${session.title} on Sidequest`,
          text: `Let's study together in "${session.title}" on Sidequest!`,
          url: roomUrl,
        })
        .catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`Join me in "${session.title}" study room: ${roomUrl}`).catch(() => {});
    }
    setIsMenuOpen(false);
    setFeedbackToast('Invite link copied!');
  };

  if (isCompact) {
    return (
      <Link
        href="/message"
        className={`${styles.cardCompact} ${isPinned ? styles.cardPinned : ''}`}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        aria-label={`${session.title} study room, ${session.status}, ${memberCount} members`}
      >
        <Image
          fill
          sizes="(max-width: 640px) 260px, (max-width: 1200px) 33vw, 180px"
          className={styles.bgCompact}
          src={thumbSrc}
          alt={session.title}
          draggable={false}
          onError={() => setThumbSrc(FALLBACK_THUMBNAIL)}
        />
        <div className={styles.overlayGradientCompact} />

        {/* Pinned Indicator */}
        {isPinned && (
          <div className={styles.pinnedBadgeCompact} title="Pinned room">
            <Pin size={10} fill="currentColor" />
          </div>
        )}

        {/* Feedback Badge */}
        {feedbackToast && (
          <div className={styles.feedbackToastCompact}>
            <Check size={11} strokeWidth={2.6} />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Kebab Button & Action Dropdown */}
        <div className={styles.kebabWrapperCompact} ref={menuRef}>
          <button
            type="button"
            className={`${styles.kebabBtnCompact} ${isMenuOpen ? styles.kebabActive : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            aria-label={`Options for ${session.title}`}
            aria-expanded={isMenuOpen}
          >
            <MoreVertical size={14} strokeWidth={2.4} />
          </button>

          {isMenuOpen && (
            <div
              className={styles.actionMenuCompact}
              role="menu"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <button
                type="button"
                className={styles.menuItemCompact}
                onClick={handleCopyLink}
                role="menuitem"
              >
                <Copy size={12} strokeWidth={2.2} />
                <span>Copy room link</span>
              </button>

              <button
                type="button"
                className={styles.menuItemCompact}
                onClick={handleTogglePin}
                role="menuitem"
              >
                <Pin size={12} strokeWidth={2.2} fill={isPinned ? 'currentColor' : 'none'} />
                <span>{isPinned ? 'Unpin room' : 'Pin room'}</span>
              </button>

              <button
                type="button"
                className={styles.menuItemCompact}
                onClick={handleInviteFriends}
                role="menuitem"
              >
                <UserPlus size={12} strokeWidth={2.2} />
                <span>Invite friends</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.overlayBarCompact}>
          <h3 className={styles.roomNameCompact}>{session.title}</h3>
          <div className={styles.bottomRowCompact}>
            <p className={styles.subtextCompact}>{session.status}</p>
            <div className={styles.avatarsCompact}>
              {session.avatars.slice(0, 2).map((person, i) => (
                <span
                  key={person.id}
                  className={styles.avatarWrapperCompact}
                  style={{ zIndex: 2 - i }}
                >
                  <Image
                    width={18}
                    height={18}
                    sizes="18px"
                    loading="lazy"
                    src={person.avatar}
                    alt=""
                    draggable={false}
                    className={styles.avatarCompact}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </span>
              ))}
              <span className={styles.memberCountBadgeCompact}>+{memberCount}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/message"
      className={`${styles.card} ${isPinned ? styles.cardPinned : ''}`}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
    >
      <Image
        width={800}
        height={600}
        sizes="(max-width: 768px) 100vw, 368px"
        className={styles.bg}
        src={thumbSrc}
        alt=""
        draggable={false}
        onError={() => setThumbSrc(FALLBACK_THUMBNAIL)}
      />

      {/* Pinned Badge */}
      {isPinned && (
        <div className={styles.pinnedBadge} title="Pinned room">
          <Pin size={12} fill="currentColor" />
          <span>Pinned</span>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className={styles.feedbackToast}>
          <Check size={12} strokeWidth={2.6} />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Standard Kebab & Action Menu */}
      <div className={styles.kebabWrapper} ref={menuRef}>
        <button
          type="button"
          className={`${styles.kebabBtn} ${isMenuOpen ? styles.kebabActive : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          aria-label={`Options for ${session.title}`}
          aria-expanded={isMenuOpen}
        >
          <MoreVertical size={16} strokeWidth={2.4} />
        </button>

        {isMenuOpen && (
          <div
            className={styles.actionMenu}
            role="menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleCopyLink}
              role="menuitem"
            >
              <Copy size={14} strokeWidth={2.2} />
              <span>Copy room link</span>
            </button>

            <button
              type="button"
              className={styles.menuItem}
              onClick={handleTogglePin}
              role="menuitem"
            >
              <Pin size={14} strokeWidth={2.2} fill={isPinned ? 'currentColor' : 'none'} />
              <span>{isPinned ? 'Unpin room' : 'Pin room'}</span>
            </button>

            <button
              type="button"
              className={styles.menuItem}
              onClick={handleInviteFriends}
              role="menuitem"
            >
              <UserPlus size={14} strokeWidth={2.2} />
              <span>Invite friends</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.overlayBar}>
        <div className={styles.textStack}>
          <h3 className={styles.roomName}>{session.title}</h3>
          <p className={styles.subtext}>{session.status}</p>
        </div>
        <div className={styles.avatars}>
          {session.avatars.slice(0, 3).map((person) => (
            <span key={person.id} className={styles.avatarWrapper}>
              <Image
                width={27}
                height={27}
                sizes="27px"
                loading="lazy"
                src={person.avatar}
                alt=""
                draggable={false}
                className={styles.avatar}
              />
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
});
