'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { BuildingArt } from './BuildingArt';
import { ProcessingSteps } from './ProcessingSteps';
import styles from './ReadyWorkspace.module.css';

export function BuildingProgress({ snapshot, disabled, onStart, onCancel, onBack }: {
  snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const operation = snapshot.processing?.building; const checkpoint = operation?.checkpoint; const running = snapshot.status === 'running';
  const start = async (action = onStart) => {
    if (disabled || saving.current || running) return;
    saving.current = true; setPending(true);
    try { await action(); } finally { saving.current = false; setPending(false); }
  };
  return <div className={styles.workspace}><ProcessingSteps current={3} /><div className={styles.layout}><div className={styles.content}>
    <header className={`${styles.heading} ${styles.buildingHeading}`}><p className={styles.eyebrow}>Building your learning experience</p>
      <h1>{operation?.complete ? 'Your lessons are saved.' : 'Bringing it all together…'}</h1>
      <p>Your accepted analysis and source evidence become meaningful lessons.</p>
    </header>
    <section aria-label="Building material" className={styles.buildControls}>
    <h2>Building</h2>
    <p>Accepted analysis, chunks and source material remain saved.</p>
    {checkpoint && <progress max={checkpoint.total} value={checkpoint.completed.length} aria-label="Content partitions built" />}
    {running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions built; ${checkpoint.completed.reduce((sum, item) => sum + item.lessonCount, 0)} lessons saved.`
        : 'Validating retained analysis; partition total is not known yet.'}</p>
      <p>You can close this page and return while work continues.</p>
      <button onClick={onCancel}>Cancel building</button>
    </div> : <>
      <p role="status">{operation?.complete ? 'Building complete. Curriculum lessons are saved.'
        : `Building ${snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted lesson receipts remain saved.`}</p>
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      <p>A fresh build request reuses accepted analysis and starts building again. Automatic worker retries reuse accepted building.</p>
      <button disabled={disabled || pending} onClick={() => void start()}>Start fresh building</button>
      <button disabled={disabled || pending} onClick={() => void onBack()}>Back to material</button>
    </>}
  </section></div><BuildingArt /></div></div>;
}
