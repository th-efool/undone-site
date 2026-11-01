'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  FileText,
  Layers,
  Lock,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  CohortAction,
  CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { deriveReadyStageViewModel } from '@/src/shared/cohort-builder/creation-view';
import type { EntityRef } from 'interaction-builder/core';
import styles from './ReadyStageView.module.css';

export interface ReadyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (
    action: CohortAction,
    expectedEntities?: EntityRef[]
  ) => Promise<boolean>;
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Learning pieces',
    text: 'Your material has been organized into clear learning units.',
  },
  {
    icon: BookOpen,
    title: 'Source evidence',
    text: 'Relevant passages and references stay attached to each concept.',
  },
  {
    icon: Target,
    title: 'Learning objectives',
    text: 'Each lesson includes a concrete takeaway to focus your study.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    text: 'This cohort is set up for your personal feed until you choose to publish.',
  },
] as const;

const NOTES = [
  {
    icon: FileText,
    title: 'Your material',
    text: 'Everything comes directly from the sources you attached.',
  },
  {
    icon: Clock,
    title: 'Your own pace',
    text: 'Move through lessons whenever you have a focused window.',
  },
  {
    icon: Sparkles,
    title: 'Review first, if you like',
    text: 'Inspect lessons, adjust titles, or pin key objectives before publishing.',
  },
] as const;

export function ReadyStageView({
  workspace,
  dispatchAction,
}: ReadyStageViewProps) {
  const [busy, setBusy] = useState(false);
  const viewModel = deriveReadyStageViewModel(workspace);

  const act = async (
    work: () => Promise<unknown>,
    requiresReady = true
  ) => {
    if (busy || (requiresReady && !viewModel.isReady)) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = () =>
    act(async () => {
      const prepared = await dispatchAction({
        type: 'prepare_release',
        mode: 'private_activation',
      });
      if (!prepared) return;
      await dispatchAction({ type: 'open_review' });
    });

  const handleReview = () =>
    act(() => dispatchAction({ type: 'open_review' }));

  const handleBack = async () => {
    await dispatchAction({ type: 'open_materials' });
  };

  return (
    <section className={styles.stage} aria-label="Curriculum ready">
      <div className={styles.rays} aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={styles.ray} />
        ))}
      </div>

      <header className={styles.header}>
        <div className={styles.checkBadge} aria-hidden="true">
          <Check size={28} />
        </div>
        <span className={styles.eyebrow}>{viewModel.eyebrow}</span>
        <h1 className={styles.title}>
          <em>{viewModel.heading}</em>
        </h1>
        <p className={styles.subtitle}>{viewModel.subtitle}</p>
      </header>

      <article className={styles.materialCard} aria-label="Material summary">
        <div className={styles.materialIcon} aria-hidden="true">
          <FileText size={20} />
        </div>
        <div className={styles.materialBody}>
          <h2>{workspace.title || workspace.intent}</h2>
          <p>
            {viewModel.sourceCount}{' '}
            {viewModel.sourceCount === 1 ? 'source' : 'sources'} ·{' '}
            {viewModel.chunkCount}{' '}
            {viewModel.chunkCount === 1 ? 'learning piece' : 'learning pieces'} ·{' '}
            {viewModel.lessonCount}{' '}
            {viewModel.lessonCount === 1 ? 'lesson' : 'lessons'}
          </p>
        </div>
        <span className={styles.processedBadge}>
          <Check size={13} aria-hidden="true" />
          {viewModel.badgeLabel}
        </span>
      </article>

      <section
        className={styles.section}
        aria-labelledby="ready-included-heading"
      >
        <span id="ready-included-heading" className={styles.sectionLabel}>
          What's included
        </span>
        <div className={styles.featureGrid}>
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={styles.featureCard}>
                <div className={styles.featureIcon} aria-hidden="true">
                  <Icon size={18} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.notesRow} aria-label="Experience notes">
        {NOTES.map(note => {
          const Icon = note.icon;
          return (
            <div key={note.title} className={styles.noteItem}>
              <Icon size={16} aria-hidden="true" />
              <div>
                <strong>{note.title}</strong>
                <span>{note.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <footer className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!viewModel.canActivate || busy}
          onClick={handleActivate}
        >
          Review and activate
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <div className={styles.secondaryActions}>
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={!viewModel.canReview || busy}
            onClick={handleReview}
          >
            Review cohort
          </button>
          <button
            type="button"
            className={styles.ghostAction}
            disabled={!viewModel.canReturnToMaterial || busy}
            onClick={() => act(handleBack, false)}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to material
          </button>
        </div>
      </footer>
    </section>
  );
}
