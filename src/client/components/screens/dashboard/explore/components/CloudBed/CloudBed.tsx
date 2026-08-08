'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './CloudBed.module.css';

interface CloudItem {
  id: string;
  src: string;
  top: string;
  left: string;
  width: string;
  scale: number;
  rotation: number;
  opacity: number;
  speed: number;
  zIndex: number;
}

const CLOUD_VARIATIONS = [
  '/images/explore/cloud1.webp',
  '/images/explore/cloud2.webp',
  '/images/explore/cloud3.webp',
];

const CLOUD_CONFIGS: CloudItem[] = [
  {
    id: 'cloud-1',
    src: CLOUD_VARIATIONS[0],
    top: '-60px',
    left: '-6%',
    width: '380px',
    scale: 1.15,
    rotation: -4,
    opacity: 0.85,
    speed: -0.14,
    zIndex: 1,
  },
  {
    id: 'cloud-2',
    src: CLOUD_VARIATIONS[1],
    top: '-30px',
    left: '18%',
    width: '320px',
    scale: 0.95,
    rotation: 6,
    opacity: 0.75,
    speed: 0.22,
    zIndex: 2,
  },
  {
    id: 'cloud-3',
    src: CLOUD_VARIATIONS[2],
    top: '-80px',
    left: '42%',
    width: '420px',
    scale: 1.3,
    rotation: -2,
    opacity: 0.9,
    speed: -0.18,
    zIndex: 1,
  },
  {
    id: 'cloud-4',
    src: CLOUD_VARIATIONS[0],
    top: '-40px',
    left: '68%',
    width: '360px',
    scale: 1.1,
    rotation: 5,
    opacity: 0.8,
    speed: 0.16,
    zIndex: 2,
  },
  {
    id: 'cloud-5',
    src: CLOUD_VARIATIONS[1],
    top: '20px',
    left: '-2%',
    width: '440px',
    scale: 1.25,
    rotation: 3,
    opacity: 0.88,
    speed: 0.28,
    zIndex: 3,
  },
  {
    id: 'cloud-6',
    src: CLOUD_VARIATIONS[2],
    top: '40px',
    left: '30%',
    width: '350px',
    scale: 1.05,
    rotation: -5,
    opacity: 0.82,
    speed: -0.24,
    zIndex: 3,
  },
  {
    id: 'cloud-7',
    src: CLOUD_VARIATIONS[0],
    top: '10px',
    left: '60%',
    width: '400px',
    scale: 1.2,
    rotation: 2,
    opacity: 0.92,
    speed: 0.2,
    zIndex: 4,
  },
  {
    id: 'cloud-8',
    src: CLOUD_VARIATIONS[1],
    top: '-90px',
    left: '84%',
    width: '340px',
    scale: 1.0,
    rotation: -3,
    opacity: 0.7,
    speed: -0.12,
    zIndex: 1,
  },
];

export function CloudBed() {
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    let rafId = 0;
    let lastScrollY = -1;

    const updateParallax = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY !== lastScrollY) {
        lastScrollY = scrollY;
        CLOUD_CONFIGS.forEach((cloud, index) => {
          const node = cloudRefs.current[index];
          if (node) {
            const translateX = scrollY * cloud.speed;
            node.style.transform = `translate3d(${translateX}px, 0, 0) scale(${cloud.scale}) rotate(${cloud.rotation}deg)`;
          }
        });
      }
      rafId = requestAnimationFrame(updateParallax);
    };

    rafId = requestAnimationFrame(updateParallax);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className={styles.cloudBedContainer} aria-hidden="true">
      {CLOUD_CONFIGS.map((cloud, index) => (
        <div
          key={cloud.id}
          ref={(el) => {
            cloudRefs.current[index] = el;
          }}
          className={styles.cloudNode}
          style={{
            top: cloud.top,
            left: cloud.left,
            width: cloud.width,
            opacity: cloud.opacity,
            zIndex: cloud.zIndex,
            transform: `translate3d(0, 0, 0) scale(${cloud.scale}) rotate(${cloud.rotation}deg)`,
          }}
        >
          <Image
            src={cloud.src}
            alt=""
            width={600}
            height={360}
            className={styles.cloudImage}
            priority={index < 4}
          />
        </div>
      ))}
    </div>
  );
}
