'use client';

import { useRef, useState } from 'react';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  FileText,
  InfinityIcon,
  MessageSquare,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { BuildingArt } from '@/src/client/screens/cohortCreation/components/BuildingArt';
import styles from '@/src/client/screens/cohortCreation/components/ReadyWorkspace.module.css';

export interface ReadyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
  disabled?: boolean;
}

export function ReadyStageView({
  workspace,
  dispatchAction,
  disabled = false,
}: ReadyStageViewProps) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);

  const ready =
    workspace.processing.status === 'ready' &&
    workspace.lessons.length > 0;
  const lessonCount = workspace.lessons.length;
  const chunkCount = workspace.chunks?.length ?? 0;
  const sources = workspace.sources ?? [];

  const act = async (action: () => Promise<boolean | void>) => {
    if (disabled || !ready || lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await action();
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  const handleReview = async () => {
    await dispatchAction({ type: 'open_review' });
  };

  const handleActivate = async () => {
    // Prepare private activation
    await dispatchAction({ type: 'prepare_release', mode: 'private_activation' });
    await dispatchAction({ type: 'open_review' });
  };

  const handleBack = async () => {
    await dispatchAction({ type: 'back_to_starting_point' });
  };

  return (
    <section className={styles.workspace} aria-label="Curriculum ready">
      <div className={styles.layout}>
        <div className={styles.content}>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Your learning experience is ready</p>
            <h1>
              All set.
              <span className={styles.rays} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </h1>
            <p>
              I’ve turned your material into a learning experience. Review your cohort, or activate it privately to start learning in your feed.
            </p>
          </header>

          <div className={styles.material}>
            <span className={styles.sourceIcon}>
              <FileText size={46} strokeWidth={1.2} aria-hidden="true" />
            </span>
            <div>
              <h2>{workspace.intent || workspace.title || 'Your learning material'}</h2>
              <p>
                {sources.length} {sources.length === 1 ? 'source' : 'sources'} · {chunkCount} learning pieces · {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
              </p>
              <span className={styles.processed}>
                <CheckCircle2 size={18} aria-hidden="true" />
                {ready ? 'Processed' : 'Build not complete'}
              </span>
            </div>
            <details className={styles.sources}>
              <summary>View retained sources</summary>
              <ul>
                {sources.map((source, index) => (
                  <li key={source.id}>
                    {source.input?.kind === 'web'
                      ? source.input.url
                      : source.input?.kind === 'youtube'
                      ? source.input.url
                      : source.input?.kind === 'generated_guide'
                      ? 'AI-authored guide from your goal'
                      : source.label || `Source ${index + 1}`}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <h2 className={styles.sectionLabel}>What happens now</h2>
          <div className={styles.features}>
            {[
              {
                Icon: MessageSquare,
                title: 'Learning pieces',
                text: 'Lessons bring your retained material into your learning feed.',
              },
              {
                Icon: Network,
                title: 'Source evidence',
                text: 'Original material stays connected to the lessons built from it.',
              },
              {
                Icon: Brain,
                title: 'Learning objectives',
                text: 'Review the goals and titles for each generated lesson.',
              },
              {
                Icon: ShieldCheck,
                title: 'Private by default',
                text: 'Go to your feed privately. Public publishing is a separate choice.',
              },
            ].map(({ Icon, title, text }, index) => (
              <article key={title} className={styles.feature} data-tone={index}>
                <span>
                  <Icon size={27} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.notes}>
            <div>
              <Sparkles size={27} strokeWidth={1.5} aria-hidden="true" />
              <p>
                <strong>Your material</strong>
                <span>Grounded in the sources you selected.</span>
              </p>
            </div>
            <div>
              <InfinityIcon size={29} strokeWidth={1.5} aria-hidden="true" />
              <p>
                <strong>Your own pace</strong>
                <span>No fixed schedule to follow.</span>
              </p>
            </div>
            <div>
              <CheckCircle2 size={26} strokeWidth={1.5} aria-hidden="true" />
              <p>
                <strong>Review first, if you like</strong>
                <span>Make changes before activating.</span>
              </p>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={disabled || pending || !ready}
              onClick={() => void act(handleActivate)}
            >
              {pending ? 'Opening your learning experience…' : 'Go to my feed'}
              <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <div>
              <button
                disabled={disabled || pending || !ready}
                onClick={() => void act(handleReview)}
              >
                Review cohort
              </button>
              <button
                disabled={disabled || pending}
                onClick={() => void act(handleBack)}
              >
                Back to material
              </button>
            </div>
            <p>Private activation saves this cohort before opening your feed.</p>
          </div>
        </div>
        <BuildingArt />
      </div>
    </section>
  );
}
