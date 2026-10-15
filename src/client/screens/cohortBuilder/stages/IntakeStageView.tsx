'use client';

import React from 'react';
import { Edit3, Clock, Users } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from '../CohortBuilder.module.css';
import { BuilderDialog } from '../BuilderDialog';
import { ExternalSources } from '../ExternalSources';
import { useCohortDrafts } from '../draft-context';

interface IntakeStageViewProps {
  workspace: CohortWorkspace;
  needsRebuild?: boolean;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function IntakeStageView({ workspace, needsRebuild = false, dispatchAction }: IntakeStageViewProps) {
  const {
    sourceDraft,
    updateSourceDraft,
    clearSourceDraftIfUnchanged,
    overviewDraft,
    openOverview,
    updateOverviewDraft,
    closeOverview,
    closeOverviewIfUnchanged,
  } = useCohortDrafts();

  const handleOpenOverview = () => {
    openOverview(workspace, 'intake');
  };

  const handleSaveOverview = async () => {
    if (
      overviewDraft.baseIntent !== workspace.intent ||
      overviewDraft.baseAudience !== workspace.audience ||
      overviewDraft.baseDailyMinutes !== workspace.dailyMinutes
    ) {
      return;
    }
    const submittedIntent = overviewDraft.intent;
    const submittedAudience = overviewDraft.audience;
    const submittedDailyMinutes = overviewDraft.dailyMinutes;

    if (submittedIntent !== workspace.intent) {
      if (!(await dispatchAction({ type: 'set_intent', intent: submittedIntent }))) return;
    }
    if (submittedAudience !== workspace.audience) {
      if (!(await dispatchAction({ type: 'set_audience', audience: submittedAudience }))) return;
    }
    if (submittedDailyMinutes !== workspace.dailyMinutes) {
      if (!(await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: submittedDailyMinutes }))) return;
    }
    closeOverviewIfUnchanged({
      intent: submittedIntent,
      audience: submittedAudience,
      dailyMinutes: submittedDailyMinutes,
    });
  };

  const handleAddSource = async () => {
    const submittedLabel = sourceDraft.label.trim();
    const submittedText = sourceDraft.text;
    if (!submittedLabel || !submittedText.trim()) return;

    const action: CohortAction = {
      type: 'add_text_source',
      label: submittedLabel,
      text: submittedText,
    };
    if (await dispatchAction(action)) {
      clearSourceDraftIfUnchanged({ label: submittedLabel, text: submittedText });
    }
  };

  const hasOverviewConflict =
    overviewDraft.isOpen &&
    (overviewDraft.baseIntent !== workspace.intent ||
      overviewDraft.baseAudience !== workspace.audience ||
      overviewDraft.baseDailyMinutes !== workspace.dailyMinutes);

  return (
    <>
      {/* Hero / Overview Card */}
      <section className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div>
            <span className={styles.heroEyebrow}>Learning Blueprint</span>
            <h1 className={styles.heroTitle}>{workspace.title || 'Cohort Blueprint'}</h1>
          </div>
          <button type="button" className={styles.editActionBtn} onClick={handleOpenOverview}>
            <Edit3 size={14} /> Edit details
          </button>
        </div>

        <p className={styles.intentText}>{workspace.intent}</p>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <Users size={16} color="var(--creation-blue)" />
            <span>Audience: <strong>{workspace.audience || 'General learners'}</strong></span>
          </div>
          <div className={styles.metaItem}>
            <Clock size={16} color="var(--creation-blue)" />
            <span>Pace: <strong>{workspace.dailyMinutes} mins/day</strong></span>
          </div>
        </div>
      </section>

      {/* Sources intake form */}
      <section id="builder-sources" className={styles.heroCard} aria-label="Grounded source text">
        <div className={styles.sectionHeader}>
          <h3>Source text</h3>
          <small className={styles.statusPill} data-status={workspace.processing.status}>
            {workspace.processing.status}
            {workspace.processing.status === 'queued' ? ` · ${workspace.processing.stage} waiting for worker` : ''}
            {needsRebuild && workspace.processing.status === 'idle' ? ' · rebuild needed' : ''}
          </small>
        </div>

        <ExternalSources />

        <div className={styles.formField}>
          <label htmlFor="cohort-source-title">Source title</label>
          <input
            id="cohort-source-title"
            value={sourceDraft.label}
            placeholder="e.g. Distributed systems notes"
            onChange={event => updateSourceDraft({ label: event.target.value }, 'intake')}
          />
        </div>

        <div className={styles.formField}>
          <label htmlFor="cohort-source-text">Paste text to retain and ground this curriculum</label>
          <textarea
            id="cohort-source-text"
            rows={6}
            maxLength={200_000}
            value={sourceDraft.text}
            onChange={event => updateSourceDraft({ text: event.target.value }, 'intake')}
          />
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.saveBtn} onClick={() => void handleAddSource()}>
            Add text source
          </button>
        </div>
      </section>

      {/* Overview edit modal */}
      {overviewDraft.isOpen && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Edit Cohort Overview" onClose={closeOverview}>
            <h3>Edit Cohort Overview</h3>
            {hasOverviewConflict && (
              <div role="alert">
                <p>Overview changed while you were editing. Current: {workspace.intent} · {workspace.audience} · {workspace.dailyMinutes} minutes.</p>
                <button
                  type="button"
                  onClick={() => {
                    updateOverviewDraft({
                      intent: overviewDraft.intent === overviewDraft.baseIntent ? workspace.intent : overviewDraft.intent,
                      audience: overviewDraft.audience === overviewDraft.baseAudience ? workspace.audience : overviewDraft.audience,
                      dailyMinutes: overviewDraft.dailyMinutes === overviewDraft.baseDailyMinutes ? workspace.dailyMinutes : overviewDraft.dailyMinutes,
                      baseIntent: workspace.intent,
                      baseAudience: workspace.audience,
                      baseDailyMinutes: workspace.dailyMinutes,
                    });
                  }}
                >
                  Keep my overview edits against current values
                </button>
              </div>
            )}

            <div className={styles.formField}>
              <label>Learning Intent</label>
              <textarea
                aria-label="Learning intent"
                rows={3}
                value={overviewDraft.intent}
                onChange={e => updateOverviewDraft({ intent: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Target Audience</label>
              <input
                aria-label="Target audience"
                type="text"
                value={overviewDraft.audience}
                onChange={e => updateOverviewDraft({ audience: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Daily Minutes</label>
              <input
                aria-label="Daily minutes"
                type="number"
                min={1}
                max={1440}
                value={overviewDraft.dailyMinutes}
                onChange={e =>
                  updateOverviewDraft({ dailyMinutes: Number(e.target.value) || 20 })
                }
              />
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeOverview}>
                Cancel
              </button>
              <button type="button" className={styles.saveBtn} onClick={() => void handleSaveOverview()}>
                Save changes
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}
    </>
  );
}
