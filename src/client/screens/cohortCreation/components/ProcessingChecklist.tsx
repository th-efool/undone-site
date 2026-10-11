import { Check, Circle, CircleDot, CircleX, Pause } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import styles from './ProcessingChecklist.module.css';

/** Labels describe saved application work; they never infer progress from elapsed time. */
export function ProcessingChecklist({ snapshot }: { snapshot: CreationSnapshot }) {
  const processing = snapshot.processing;
  if (!processing) return null;
  const stages = [
    { phase: 'understanding', label: 'Reading material and finding key concepts', work: processing },
    { phase: 'chunking', label: 'Chunking it into meaningful pieces', work: processing.chunking },
    { phase: 'analysis', label: 'Analyzing each piece', work: processing.analysis },
    { phase: 'building', label: 'Building your learning experience', work: processing.building },
  ];
  const currentInput = processing.inputRevision === snapshot.inputRevision;
  return <ol className={styles.list} aria-label="Saved processing stages">
    {stages.map(stage => {
      const complete = currentInput && stage.work?.complete && stage.work.checkpoint?.inputRevision === snapshot.inputRevision;
      const current = currentInput && processing.phase === stage.phase && !complete;
      const status = complete ? 'complete' : current ? snapshot.status === 'failed' ? 'failed' : snapshot.status === 'canceled' ? 'canceled' : 'current' : 'pending';
      const Icon = status === 'complete' ? Check : status === 'failed' ? CircleX : status === 'canceled' ? Pause : status === 'current' ? CircleDot : Circle;
      const description = status === 'complete' ? 'Complete' : status === 'failed' ? 'Failed' : status === 'canceled' ? 'Canceled' : status === 'current' ? snapshot.status === 'running' ? 'In progress' : 'Ready to start' : 'Pending';
      return <li key={stage.phase} data-state={status} aria-current={current ? 'step' : undefined}>
        <span className={styles.marker}><Icon size={18} aria-hidden="true" /></span>
        <span>{stage.label}<span className={styles.srOnly}>: {description}</span></span>
      </li>;
    })}
  </ol>;
}
