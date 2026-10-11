'use client';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { useCreation } from '../hooks/useCreation';
import { CreationShell } from './CreationShell';
import { CohortPreviewHero } from './CohortPreviewHero';
import { PublicationSuccess } from './PublicationSuccess';
import styles from './ReviewWorkspace.module.css';

export function PublicationStatus({ creation }: { creation: ReturnType<typeof useCreation> }) {
  const { snapshot } = creation; const publication = snapshot.publication;
  // A draft's visibility preference cannot establish publication; only its committed receipt can.
  const receipt = snapshot.stage === 'published' ? publication?.receipt : null;
  const publicCohort = receipt?.mode === 'public_publish';
  const fields = { title: snapshot.review?.title ?? snapshot.result?.intent.topic.value ?? 'Your cohort',
    description: snapshot.review?.description ?? '', visibility: publicCohort ? 'PUBLIC' as const : 'PRIVATE' as const,
    chatEnabled: snapshot.review?.chatEnabled ?? false, eventsEnabled: snapshot.review?.eventsEnabled ?? false };
  const lessonCount = snapshot.processing?.building?.checkpoint?.completed.reduce((sum, item) => sum + item.lessonCount, 0);
  const cohortPath = receipt ? `/cohort/${encodeURIComponent(receipt.cohortId)}` : null;
  return <CreationShell variant="review" query={snapshot.result?.intent.rawQuery ?? snapshot.query} saved={creation.saved}
    reply={receipt ? <><p>That’s done.</p><p>{publicCohort ? 'Your cohort is published and ready to discover.' : 'Your private cohort is ready for you and authorized members.'}</p><p>Open your cohort or start learning from your feed.</p></> : <><p>Your draft is saved.</p><p>Finalization validates the retained learning artifacts before making your cohort available.</p></>}
    hintTitle="Saved to your account" hint="You can return to this draft at any time." disabled onMessage={() => {}}
    conversation={receipt ? <ol className={styles.checklist}>{['Reading through the material', 'Chunking into meaningful pieces', 'Analyzing each piece', 'Building your learning experience', 'Reviewing and refining'].map(label => <li key={label}><CheckCircle2 size={20} aria-hidden="true" /><span>{label}</span></li>)}</ol> : undefined}>
    <section className={styles.workspace} aria-label={receipt ? 'Cohort activated' : 'Finalizing cohort'}>
      {creation.message && <p role="alert" className={styles.alert}>{creation.message}</p>}
      {!publication || snapshot.stage === 'published' && !receipt ? <p role="alert">Publication state is unavailable. Reload this saved draft.</p> : receipt && cohortPath ? <>
        <header className={styles.toolbar}><div><h2>{publicCohort ? 'Your cohort is published' : 'Your private cohort is ready'}</h2><p>Committed to your account. Your cohort is ready to open.</p></div><div className={styles.toolbarActions}><Link href={cohortPath}>Open cohort</Link></div></header>
        <CohortPreviewHero snapshot={snapshot} fields={fields} committed />
        <nav className={styles.tabs} aria-label="Cohort sections"><a href="#published-overview" aria-current="location">Overview</a><Link href={cohortPath}>What you’ll see</Link><a href="#published-community">Community</a></nav>
        <div className={styles.previewGrid}><div><section className={styles.panel} id="published-overview"><h2>About this cohort</h2><p className={styles.copy}>{fields.description}</p>
          <div className={styles.sourceSection}><h2>Source material</h2><ul className={styles.sourceList}>{snapshot.materials.map((material, index) => <li key={material.id}><div><strong>{material.input.kind === 'url' ? material.input.url : material.input.kind === 'goal' ? 'AI-authored guide from your goal' : `Retained source ${index + 1}`}</strong><p>{material.selectedUnitIds.length} selected units · {material.kind.replaceAll('_', ' ')}</p></div></li>)}</ul></div></section>
          <section className={styles.panel} id="published-community"><h2>Community</h2><p className={styles.copy}>{fields.chatEnabled ? 'Cohort chat is enabled.' : 'Cohort chat is disabled.'} {fields.eventsEnabled ? 'Cohort events are enabled.' : 'Cohort events are disabled.'}</p></section></div>
          <aside className={styles.sidebar} aria-label="Committed cohort details"><section className={styles.panel}><h2>Details</h2><ul>{lessonCount !== undefined && <li>{lessonCount} saved lessons</li>}<li>{snapshot.materials.length} retained sources</li><li>Visibility: {publicCohort ? 'Public' : 'Private'}</li></ul></section><section className={styles.panel}><h2>Your learning goals</h2><ul>{snapshot.result?.intent.outcomes.value.map((goal, index) => <li key={index}>{goal}</li>)}</ul></section></aside></div>
        <section className={styles.panel} aria-label="Completion actions"><h2>What’s next?</h2><Link href={`/play?cohort=${encodeURIComponent(receipt.cohortId)}`}>Start learning</Link>
          {!publicCohort && <><p className={styles.copy}>Only you and authorized members can access this cohort. You can publish this same cohort when ready.</p><button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.finalize('public_publish')}>Publish this cohort publicly</button></>}
          <div><PublicationSuccess key={`${receipt.requestId}:${receipt.mode}`} receipt={receipt} title={fields.title} /></div></section>
      </> : <section className={styles.panel}><h2>Finalizing your cohort</h2>
        <p className={styles.copy}>Validated learning artifacts are prepared before the cohort becomes available. You can safely return to this draft.</p>
        <p role="status">{publication.checkpoint ? `${publication.checkpoint.completed.length} of ${publication.checkpoint.total} lesson artifacts saved` : 'Validating retained content and reserving cohort identity…'}</p>
        {publication.checkpoint && <progress aria-label="Saved publication artifacts" value={publication.checkpoint.completed.length} max={publication.checkpoint.total} />}
        {snapshot.status === 'running' ? <button onClick={creation.cancel}>Cancel finalization</button> : <>
          {snapshot.error && <p role="alert">{snapshot.error.message}</p>}{snapshot.status === 'canceled' && <p>Finalization was canceled before commitment.</p>}
          <button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.finalize(publication.mode)}>Retry finalization</button></>}
      </section>}
    </section>
  </CreationShell>;
}
