'use client';

import { useEffect, useState } from 'react';
import { Check, Edit3, Globe2, Image as ImageIcon, X } from 'lucide-react';
import type { EntityRef } from 'interaction-builder/core';
import type { CohortAction, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { deriveCohortDescription, deriveCohortTitle } from '@/src/shared/cohort-builder/cohort-metadata';
import { getCohortSeasonGroups } from '@/src/shared/cohort-builder/delivery';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';
import { ReleasePanel } from '../components/ReleasePanel';
import styles from '../CohortBuilder.module.css';

export interface CurriculumStageViewProps {
  workspace: CohortWorkspace;
  workspaceId?: string;
  revision?: number;
  needsRebuild?: boolean;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

type EditField = 'title' | 'description' | 'cover' | 'outcomes' | 'requirements' | 'season' | 'lesson';

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className={styles.editActionBtn} aria-label={`Edit ${label}`} title={`Edit ${label}`} onClick={onClick}><Edit3 size={14} aria-hidden="true" /></button>;
}

function listValue(values: string[] | undefined, fallback: string[]) { return values?.length ? values : fallback; }

export function CurriculumStageView({
  workspace,
  workspaceId = '',
  revision,
  needsRebuild,
  dispatchAction,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CurriculumStageViewProps) {
  const [tab, setTab] = useState<'overview' | 'questline'>('overview');
  const [editing, setEditing] = useState<EditField | null>(null);
  const [value, setValue] = useState('');
  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const customEvent = event as CustomEvent<{ entityId?: string; targetId?: string; kind?: string }>;
      const targetId = customEvent.detail?.targetId || (customEvent.detail?.entityId ? (customEvent.detail.entityId.startsWith('lesson-') ? customEvent.detail.entityId : `lesson-${customEvent.detail.entityId}`) : undefined);
      if (!targetId) return;

      setTab('questline');
      requestAnimationFrame(() => {
        const el = document.getElementById(targetId) || (customEvent.detail?.entityId ? document.getElementById(customEvent.detail.entityId) : null);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus?.();
        }
      });
    };

    window.addEventListener('cohort:highlight-entity', handleHighlight);
    return () => {
      window.removeEventListener('cohort:highlight-entity', handleHighlight);
    };
  }, []);

  const title = deriveCohortTitle(workspace);
  const description = deriveCohortDescription(workspace);
  const coverImage = workspace.presentation?.coverImage || '/images/hero-collage/real-galaxy.jpg';
  const outcomes = listValue(workspace.presentation?.learningOutcomes, [`Build practical mastery in ${title}`, `Complete ${workspace.lessons.length} focused lessons`]);
  const requirements = listValue(workspace.presentation?.requirements, ['Open to curious learners', `${workspace.dailyMinutes} minutes a day`]);
  const seasons = getCohortSeasonGroups(workspace);

  const open = (field: EditField, initial: string, options?: { seasonKey?: string; lessonId?: string }) => {
    setEditing(field); setValue(initial); setSeasonKey(options?.seasonKey ?? null); setLessonId(options?.lessonId ?? null); setError(null);
  };
  const cancel = () => { setEditing(null); setError(null); setValue(''); setSeasonKey(null); setLessonId(null); };
  const save = async () => {
    const next = value.trim();
    if (!next && editing !== 'cover') { setError('This field cannot be empty.'); return; }
    setSaving(true); setError(null);
    let action: CohortAction | null = null;
    if (editing === 'title') action = { type: 'edit_presentation', title: next };
    if (editing === 'description') action = { type: 'edit_presentation', description: next };
    if (editing === 'cover') action = { type: 'edit_presentation', coverImage: next || null };
    if (editing === 'outcomes') action = { type: 'edit_presentation', learningOutcomes: next.split('\n').map(item => item.trim()).filter(Boolean) };
    if (editing === 'requirements') action = { type: 'edit_presentation', requirements: next.split('\n').map(item => item.trim()).filter(Boolean) };
    if (editing === 'season' && seasonKey) action = { type: 'set_season_title', seasonKey, title: next };
    const lesson = lessonId ? workspace.lessons.find(item => item.id === lessonId) : undefined;
    if (editing === 'lesson' && lesson) action = { type: 'edit_lesson', lessonId: lesson.id, title: next, objective: lesson.objective };
    const expected = lesson ? [{ kind: 'lesson' as const, id: lesson.id, version: lesson.version }] : undefined;
    const saved = action && await dispatchAction(action, expected);
    setSaving(false);
    if (saved) cancel(); else setError('Could not save this edit. Your writing is still here; retry when the latest draft is available.');
  };

  return <section className={styles.workspace} aria-label="Editable cohort preview">
    <header className={styles.reviewToolbar}>
      <div><h2>Editable preview</h2><p>These are the two pages learners will see after publication.</p></div>
      <div className={styles.reviewToolbarActions}>
        {needsRebuild && <span className={styles.statusPill}>rebuild needed</span>}
        <span className={styles.savedDraftStatus}><Check size={15} aria-hidden="true" /> Confirmed edits save immediately</span>
        <button type="button" className={styles.primaryAction} onClick={() => setPublishOpen(true)}><Globe2 size={17} aria-hidden="true" /> Publish cohort</button>
      </div>
    </header>

    <section className={styles.reviewHero} style={{ backgroundImage: `linear-gradient(90deg, rgb(8 20 16 / 94%), rgb(20 69 42 / 82%)), url(${coverImage})` }}>
      <div className={styles.reviewHeroCopy}>
        <div className={styles.editableHeading}><h1>{title}</h1><EditButton label="cohort title" onClick={() => open('title', title)} /></div>
        <div className={styles.editableHeading}><p>{description}</p><EditButton label="cohort description" onClick={() => open('description', description)} /></div>
        <div className={styles.reviewTags}>{(workspace.presentation?.categories ?? []).map(category => <span key={category}>{category}</span>)}</div>
      </div>
      <div className={styles.coverEdit}><ImageIcon size={16} aria-hidden="true" /><EditButton label="cover image" onClick={() => open('cover', workspace.presentation?.coverImage ?? '')} /></div>
    </section>

    <nav className={styles.reviewTabs} aria-label="Cohort preview pages">
      <button type="button" aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => setTab('overview')}>Overview</button>
      <button type="button" aria-current={tab === 'questline' ? 'page' : undefined} onClick={() => setTab('questline')}>Questline</button>
    </nav>

    {tab === 'overview' ? <div className={styles.reviewPreviewGrid}>
      <section className={styles.reviewPanel}><div className={styles.editableHeading}><h2>About this cohort</h2><EditButton label="cohort description" onClick={() => open('description', description)} /></div><p className={styles.reviewCopy}>{description}</p>
        <div className={styles.editableHeading}><h2>What you’ll learn</h2><EditButton label="learning outcomes" onClick={() => open('outcomes', outcomes.join('\n'))} /></div>
        <ul className={styles.previewList}>{outcomes.map(item => <li key={item}>{item}</li>)}</ul>
      </section>
      <aside className={styles.reviewPanel}><div className={styles.editableHeading}><h2>Before you begin</h2><EditButton label="requirements" onClick={() => open('requirements', requirements.join('\n'))} /></div><ul className={styles.previewList}>{requirements.map(item => <li key={item}>{item}</li>)}</ul><p className={styles.previewPacing}>{workspace.dailyMinutes} minutes per day · {workspace.lessons.length} lessons</p></aside>
    </div> : <section className={styles.reviewPanel} id="creation-review-questline">
      <div className={styles.editableHeading}><div><h2>{workspace.presentation?.subtitle || `${title} Questline`}</h2><p className={styles.reviewCopy}>Work through each season at your own pace.</p></div></div>
      {seasons.map((season, seasonIndex) => <section key={season.key} className={styles.previewSeason}><div className={styles.editableHeading}><h3>{workspace.presentation?.seasonTitles?.[season.key] ?? season.title}</h3><EditButton label={`season ${seasonIndex + 1} title`} onClick={() => open('season', workspace.presentation?.seasonTitles?.[season.key] ?? season.title, { seasonKey: season.key })} /></div>
        <ol>{season.lessons.map((lesson, lessonIndex) => {
          const lessonElementId = lesson.id.startsWith('lesson-') ? lesson.id : `lesson-${lesson.id}`;
          return (
            <li
              key={lesson.id}
              id={lessonElementId}
              tabIndex={-1}
              className={styles.previewLesson}
            >
              <span>{lessonIndex + 1}</span>
              <div>
                <strong>{lesson.title}</strong>
                <p>{lesson.objective}</p>
                {lesson.evidenceStatus === 'orphaned' && (
                  <p role="alert" className={styles.alertBox}>
                    This retained lesson references changed or removed source text. Review its evidence before relying on it.
                  </p>
                )}
                {lesson.sourceChunkIds.length > 0 && (
                  <p className={styles.intentText}>
                    Grounded in {lesson.sourceChunkIds.map(chunkId => {
                      const chunk = workspace.chunks.find(item => item.id === chunkId);
                      return chunk ? `“${chunk.text.slice(0, 160)}”` : 'unavailable retained passage';
                    }).join(' ')}
                  </p>
                )}
                {lesson.sourceChunkIds.length > 0 && (
                  <details className={styles.evidenceDrawer}>
                    <summary>Inspect evidence</summary>
                    {lesson.sourceChunkIds.map(chunkId => {
                      const chunk = workspace.chunks.find(item => item.id === chunkId);
                      const source = workspace.sources.find(item => item.id === chunk?.sourceId);
                      const pages = source?.locations?.filter(location => location.page && location.start < (chunk?.end ?? 0) && location.end > (chunk?.start ?? 0)).map(location => location.page!);
                      const timeLoc = source?.locations?.filter(location => location.startMs !== undefined && location.endMs !== undefined && location.start < (chunk?.end ?? 0) && location.end > (chunk?.start ?? 0));
                      const timestamps = timeLoc?.length ? ` · timestamp ${formatYoutubeTimestamp(Math.min(...timeLoc.map(l => l.startMs!)))}–${formatYoutubeTimestamp(Math.max(...timeLoc.map(l => l.endMs!)))}` : '';
                      const fileLoc = source?.locations?.filter(location => location.filePath && location.start < (chunk?.end ?? 0) && location.end > (chunk?.start ?? 0));
                      const fileCitations = fileLoc?.length ? ` · ${Array.from(new Set(fileLoc.map(l => l.startLine && l.endLine ? `${l.filePath}#L${l.startLine}-L${l.endLine}` : l.filePath).filter(Boolean))).join(', ')}` : '';
                      return (
                        <blockquote key={chunkId} className={styles.evidenceBlockquote}>
                          {chunk ? (
                            <>
                              <cite className={styles.evidenceCite}>
                                {source?.label ?? 'Retained source'} · version {chunk.sourceVersion}
                                {pages?.length ? ` · physical page ${pages.join(', ')}` : ''}
                                {timestamps}
                                {fileCitations} · characters {chunk.start}–{chunk.end}
                                {source?.provenance ? ` · ${source.provenance.scope} · ${source.provenance.parserVersion}` : ''}
                              </cite>
                              {(source?.provenance?.finalUrl || source?.provenance?.repoUrl) && (
                                <p>
                                  {source.provenance.finalUrl ?? `${source.provenance.repoUrl}@${source.provenance.commitSha ? source.provenance.commitSha.slice(0, 7) : (source.provenance.ref ?? '')}`}
                                </p>
                              )}
                              <p>{chunk.text}</p>
                            </>
                          ) : 'Retained passage unavailable; review orphan warning.'}
                        </blockquote>
                      );
                    })}
                  </details>
                )}
              </div>
              <EditButton label={`lesson ${lessonIndex + 1} title`} onClick={() => open('lesson', lesson.title, { lessonId: lesson.id })} />
              <button
                type="button"
                className={styles.editActionBtn}
                aria-label="Discuss in chat"
                title={`Discuss ${lesson.title} in chat`}
                onClick={() => onSelectLessonForChat?.({ entity: { kind: 'lesson', id: lesson.id, version: lesson.version }, label: lesson.title })}
              >
                Discuss in chat
              </button>
            </li>
          );
        })}</ol>
      </section>)}
    </section>}

    {editing && <div className={styles.builderModalBackdrop} role="presentation"><section className={styles.builderModal} role="dialog" aria-modal="true" aria-label={`Edit ${editing}`}><button type="button" className={styles.modalClose} aria-label="Cancel edit" onClick={cancel}><X size={18} /></button><h2>Edit {editing === 'cover' ? 'cover image URL' : editing}</h2><p>Save to update the preview and the published cohort.</p><textarea autoFocus value={value} rows={editing === 'description' || editing === 'outcomes' || editing === 'requirements' ? 6 : 2} onChange={event => setValue(event.target.value)} aria-label={`Edit ${editing}`} placeholder={editing === 'cover' ? 'https://example.com/cover.jpg' : undefined} />{error && <p className={styles.alertBox} role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className={styles.editActionBtn} onClick={cancel}>Cancel</button><button type="button" className={styles.saveBtn} disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button></div></section></div>}
    {publishOpen && <div className={styles.builderModalBackdrop} role="presentation"><section className={`${styles.builderModal} ${styles.publishDialog}`} role="dialog" aria-modal="true" aria-label="Publish cohort"><button type="button" className={styles.modalClose} aria-label="Close publish dialog" onClick={() => setPublishOpen(false)}><X size={18} /></button><h2>Publish this cohort</h2><p>Public publication uses the exact content in this preview.</p><ReleasePanel workspace={workspace} workspaceId={workspaceId} revision={revision} initialMode="public_publish" onNavigateToDestination={onNavigateToDestination} /></section></div>}
  </section>;
}
