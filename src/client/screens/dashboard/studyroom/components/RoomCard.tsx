'use client';

import React from 'react';
import { Users, ArrowRight } from 'lucide-react';
import styles from '../StudyRoomScreen.module.css';

export interface Participant {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
}

export interface Room {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  onlineCount: number;
  participants: Participant[];
}

export interface RoomCardProps {
  room: Room;
  isCurrent: boolean;
  isJoining: boolean;
  onJoin: (roomId: string) => void;
  onLeave: () => void;
  IconComponent: React.ElementType;
  gradientClass: string;
}

export const RoomCard = React.memo(function RoomCard({
  room,
  isCurrent,
  isJoining,
  onJoin,
  onLeave,
  IconComponent,
  gradientClass,
}: RoomCardProps) {
  return (
    <div 
      className={`${styles.roomCard} ${gradientClass} ${isCurrent ? styles.activeRoomCard : ''}`}
    >
      {isCurrent && <div className={styles.roomGlow} />}
      <div className={styles.roomHeader}>
        <div className={styles.roomIconWrapper}>
          <IconComponent className={styles.roomIcon} size={22} />
        </div>
        {isCurrent && (
          <span className={styles.currentBadge}>
            <span className={styles.pulseGreen}></span> YOU ARE HERE
          </span>
        )}
      </div>

      <div className={styles.roomMeta}>
        <h3>{room.title}</h3>
        <p className={styles.roomStatus}>
          {room.title === 'Fireplace' ? 'Warm and cozy chats' : 
           room.title === 'Library' ? 'Silent study & focus' : 
           'Co-working & code reviews'}
        </p>
      </div>

      {/* Participant Avatars */}
      <div className={styles.participantsSection}>
        <span className={styles.participantsLabel}>
          <Users size={14} /> {room.participants.length} Active
        </span>
        <div className={styles.avatarStack}>
          {room.participants.length > 0 ? (
            room.participants.map((p) => {
              const name = p.user.name || p.user.username || 'Explorer';
              const image = p.user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;
              return (
                <div key={p.id} className={styles.avatarWrapper} title={name}>
                  <img src={image} alt={name} className={styles.avatar} />
                </div>
              );
            })
          ) : (
            <span className={styles.emptyRoomsMsg}>No peers currently inside</span>
          )}
        </div>
      </div>

      {/* Join / Leave Card Button */}
      <div className={styles.cardActions}>
        {isCurrent ? (
          <button 
            onClick={onLeave} 
            className={`${styles.actionBtn} ${styles.leaveBtn}`}
          >
            Leave Room
          </button>
        ) : (
          <button 
            onClick={() => onJoin(room.id)} 
            disabled={isJoining}
            className={`${styles.actionBtn} ${styles.joinBtn}`}
          >
            {isJoining ? 'Connecting...' : 'Join Space'}
            <ArrowRight size={15} style={{ marginLeft: 8 }} />
          </button>
        )}
      </div>
    </div>
  );
});

export default RoomCard;
