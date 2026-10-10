import Image from 'next/image';
import { FileText, Play } from 'lucide-react';
import type { StartingPoint } from '@/src/shared/cohort-creation/contracts';
import styles from './StartingPoint.module.css';

/** Decorative collage only: these images never represent a user's retained sources. */
export function StartingPointArt({ kind }: { kind: StartingPoint }) {
  return <span className={styles.art} data-kind={kind} aria-hidden="true">
    {kind === 'have_material' ? <>
      <span className={styles.bluePaper} />
      <span className={styles.codePaper}><i /><i /><i /><i /><i /><i /></span>
      <span className={styles.videoPaper}><span /><Play size={22} fill="currentColor" /></span>
      <span className={styles.pdfPaper}><FileText size={33} strokeWidth={1.2} /><b>PDF</b><i /><i /><i /><i /></span>
      <span className={styles.smallPhoto}><Image src="/images/hero-collage/real-mountains.jpg" alt="" fill sizes="160px" /></span>
      <span className={styles.note}>Turn what<br />you have into<br />a structured<br />learning journey.</span>
    </> : kind === 'find_material' ? <>
      <span className={styles.paintPaper} />
      <span className={styles.galaxyPhoto}><Image src="/images/hero-collage/real-galaxy.jpg" alt="" fill sizes="160px" /></span>
      <span className={styles.mountainPhoto}><Image src="/images/hero-collage/real-mountains.jpg" alt="" fill sizes="150px" /></span>
      <span className={styles.cathedralPhoto}><Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="180px" /></span>
      <span className={styles.note}>I’ll find the best<br />resources for you.</span>
    </> : <>
      <span className={styles.goalPhoto}><Image src="/images/hero-collage/real-mountains.jpg" alt="" fill sizes="350px" /></span>
      <span className={styles.moon} />
      <span className={styles.note}>Just a goal<br />is enough.<br />We’ll figure<br />out the rest.</span>
    </>}
    <Image className={styles.star} src="/images/hero-collage/star-doodle.svg" alt="" width={34} height={34} />
  </span>;
}
