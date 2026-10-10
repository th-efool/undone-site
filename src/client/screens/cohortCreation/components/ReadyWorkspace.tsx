'use client';
import { useRef, useState } from 'react';
import { ArrowRight, Brain, CheckCircle2, FileText, Infinity as InfinityIcon, MessageSquare, Network, ShieldCheck, Sparkles } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { BuildingArt } from './BuildingArt';
import { ProcessingSteps } from './ProcessingSteps';
import styles from './ReadyWorkspace.module.css';

export function ReadyWorkspace({ snapshot, disabled, onActivate, onReview, onBack }: {
  snapshot: CreationSnapshot; disabled: boolean; onActivate: () => Promise<boolean>; onReview: () => Promise<boolean>; onBack: () => Promise<boolean>;
}) {
  const lock = useRef(false); const [pending, setPending] = useState(false);
  const ready = snapshot.processing?.building?.complete === true;
  const lessons = snapshot.processing?.building?.checkpoint?.completed.reduce((sum, item) => sum + item.lessonCount, 0) ?? 0;
  const chunks = snapshot.processing?.chunking?.checkpoint?.completed.reduce((sum, item) => sum + item.chunkCount, 0) ?? 0;
  const act = async (action: () => Promise<boolean>) => {
    if (disabled || !ready || lock.current) return;
    lock.current = true; setPending(true);
    try { await action(); } finally { lock.current = false; setPending(false); }
  };
  return <section className={styles.workspace} aria-label="Curriculum ready">
    <ProcessingSteps current={3} />
    <div className={styles.layout}><div className={styles.content}>
      <header className={styles.heading}><p className={styles.eyebrow}>Your learning experience is ready</p>
        <h1>All set.<span className={styles.rays} aria-hidden="true"><i /><i /><i /></span></h1>
        <p>I’ve turned your material into a learning experience. Review your cohort, or activate it privately to start learning in your feed.</p>
      </header>
      <div className={styles.material}><span className={styles.sourceIcon}><FileText size={46} strokeWidth={1.2} aria-hidden="true" /></span>
        <div><h2>{snapshot.result?.intent.topic.value ?? 'Your learning material'}</h2>
          <p>{snapshot.materials.length} {snapshot.materials.length === 1 ? 'source' : 'sources'} · {chunks} learning pieces · {lessons} {lessons === 1 ? 'lesson' : 'lessons'}</p>
          <span className={styles.processed}><CheckCircle2 size={18} aria-hidden="true" />{ready ? 'Processed' : 'Build not complete'}</span>
        </div>
        <details className={styles.sources}><summary>View retained sources</summary><ul>{snapshot.materials.map((material, index) => <li key={material.id}>{material.input.kind === 'url' ? material.input.url : material.input.kind === 'goal' ? 'AI-authored guide from your goal' : `Source ${index + 1} · ${material.kind === 'pdf' ? 'PDF' : 'Text / Markdown'}`}</li>)}</ul></details>
      </div>
      <h2 className={styles.sectionLabel}>What happens now</h2>
      <div className={styles.features}>
        {[{ Icon: MessageSquare, title: 'Learning pieces', text: 'Lessons bring your retained material into your learning feed.' },
          { Icon: Network, title: 'Source evidence', text: 'Original material stays connected to the lessons built from it.' },
          { Icon: Brain, title: 'Learning objectives', text: 'Review the goals and titles for each generated lesson.' },
          { Icon: ShieldCheck, title: 'Private by default', text: 'Go to your feed privately. Public publishing is a separate choice.' }].map(({ Icon, title, text }, index) =>
          <article key={title} className={styles.feature} data-tone={index}><span><Icon size={27} strokeWidth={1.5} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
      <div className={styles.notes}><div><Sparkles size={27} strokeWidth={1.5} aria-hidden="true" /><p><strong>Your material</strong><span>Grounded in the sources you selected.</span></p></div>
        <div><InfinityIcon size={29} strokeWidth={1.5} aria-hidden="true" /><p><strong>Your own pace</strong><span>No fixed schedule to follow.</span></p></div>
        <div><CheckCircle2 size={26} strokeWidth={1.5} aria-hidden="true" /><p><strong>Review first, if you like</strong><span>Make changes before activating.</span></p></div></div>
      <div className={styles.actions}>
        <button className={styles.primary} disabled={disabled || pending || !ready} onClick={() => void act(onActivate)}>{pending ? 'Opening your learning experience…' : 'Go to my feed'}<ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></button>
        <div><button disabled={disabled || pending || !ready} onClick={() => void act(onReview)}>Review cohort</button><button disabled={disabled || pending} onClick={() => void act(onBack)}>Back to material</button></div>
        <p>Private activation saves this cohort before opening your feed.</p>
      </div>
    </div><BuildingArt /></div>
  </section>;
}
