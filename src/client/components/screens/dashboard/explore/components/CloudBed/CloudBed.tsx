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
  // Top Row
  {
    id: 'cloud-1',
    src: CLOUD_VARIATIONS[0],
    top: '30px',
    left: '-8%',
    width: '420px',
    scale: 1.27,
    rotation: 0,
    opacity: 1,
    speed: -0.14,
    zIndex: 1,
  },
  {
    id: 'cloud-2',
    src: CLOUD_VARIATIONS[1],
    top: '60px',
    left: '15%',
    width: '360px',
    scale: 1.05,
    rotation: 0,
    opacity: 1,
    speed: 0.22,
    zIndex: 2,
  },
  {
    id: 'cloud-3',
    src: CLOUD_VARIATIONS[2],
    top: '20px',
    left: '38%',
    width: '460px',
    scale: 1.43,
    rotation: 0,
    opacity: 1,
    speed: -0.18,
    zIndex: 1,
  },
  {
    id: 'cloud-4',
    src: CLOUD_VARIATIONS[0],
    top: '50px',
    left: '62%',
    width: '400px',
    scale: 1.21,
    rotation: 0,
    opacity: 1,
    speed: 0.16,
    zIndex: 2,
  },
  {
    id: 'cloud-5',
    src: CLOUD_VARIATIONS[1],
    top: '25px',
    left: '85%',
    width: '440px',
    scale: 1.25,
    rotation: 0,
    opacity: 1,
    speed: -0.2,
    zIndex: 1,
  },
  {
    id: 'cloud-6',
    src: CLOUD_VARIATIONS[2],
    top: '40px',
    left: '100%',
    width: '420px',
    scale: 1.2,
    rotation: 0,
    opacity: 1,
    speed: 0.15,
    zIndex: 2,
  },
  // Middle Row
  {
    id: 'cloud-7',
    src: CLOUD_VARIATIONS[0],
    top: '110px',
    left: '-3%',
    width: '480px',
    scale: 1.38,
    rotation: 0,
    opacity: 1,
    speed: 0.25,
    zIndex: 3,
  },
  {
    id: 'cloud-8',
    src: CLOUD_VARIATIONS[1],
    top: '90px',
    left: '22%',
    width: '440px',
    scale: 1.21,
    rotation: 0,
    opacity: 1,
    speed: -0.2,
    zIndex: 2,
  },
  {
    id: 'cloud-9',
    src: CLOUD_VARIATIONS[2],
    top: '120px',
    left: '48%',
    width: '400px',
    scale: 1.32,
    rotation: 0,
    opacity: 1,
    speed: 0.18,
    zIndex: 3,
  },
  {
    id: 'cloud-10',
    src: CLOUD_VARIATIONS[0],
    top: '95px',
    left: '72%',
    width: '460px',
    scale: 1.16,
    rotation: 0,
    opacity: 1,
    speed: -0.22,
    zIndex: 2,
  },
  {
    id: 'cloud-11',
    src: CLOUD_VARIATIONS[1],
    top: '105px',
    left: '94%',
    width: '450px',
    scale: 1.28,
    rotation: 0,
    opacity: 1,
    speed: 0.19,
    zIndex: 3,
  },
  // Bottom Row
  {
    id: 'cloud-12',
    src: CLOUD_VARIATIONS[2],
    top: '150px',
    left: '10%',
    width: '420px',
    scale: 1.16,
    rotation: 0,
    opacity: 1,
    speed: -0.24,
    zIndex: 4,
  },
  {
    id: 'cloud-13',
    src: CLOUD_VARIATIONS[0],
    top: '170px',
    left: '35%',
    width: '440px',
    scale: 1.27,
    rotation: 0,
    opacity: 1,
    speed: 0.2,
    zIndex: 4,
  },
  {
    id: 'cloud-14',
    src: CLOUD_VARIATIONS[1],
    top: '160px',
    left: '65%',
    width: '420px',
    scale: 1.32,
    rotation: 0,
    opacity: 1,
    speed: -0.16,
    zIndex: 4,
  },
];

export function CloudBed() {
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    let ticking = false;
    let scrollY = window.scrollY || window.pageYOffset;
    let arcScrollLeft = 0;

    const updateParallax = () => {
      const combinedScroll = scrollY + (arcScrollLeft * 0.3);
      CLOUD_CONFIGS.forEach((cloud, index) => {
        const node = cloudRefs.current[index];
        if (node) {
          const translateX = combinedScroll * cloud.speed;
          node.style.transform = `translate3d(${translateX}px, 0, 0) scale(${cloud.scale})`;
        }
      });
      ticking = false;
    };

    const requestUpdate = () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    const handleScroll = () => {
      scrollY = window.scrollY || window.pageYOffset;
      requestUpdate();
    };

    const handleArcScroll = (e: Event) => {
      arcScrollLeft = (e as CustomEvent).detail.scrollLeft;
      requestUpdate();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('arc-scroll', handleArcScroll);

    // Initial positioning
    requestUpdate();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('arc-scroll', handleArcScroll);
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
            style={{ animationDelay: `${-(index * 2.3)}s` }}
            priority={index < 4}
          />
        </div>
      ))}
    </div>
  );
}
