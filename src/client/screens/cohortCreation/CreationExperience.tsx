'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreation } from './hooks/useCreation';
import { RecommendationResults } from './components/RecommendationResults';
import { StartingPoint } from './components/StartingPoint';
import { TextMaterial } from './components/TextMaterial';
import styles from './CreationExperience.module.css';

export function CreationExperience({ draftId, initialQuery = '', resume = false }: { draftId: string; initialQuery?: string; resume?: boolean }) {
  const creation = useCreation(draftId, initialQuery, resume);
  const { snapshot } = creation;
  const router = useRouter();
  const createOwn = async () => {
    if (await creation.createOwn()) router.push(`/quest/draft/${draftId}`);
  };
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}><Link href="/">Undone</Link><span>Cohort creation</span></header>
    <p className={styles.notice}>{creation.saved ? 'Your draft is saved to your account.' : 'Waiting for server confirmation.'}</p>
    {creation.message && <p role="alert">{creation.message}</p>}
    {!creation.hydrated ? <p role="status">Opening workspace…</p> : <div className={styles.workspace}>
      <aside className={styles.intent} aria-label="Learning intent">
        <h1>What do you want to learn?</h1>
        {snapshot.result ? <>
          <p>{snapshot.result.intent.rawQuery}</p>
          <h2>{snapshot.result.intent.topic.value}</h2>
          <ul>{snapshot.result.intent.outcomes.value.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul>
          {!!snapshot.result.intent.uncertainties.length && <p>{snapshot.result.intent.uncertainties.join(' ')}</p>}
        </> : <p>Your query will become a structured learning intent. You remain in control of what happens next.</p>}
      </aside>
      <div>
        {snapshot.stage === 'starting_point' ? <>
          <StartingPoint selected={snapshot.startingPoint} onSelect={creation.chooseStartingPoint} onBack={creation.back}
            disabled={creation.materialPending || snapshot.status === 'running'} />
          {snapshot.startingPoint === 'have_material' ? <TextMaterial snapshot={snapshot} uploading={creation.uploading} pending={creation.materialPending}
            onUpload={creation.uploadText} onCancelUpload={creation.cancelUpload} onCancel={creation.cancel} onRetry={creation.retryMaterial}
            onRemove={creation.removeMaterial} onWeb={creation.acquireWeb} onSelectUnits={creation.selectYoutubeUnits} /> :
            snapshot.startingPoint && <p>Material discovery for this starting point is not available yet.</p>}
        </> : <>
          <form key={snapshot.query} onSubmit={event => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('query');
            if (typeof value === 'string') void creation.runQuery(value);
          }} className={styles.form}>
            <label htmlFor="learning-query">Your learning query</label>
            <textarea id="learning-query" name="query" defaultValue={snapshot.query || initialQuery} minLength={3} maxLength={2000} required rows={3} />
            <button type="submit" disabled={snapshot.status === 'running'}>Find cohorts</button>
          </form>
          {snapshot.status === 'running' && <div role="status"><p>Understanding your intent and finding public cohorts…</p><p>You can return later; this request is saved.</p><button type="button" onClick={creation.cancel}>Cancel</button></div>}
          {snapshot.error && <div role="alert"><p>{snapshot.error.message}</p>{snapshot.error.retryable && <button type="button" onClick={() => void creation.runQuery(snapshot.query)}>Retry</button>}</div>}
          {snapshot.status === 'canceled' && <div role="status"><p>Generation stopped. Your query is still here.</p><button type="button" onClick={() => void creation.runQuery(snapshot.query)}>Retry</button></div>}
          {snapshot.result && <RecommendationResults result={snapshot.result} onCreateOwn={createOwn} />}
        </>}
      </div>
    </div>}
  </main>;
}
