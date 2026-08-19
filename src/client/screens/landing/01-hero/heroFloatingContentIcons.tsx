'use client';

import Image from 'next/image';
import styles from './heroFloatingContentIcons.module.css';

const source = {
  x: 54,
  y: 83,
};
const icons = {
  logo: {
    src: '/logos/floating-logo.svg',
    x: 53,
    y: 79.5,
    rotate: 0,
  },
  youtube: {
    src: '/images/icons/128/Youtube.webp',
    x: 9,
    y: 16,
    rotate: -10,
  },
  bookmark: {
    src: '/images/icons/128/Bookmark.webp',
    x: 16,
    y: 29,
    rotate: 8,
  },
  headphone: {
    src: '/images/icons/128/Headphone.webp',
    x: 8,
    y: 44,
    rotate: -8,
  },
  article: {
    src: '/images/icons/128/Article.webp',
    x: 27,
    y: 34,
    rotate: -6,
  },
  book: {
    src: '/images/icons/128/Book.webp',
    x: 20,
    y: 18,
    rotate: 6,
  },
  ai: {
    src: '/images/icons/128/Ai.webp',
    x: 30,
    y: 58,
    rotate: 2,
  },
};

const streams = [
  ['source', 'ai', 'article', 'bookmark', 'youtube'],

  ['ai', 'headphone'],

  ['article', 'book'],
] as const;
type IconId = keyof typeof icons;

type PointId = keyof typeof icons | 'source';

function svgPoint(id: PointId) {
  if (id === 'source') {
    return {
      x: (source.x / 100) * 1600,
      y: (source.y / 100) * 900,
    };
  }

  const p = icons[id];

  return {
    x: (p.x / 100) * 1600 + 29,
    y: (p.y / 100) * 900 + 29,
  };
}

function buildPath(stream: readonly PointId[]) {
  const pts = stream.map(svgPoint);

  if (pts.length < 2) return '';

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];

    const dx = curr.x - prev.x;

    d += `
            C
            ${prev.x + dx * 0.35} ${prev.y}
            ${curr.x - dx * 0.35} ${curr.y}
            ${curr.x} ${curr.y}
        `;
  }

  return d;
}

function Ribbon({ stream }: { stream: readonly PointId[] }) {
  const d = buildPath(stream);

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="url(#trail)"
        strokeWidth={16}
        opacity={0.18}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        filter="url(#glow)"
      />

      <path
        d={d}
        fill="none"
        stroke="url(#trail)"
        strokeWidth={8}
        opacity={0.45}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        filter="url(#glow)"
      />

      <path
        d={d}
        fill="none"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

export function HeroFloatingContentIcons() {
  return (
    <div className={styles.container}>
      <svg
        className={styles.ribbon}
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="trail"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#F7D8FF"
            />
            <stop
              offset="25%"
              stopColor="#E8C4FF"
            />
            <stop
              offset="55%"
              stopColor="#C58CFF"
            />
            <stop
              offset="100%"
              stopColor="#7B4DFF"
            />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur
              stdDeviation="7"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {streams.map((stream, i) => (
          <Ribbon
            key={i}
            stream={stream}
          />
        ))}
      </svg>

      {Object.entries(icons).map(([id, icon]) => (
        <div
          key={id}
          className={`${styles.icon} ${id === 'logo' ? styles.logo : ''}`}
          style={{
            left: `${icon.x}%`,
            top: `${icon.y}%`,
            rotate: `${icon.rotate}deg`,
          }}
        >
          <Image
            src={icon.src}
            alt=""
            fill
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
