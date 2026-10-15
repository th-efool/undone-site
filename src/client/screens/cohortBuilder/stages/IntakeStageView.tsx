'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Edit3, Plus, Upload, FileText, Globe, CircleCheck } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import styles from '../CohortBuilder.module.css';
import { BuilderDialog } from '../BuilderDialog';
import { ExternalSources } from '../ExternalSources';
import { useCohortDrafts } from '../draft-context';

function YoutubeIcon({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function GithubIcon({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

interface IntakeStageViewProps {
  workspace: CohortWorkspace;
  needsRebuild?: boolean;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function IntakeStageView({ workspace, needsRebuild = false, dispatchAction }: IntakeStageViewProps) {
  const {
    sourceDraft,
    updateSourceDraft,
    openEditSource,
    clearSourceDraft,
    clearSourceDraftIfUnchanged,
    overviewDraft,
    openOverview,
    updateOverviewDraft,
    closeOverview,
    closeOverviewIfUnchanged,
  } = useCohortDrafts();

  const [mode, setMode] = useState<'file' | 'paste' | 'url' | 'youtube' | 'github'>('paste');
  const filePickerRef = useRef<HTMLInputElement>(null);

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

    if (sourceDraft.editingSourceId) {
      const action: CohortAction = {
        type: 'edit_text_source',
        sourceId: sourceDraft.editingSourceId,
        label: submittedLabel,
        text: submittedText,
      };
      if (await dispatchAction(action)) {
        clearSourceDraftIfUnchanged({ label: submittedLabel, text: submittedText });
      }
    } else {
      const action: CohortAction = {
        type: 'add_text_source',
        label: submittedLabel,
        text: submittedText,
      };
      if (await dispatchAction(action)) {
        clearSourceDraftIfUnchanged({ label: submittedLabel, text: submittedText });
      }
    }
  };

  const hasOverviewConflict =
    overviewDraft.isOpen &&
    (overviewDraft.baseIntent !== workspace.intent ||
      overviewDraft.baseAudience !== workspace.audience ||
      overviewDraft.baseDailyMinutes !== workspace.dailyMinutes);

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* Editorial Heading matching legacy */}
      <header className={styles.materialHeading}>
        <p className={styles.materialEyebrow}>Give me what you’ve got</p>
        <h1>
          Paste a link, upload a file, <br />
          or drop <span>your material<InkUnderline className={styles.materialUnderline} /></span> here.
        </h1>
        <p className={styles.materialSubtitle}>
          You can give me multiple sources — videos, PDFs, websites, code, or notes.<br />
          I’ll understand them and turn them into a structured learning journey.
        </p>
      </header>

      {/* Blueprint summary bar */}
      <div className={styles.blueprintBar}>
        <span>Learning Goal: <strong>{workspace.intent || 'Your learning journey'}</strong></span>
        <button type="button" className={styles.editActionBtn} onClick={handleOpenOverview}>
          <Edit3 size={14} /> Edit details
        </button>
      </div>

      {/* Input panel matching legacy TextMaterial */}
      <section className={styles.materialInputPanel} aria-label="Grounded source text">
        <div className={styles.materialCards} aria-label="Material input options">
          <button
            type="button"
            aria-pressed={mode === 'file'}
            onClick={() => setMode('file')}
          >
            <Upload size={22} aria-hidden="true" />
            Upload a file
          </button>
          <button
            type="button"
            aria-pressed={mode === 'paste'}
            onClick={() => setMode('paste')}
          >
            <FileText size={22} aria-hidden="true" />
            Paste text
          </button>
          <button
            type="button"
            aria-pressed={mode === 'url'}
            onClick={() => setMode('url')}
          >
            <Globe size={22} aria-hidden="true" />
            Paste a link
          </button>
          <button
            type="button"
            aria-pressed={mode === 'youtube'}
            onClick={() => setMode('youtube')}
          >
            <YoutubeIcon size={22} aria-hidden="true" />
            YouTube
          </button>
          <button
            type="button"
            aria-pressed={mode === 'github'}
            onClick={() => setMode('github')}
          >
            <GithubIcon size={22} aria-hidden="true" />
            GitHub repository
          </button>
        </div>

        {mode === 'file' ? (
          <div
            className={styles.materialDrop}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files?.length) {
                const f = files[0];
                const reader = new FileReader();
                reader.onload = () => {
                  const textContent = typeof reader.result === 'string' ? reader.result : '';
                  updateSourceDraft({ label: f.name.replace(/\.[^/.]+$/, ''), text: textContent }, 'intake');
                  setMode('paste');
                };
                reader.readAsText(f);
              }
            }}
          >
            <button
              type="button"
              className={styles.materialPickFile}
              aria-label="Choose a file"
              onClick={() => filePickerRef.current?.click()}
            >
              <Plus size={32} />
            </button>
            <strong>Drop your material here</strong>
            <button
              type="button"
              className={styles.materialPasteLink}
              onClick={() => setMode('paste')}
            >
              or paste text
            </button>
            <label className={styles.srOnly} htmlFor="intake-material-file">
              Choose or drop a PDF/text/Markdown file
            </label>
            <input
              ref={filePickerRef}
              id="intake-material-file"
              type="file"
              className={styles.srOnly}
              accept=".pdf,.md,.markdown,.txt"
              onChange={e => {
                const files = e.target.files;
                if (files?.length) {
                  const f = files[0];
                  const reader = new FileReader();
                  reader.onload = () => {
                    const textContent = typeof reader.result === 'string' ? reader.result : '';
                    updateSourceDraft({ label: f.name.replace(/\.[^/.]+$/, ''), text: textContent }, 'intake');
                    setMode('paste');
                  };
                  reader.readAsText(f);
                }
              }}
            />
          </div>
        ) : mode === 'url' || mode === 'youtube' || mode === 'github' ? (
          <div className={styles.externalSourcesWrapper} style={{ order: 1 }}>
            <ExternalSources />
          </div>
        ) : (
          <form className={styles.materialForm} onSubmit={e => { e.preventDefault(); void handleAddSource(); }}>
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
              <button
                type="submit"
                className={styles.saveBtn}
              >
                {sourceDraft.editingSourceId ? 'Save source changes' : 'Add text source'}
              </button>
              {sourceDraft.editingSourceId && (
                <button
                  type="button"
                  className={styles.editActionBtn}
                  onClick={clearSourceDraft}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Added materials list */}
      {workspace.sources.length > 0 && (
        <section className={styles.addedMaterialSection}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className={styles.sourceHeading}>Added material</h2>
            {needsRebuild && <span className={styles.statusPill}>rebuild needed</span>}
          </div>
          <ul className={styles.materialSourcesList}>
            {workspace.sources.map((source, index) => (
              <li key={source.id} className={styles.materialSourceItem}>
                <div className={styles.sourceIconCol}>
                  {source.state === 'ready' ? (
                    <CircleCheck size={24} className={styles.sourceReadyIcon} />
                  ) : (
                    <FileText size={24} className={styles.sourcePendingIcon} />
                  )}
                </div>
                <div className={styles.sourceDetailsCol}>
                  <h3 className={styles.materialSourceTitle}>{source.label}</h3>
                  <div className={styles.sourceProvenance}>
                    <span>Source {index + 1} · {source.input?.kind ?? 'Text / Markdown'} · {source.text ? `${source.text.length} chars` : 'retained'}</span>
                  </div>
                </div>
                <div className={styles.sourceActionsCol}>
                  <button
                    type="button"
                    className={styles.editActionBtn}
                    onClick={() => {
                      openEditSource(source, 'intake');
                      setMode('paste');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.editActionBtn}
                    onClick={() => void dispatchAction({ type: 'remove_source', sourceId: source.id })}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Real collage paper decorations matching legacy */}
      <div className={styles.materialDecorations} aria-hidden="true">
        <span className={styles.materialPhoto}>
          <Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="220px" />
        </span>
        <span className={styles.materialNote}>Same content.<br />More progress.</span>
        <span className={styles.materialBooks}>
          <Image src="/images/hero-collage/real-mug-books.jpg" alt="" fill sizes="270px" />
        </span>
      </div>

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
    </div>
  );
}
