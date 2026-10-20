'use client';

import React, { useState } from 'react';
import styles from './ParticipantAvatar.module.css';

export interface ParticipantAvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

function getHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'G';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'G';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ParticipantAvatar({
  name,
  src,
  size = 32,
  className,
}: ParticipantAvatarProps) {
  const [failed, setFailed] = useState<boolean>(false);

  const hue = getHue(name);
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.floor(size * 0.4));

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
  };

  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`${styles.avatarWrapper} ${className ?? ''}`}
      style={wrapperStyle}
    >
      {showImage ? (
        /* Plain <img> is intentionally used for arbitrary user/peer avatar URLs */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src!}
          alt=""
          referrerPolicy="no-referrer"
          className={styles.avatarImg}
          onError={() => setFailed(true)}
          width={size}
          height={size}
        />
      ) : (
        <div
          className={styles.initialsFallback}
          style={{
            backgroundColor: `hsl(${hue} 45% 38%)`,
            fontSize,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
    </div>
  );
}

export default React.memo(ParticipantAvatar);
