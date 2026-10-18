'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MoreVertical, Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { ActiveCohort } from '../../models';
import styles from './SubscribedCohortCard.module.css';

export interface SubscribedCohortCardProps { cohort: ActiveCohort; onPause(): void; onResume(): void; }
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80';

export const SubscribedCohortCard = React.memo(function SubscribedCohortCard({ cohort, onPause, onResume }: SubscribedCohortCardProps) {
  const router = useRouter(); const [menuOpen, setMenuOpen] = useState(false); const [imgError, setImgError] = useState(false);
  const paused = Boolean(cohort.pausedUntil && new Date(cohort.pausedUntil) > new Date()); const progress = Math.max(0, Math.min(100, cohort.progressPercent || 0));
  const navigate = () => router.push(getCohortHref(cohort.cohortId || cohort.id));
  return <article className={styles.card} onClick={navigate} role="link" tabIndex={0} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); navigate(); } }} aria-label={`Open ${cohort.title}`}>
    <div className={styles.imageWrapper}><Image src={imgError || !cohort.thumbnail ? FALLBACK_COVER : cohort.thumbnail} alt={cohort.title} fill sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1200px) 50vw, 260px" className={styles.image} onError={() => setImgError(true)} /><div className={styles.overlayGradient} /></div>
    <div className={styles.cardActions}>{paused && <span className={styles.pausedBadge}><Pause size={11} fill="currentColor" /> Paused</span>}<div className={styles.menuWrap}><button type="button" className={styles.kebabBtn} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }} aria-label={`Cohort actions for ${cohort.title}`} aria-expanded={menuOpen}><MoreVertical size={16} /></button>{menuOpen && <div className={styles.menu} role="menu" onClick={(event) => event.stopPropagation()}>{paused ? <button type="button" role="menuitem" onClick={() => { onResume(); setMenuOpen(false); }}><Play size={14} /> Resume</button> : <button type="button" role="menuitem" onClick={() => { onPause(); setMenuOpen(false); }}><Pause size={14} /> Pause</button>}</div>}</div></div>
    <div className={styles.bottomContent}><h3 className={styles.title} title={cohort.title}>{cohort.title}</h3><div className={styles.metaRow}><span className={styles.memberCountText}>{cohort.provider}</span><div className={styles.progressGroup}><div className={styles.progressBarTrack} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className={styles.progressBarFill} style={{ width: `${progress}%` }} /></div><span className={styles.progressText}>{progress}%</span></div></div></div>
  </article>;
});
