import Image from 'next/image';
import { Play } from 'lucide-react';
import styles from './ReadyWorkspace.module.css';

/** Decorative homepage collage, never a preview of generated source content. */
export function BuildingArt() {
  return <div className={styles.art} aria-hidden="true">
    <p className={styles.annotation}>Your material becomes<br />part of your learning<br />experience, ready<br />when you are.</p>
    <svg className={styles.orbit} viewBox="0 0 400 800" fill="none"><path d="M170 75C-70 130 390 250 330 380S70 390 100 530S460 660 40 780" stroke="currentColor" strokeWidth=".7" /><path d="m36 774 16 7-16 8M324 370l6 15 10-13" stroke="currentColor" strokeWidth="1" /></svg>
    <span className={`${styles.tile} ${styles.galaxy}`}><Image src="/images/hero-collage/real-galaxy.jpg" alt="" fill sizes="230px" /><Play size={23} fill="currentColor" /></span>
    <span className={`${styles.tile} ${styles.diagram}`}><Image src="/images/hero-collage/real-botanical.svg" alt="" fill sizes="170px" /></span>
    <span className={`${styles.tile} ${styles.code}`}><i /><i /><i /><i /><i /><i /></span>
    <span className={`${styles.tile} ${styles.landscape}`}><Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="190px" /><Play size={22} fill="currentColor" /></span>
    <span className={`${styles.tile} ${styles.paper}`}><Image src="/images/hero-collage/real-map.jpg" alt="" fill sizes="160px" /></span>
    <span className={`${styles.tile} ${styles.bottom}`}><Image src="/images/hero-collage/real-galaxy.jpg" alt="" fill sizes="180px" /></span>
    <span className={styles.confetti}><i /><i /><i /><i /><i /><i /></span>
  </div>;
}
