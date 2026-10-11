'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, BookOpen, Clock3, ExternalLink, FileText, Globe, List, LockKeyhole, UserRound } from 'lucide-react';
import type { ReviewModel } from '../hooks/useReviewWorkspace';
import { LessonEditor, MetadataEditor } from './ReviewEditors';
import styles from './ReviewWorkspace.module.css';

const sections = [{ id: 'creation-review-overview', label: 'Overview' }, { id: 'creation-review-lessons', label: 'What you’ll see' }, { id: 'creation-review-community', label: 'Community' }, { id: 'creation-review-creator', label: 'About the creator' }];
export function ReviewPreview({ model }: { model: ReviewModel }) {
  const [active, setActive] = useState(sections[0].id);
  const { snapshot, fields, preview } = model;
  const lessons = preview?.curriculum.seasons.flatMap(season => season.lessons) ?? [];
  const minutes = Math.ceil(lessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0) / 60);
  return <>
    <div className={styles.hero}><Image className={styles.heroArt} src="/images/hero-collage/real-galaxy.jpg" alt="" fill sizes="(max-width:820px) 100vw, 75vw" priority />
      <span className={styles.illustration}>Draft illustration</span>
      <div className={styles.heroCopy}><div className={styles.tags}><span>{snapshot.result?.intent.topic.value ?? 'Your learning journey'}</span></div>
        <h1>{fields.title}</h1><p>{fields.description}</p>
        <div className={styles.creator}><span><UserRound size={24} aria-hidden="true" /></span><div><strong>Created by you</strong><p>Based on {snapshot.materials.length} retained {snapshot.materials.length === 1 ? 'source' : 'sources'}</p></div></div>
      </div><div className={styles.join}><button disabled>Join Cohort <ArrowRight size={22} aria-hidden="true" /></button><p>Preview only · available after activation</p><span><LockKeyhole size={17} aria-hidden="true" />{fields.visibility === 'PUBLIC' ? 'Public draft preference' : 'Private draft'}</span></div>
    </div>
    <nav className={styles.tabs} aria-label="Draft sections">{sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={() => setActive(section.id)}>{section.label}</a>)}</nav>
    <div className={styles.previewGrid}><div>
      <section className={styles.panel} id="creation-review-overview"><h2>About this cohort</h2><p className={styles.copy}>{fields.description}</p>
        <details className={styles.editDetails}><summary>Edit cohort details{model.metadataDirty ? ' · Unsaved edits' : ''}</summary><MetadataEditor model={model} /></details>
        <div className={styles.sourceSection}><h2>Source material</h2><ul className={styles.sourceList}>{snapshot.materials.map((material, index) => {
          const videos = snapshot.youtubeSources.find(item => item.materialId === material.id)?.units.filter(unit => material.selectedUnitIds.includes(unit.unitId));
          const title = videos?.length === 1 ? videos[0].title : material.input.kind === 'url' ? material.input.url : material.input.kind === 'goal' ? 'AI-authored guide from your goal' : `Source ${index + 1} · ${material.kind === 'pdf' ? 'PDF' : 'Text / Markdown'}`;
          return <li key={material.id}><FileText size={29} strokeWidth={1.3} aria-hidden="true" /><div>{material.input.kind === 'url' ? <a href={material.input.url} target="_blank" rel="noopener noreferrer">{title}<ExternalLink size={15} aria-hidden="true" /></a> : <strong>{title}</strong>}<p>{material.selectedUnitIds.length} selected {material.selectedUnitIds.length === 1 ? 'unit' : 'units'} · {material.kind.replaceAll('_', ' ')}</p></div></li>;
        })}</ul></div>
      </section>
      <section className={styles.panel} id="creation-review-community"><h2>Community</h2><p className={styles.copy}>{fields.chatEnabled ? 'Cohort chat will be enabled for authorized members.' : 'Cohort chat is disabled.'} {fields.eventsEnabled ? 'Cohort events will be enabled.' : 'Cohort events are disabled.'}</p><p className={styles.helper}>Change these settings in Edit cohort details.</p></section>
      <section className={styles.panel} id="creation-review-lessons"><h2>What you’ll see</h2>
        {!preview ? <p role="status">Loading retained curriculum…</p> : <>{!!preview.curriculum.warnings.length && <ul className={styles.warnings}>{preview.curriculum.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          {!lessons.length && <p>No retained lessons are available in this preview.</p>}
          {preview.curriculum.seasons.map(season => <section key={season.id} className={styles.season}><h3>{season.title.value}</h3><ol>{season.lessons.map(lesson => <li key={lesson.id}><details><summary><span>{lesson.order + 1}</span><div><strong>{model.lessonEdits[lesson.id]?.title ?? lesson.title.value}</strong><small>{Math.ceil(lesson.durationSeconds / 60)} estimated min · {lesson.chunkIds.length} retained chunks{model.lessonEdits[lesson.id] ? ' · Unsaved edits' : ''}</small></div></summary><LessonEditor lesson={lesson} model={model} /></details></li>)}</ol></section>)}
        </>}
      </section>
      <section className={styles.panel} id="creation-review-creator"><h2>About the creator</h2><p className={styles.copy}>Created by you, from the material and learning goal in this saved draft.</p></section>
    </div><aside className={styles.sidebar} aria-label="Cohort details"><section className={styles.panel}><h2>Details</h2><ul>
      <li><BookOpen size={20} aria-hidden="true" />{preview ? `${lessons.length} saved lessons` : 'Loading saved lessons…'}</li>
      <li><Clock3 size={20} aria-hidden="true" />{preview ? `${minutes} estimated learning minutes` : 'Duration available after loading'}</li>
      <li><List size={20} aria-hidden="true" />{snapshot.materials.length} retained sources</li>
      {snapshot.result?.intent.language && <li><Globe size={20} aria-hidden="true" />Language: {snapshot.result.intent.language.value}</li>}
    </ul></section><section className={styles.panel}><h2>Your learning goals</h2><ul>{snapshot.result?.intent.outcomes.value.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul>
      {snapshot.result?.intent.level && <p className={styles.helper}>Level: {snapshot.result.intent.level.value}</p>}</section>
      <section className={styles.panel}><h2>Draft status</h2><p className={styles.copy}>{model.dirty ? 'You have unsaved edits.' : 'Your confirmed edits are saved to your account.'}</p><p className={styles.helper}>This preview is not a publicly available cohort.</p></section>
    </aside></div>
  </>;
}
