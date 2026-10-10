'use client';
import { BuildingProgress } from './components/BuildingProgress';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { PublicationStatus } from './components/PublicationStatus';
import { CreationShell } from './components/CreationShell';
import { RecommendationPending } from './components/RecommendationPending';
import { AnalysisProgress } from './components/AnalysisProgress';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreation } from './hooks/useCreation';
import { RecommendationResults } from './components/RecommendationResults';
import { StartingWorkspace } from './components/StartingWorkspace';
import { ChunkingProgress } from './components/ChunkingProgress';
import { UnderstandingProgress } from './components/UnderstandingProgress';
import styles from './CreationExperience.module.css';

export function CreationExperience({ draftId, initialQuery = '', resume = false }: { draftId: string; initialQuery?: string; resume?: boolean }) {
  const creation = useCreation(draftId, initialQuery, resume);
  const { snapshot } = creation;
  const router = useRouter();
  const createOwn = async () => {
    if (await creation.createOwn()) router.push(`/quest/draft/${draftId}`);
  };
  if (creation.hydrated && snapshot.stage === 'recommendations') {
    return <CreationShell query={snapshot.result?.intent.rawQuery ?? (snapshot.query || initialQuery || 'I’m looking for something new to learn.')} saved={creation.saved}
      disabled={snapshot.status === 'running' || creation.materialPending}
      reply={snapshot.result ? <><p>Got it.</p><p>You’re looking to learn {snapshot.result.intent.topic.value}.</p>
        <p>{snapshot.result.items.length ? 'I found a few existing SideQuests that might be a good fit.' : 'Let’s make a learning journey that fits you.'}</p></> : <p>Tell me what you want to learn. I’ll look for a good place to start.</p>}
      hintTitle="Why these?" hint="These cohorts match your interest, level, and what people are currently learning. You can join one, or tell me what you’re looking for and I’ll help make a custom one."
      onMessage={creation.runQuery} suggestions={snapshot.result ? [
        { label: 'Show more advanced ones', action: () => void creation.runQuery(`${snapshot.query}\nI want more advanced material.`) },
        { label: 'I want something more practical', action: () => void creation.runQuery(`${snapshot.query}\nI want practical, hands-on learning.`) },
        { label: 'I’ll create my own instead', action: () => void createOwn() },
      ] : []}>
      {creation.message && <p role="alert">{creation.message}</p>}
      {snapshot.result ? <RecommendationResults result={snapshot.result} onCreateOwn={createOwn} /> : <RecommendationPending creation={creation} />}
    </CreationShell>;
  }
  if (creation.hydrated && snapshot.stage === 'starting_point') {
    return <CreationShell variant={snapshot.startingPoint ? 'material' : 'starting'} query={snapshot.result?.intent.rawQuery ?? snapshot.query} saved={creation.saved}
      disabled={creation.materialPending || snapshot.status === 'running'}
      reply={snapshot.startingPoint === 'have_material' ? <><p>Perfect.</p><p>Give me the material and I’ll figure out how to turn it into something learnable.</p></> : <><p>Sure.</p><p>Let’s make something that fits what you actually want.</p></>}
      hintTitle={snapshot.startingPoint ? 'You can give me multiple sources' : 'We’ll keep this simple.'}
      hint={snapshot.startingPoint ? 'A playlist, some PDFs, a GitHub repo, articles — whatever you’ve got. I’ll understand it, break it down, and turn it into a structured learning journey.' : 'You can start with the material you already have, have me find the best resources, or just tell me your goal and I’ll figure out the rest.'}
      suggestions={[
        { label: 'I have a YouTube playlist', action: () => void creation.chooseStartingPoint('have_material') },
        { label: 'Find material for me', action: () => void creation.chooseStartingPoint('find_material') },
        { label: 'I just have a goal', action: () => void creation.chooseStartingPoint('have_goal') },
      ]} onMessage={async message => {
        if (/don't|do not|no material|not sure/i.test(message)) throw new Error('Choose whether you want me to find resources or start from your goal below.');
        if (/find|recommend|resources for me/i.test(message)) await creation.chooseStartingPoint('find_material');
        else if (/just.*goal|only.*goal|have a goal/i.test(message)) await creation.chooseStartingPoint('have_goal');
        else if (/material|youtube|playlist|pdf|article|github|notion|video|file/i.test(message)) await creation.chooseStartingPoint('have_material');
        else throw new Error('Choose a starting point below, or tell me whether you have material, want resources, or just have a goal.');
      }}>
      {creation.message && <p role="alert">{creation.message}</p>}
      <StartingWorkspace creation={creation} draftId={draftId} />
    </CreationShell>;
  }
  if (creation.hydrated && snapshot.stage === 'processing' && snapshot.processing?.phase === 'understanding') {
    return <CreationShell query={snapshot.result?.intent.rawQuery ?? snapshot.query} saved={creation.saved}
      disabled={creation.materialPending} reply={<><p>I’ve got it.</p><p>{snapshot.processing.complete ? 'Your material is understood. Review the saved concepts, then continue to chunking.' : 'I’m going through your retained material and understanding what it’s about.'}</p></>}
      hintTitle="Grounded in your material" hint="Concepts appear only after source evidence is saved. Your work keeps running if you close this page."
      onMessage={message => {
        if (/concept|idea|summary|summaries/i.test(message)) document.getElementById('creation-accepted-concepts')?.scrollIntoView({ behavior: 'auto', block: 'start' });
        else throw new Error('You can view the accepted concepts here. Use the processing controls to cancel, restart or continue.');
      }} suggestions={[{ label: 'Show the extracted concepts', action: () => document.getElementById('creation-accepted-concepts')?.scrollIntoView({ behavior: 'auto', block: 'start' }) }]}>
      {creation.message && <p role="alert">{creation.message}</p>}
      <UnderstandingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
        onChunk={creation.chunkMaterial} onStart={creation.understandMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} />
    </CreationShell>;
  }
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
        {snapshot.stage === 'published' || snapshot.stage === 'finalizing' ? <PublicationStatus creation={creation} /> : snapshot.stage === 'review' ? <ReviewWorkspace creation={creation} /> : snapshot.stage === 'ready' ? <section aria-label="Curriculum ready"><h2>Curriculum ready</h2><p>Lessons and provenance are saved.</p><button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.openReview()}>Review cohort</button><button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.backToMaterials()}>Back to material</button></section> : snapshot.stage === 'processing' && snapshot.processing?.phase === 'building' ? <BuildingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
          onStart={creation.buildCurriculum} onCancel={creation.cancel} onBack={creation.backToMaterials} /> : snapshot.stage === 'processing' && snapshot.processing?.phase === 'analysis' ? <AnalysisProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
          onBuild={creation.buildCurriculum} onStart={creation.analyzeMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} /> : snapshot.stage === 'processing' && snapshot.processing?.phase === 'chunking' ? <ChunkingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
          onAnalyze={creation.analyzeMaterial} onStart={creation.chunkMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} /> : snapshot.stage === 'processing' ? <UnderstandingProgress snapshot={snapshot} disabled={!creation.saved || creation.materialPending}
          onChunk={creation.chunkMaterial} onStart={creation.understandMaterial} onCancel={creation.cancel} onBack={creation.backToMaterials} /> : snapshot.stage === 'starting_point' ? <>
          <StartingWorkspace creation={creation} draftId={draftId} />
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
