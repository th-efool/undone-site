'use client';
import Image from 'next/image';
import { ArrowRight, LockKeyhole, UserRound } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { ReviewFields } from '../hooks/useReviewWorkspace';
import styles from './ReviewWorkspace.module.css';

/** Illustration is decorative. Metadata and visibility are application-owned. */
export function CohortPreviewHero({ snapshot, fields, committed = false }: { snapshot: CreationSnapshot; fields: ReviewFields; committed?: boolean }) {
  return <div className={styles.hero}><Image className={styles.heroArt} src="/images/hero-collage/real-galaxy.jpg" alt="" fill sizes="(max-width:820px) 100vw, 75vw" priority />
    <span className={styles.illustration}>{committed ? 'Decorative illustration' : 'Draft illustration'}</span>
    <div className={styles.heroCopy}><div className={styles.tags}><span>{snapshot.result?.intent.topic.value ?? 'Your learning journey'}</span></div>
      <h1>{fields.title}</h1><p>{fields.description}</p>
      <div className={styles.creator}><span><UserRound size={24} aria-hidden="true" /></span><div><strong>Created by you</strong><p>Based on {snapshot.materials.length} retained {snapshot.materials.length === 1 ? 'source' : 'sources'}</p></div></div>
    </div><div className={styles.join}>{committed ? null : <><button disabled>Join Cohort <ArrowRight size={22} aria-hidden="true" /></button><p>Preview only · available after activation</p></>}
      <span><LockKeyhole size={17} aria-hidden="true" />{committed ? fields.visibility === 'PUBLIC' ? 'Public cohort' : 'Private cohort' : fields.visibility === 'PUBLIC' ? 'Public draft preference' : 'Private draft'}</span></div>
  </div>;
}
