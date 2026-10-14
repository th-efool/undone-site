'use client';

import React, { useState } from 'react';
import { Edit3, Clock, Users, FileText } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from '../CohortBuilder.module.css';
import { BuilderDialog } from '../BuilderDialog';
import { ExternalSources } from '../ExternalSources';

interface IntakeStageViewProps {
  workspace: CohortWorkspace;
  needsRebuild?: boolean;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function IntakeStageView({ workspace, needsRebuild = false, dispatchAction }: IntakeStageViewProps) {
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    intent: workspace.intent,
    audience: workspace.audience,
    dailyMinutes: workspace.dailyMinutes,
  });
  const [overviewBase, setOverviewBase] = useState(overviewForm);

  const [sourceForm, setSourceForm] = useState({ label: '', text: '' });

  const handleOpenOverview = () => {
    const fields = {
      intent: workspace.intent,
      audience: workspace.audience,
      dailyMinutes: workspace.dailyMinutes,
    };
    setOverviewForm(fields);
    setOverviewBase(fields);
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (
      overviewBase.intent !== workspace.intent ||
      overviewBase.audience !== workspace.audience ||
      overviewBase.dailyMinutes !== workspace.dailyMinutes
    ) {
      return;
    }
    if (overviewForm.intent !== workspace.intent) {
      if (!(await dispatchAction({ type: 'set_intent', intent: overviewForm.intent }))) return;
    }
    if (overviewForm.audience !== workspace.audience) {
      if (!(await dispatchAction({ type: 'set_audience', audience: overviewForm.audience }))) return;
    }
    if (overviewForm.dailyMinutes !== workspace.dailyMinutes) {
      if (!(await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: overviewForm.dailyMinutes }))) return;
    }
    setEditingOverview(false);
  };

  const handleAddSource = async () => {
    if (!sourceForm.label.trim() || !sourceForm.text.trim()) return;
    const action: CohortAction = {
      type: 'add_text_source',
      label: sourceForm.label.trim(),
      text: sourceForm.text,
    };
    if (await dispatchAction(action)) {
      setSourceForm({ label: '', text: '' });
    }
  };

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
            value={sourceForm.label}
            placeholder="e.g. Distributed systems notes"
            onChange={event => setSourceForm({ ...sourceForm, label: event.target.value })}
          />
        </div>

        <div className={styles.formField}>
          <label htmlFor="cohort-source-text">Paste text to retain and ground this curriculum</label>
          <textarea
            id="cohort-source-text"
            rows={6}
            maxLength={200_000}
            value={sourceForm.text}
            onChange={event => setSourceForm({ ...sourceForm, text: event.target.value })}
          />
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.saveBtn} onClick={() => void handleAddSource()}>
            Add text source
          </button>
        </div>
      </section>

      {/* Overview edit modal */}
      {editingOverview && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Edit Cohort Overview" onClose={() => setEditingOverview(false)}>
            <h3>Edit Cohort Overview</h3>
            {(overviewBase.intent !== workspace.intent ||
              overviewBase.audience !== workspace.audience ||
              overviewBase.dailyMinutes !== workspace.dailyMinutes) && (
              <div role="alert">
                <p>Overview changed while you were editing. Current: {workspace.intent} · {workspace.audience} · {workspace.dailyMinutes} minutes.</p>
                <button
                  type="button"
                  onClick={() => {
                    setOverviewForm({
                      intent: overviewForm.intent === overviewBase.intent ? workspace.intent : overviewForm.intent,
                      audience: overviewForm.audience === overviewBase.audience ? workspace.audience : overviewForm.audience,
                      dailyMinutes: overviewForm.dailyMinutes === overviewBase.dailyMinutes ? workspace.dailyMinutes : overviewForm.dailyMinutes,
                    });
                    setOverviewBase({
                      intent: workspace.intent,
                      audience: workspace.audience,
                      dailyMinutes: workspace.dailyMinutes,
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
                value={overviewForm.intent}
                onChange={e => setOverviewForm({ ...overviewForm, intent: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Target Audience</label>
              <input
                aria-label="Target audience"
                type="text"
                value={overviewForm.audience}
                onChange={e => setOverviewForm({ ...overviewForm, audience: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Daily Minutes</label>
              <input
                aria-label="Daily minutes"
                type="number"
                min={1}
                max={1440}
                value={overviewForm.dailyMinutes}
                onChange={e =>
                  setOverviewForm({ ...overviewForm, dailyMinutes: Number(e.target.value) || 20 })
                }
              />
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setEditingOverview(false)}>
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
