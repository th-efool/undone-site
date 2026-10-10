import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Clock3, Compass, Star, Users } from 'lucide-react';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import styles from './RecommendationResults.module.css';
import { InkUnderline } from './InkUnderline';

export function RecommendationResults({ result, onCreateOwn }: { result: RecommendationResult; onCreateOwn: () => void }) {
  return <section aria-label="Cohort recommendations" className={styles.results}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>People are already learning this</p>
      <h1>{result.intent.topic.value}<InkUnderline className={styles.underline} /></h1>
      <p className={styles.subtitle}>I found a few ways you could jump in.</p>
      <span className={styles.annotation} aria-hidden="true">Real people.<br />Real progress.<br />Join a community<br />that’s learning.</span>
    </header>
    {result.mode === 'database_fallback' && <p role="status" className={styles.status}>Showing database search results. AI ranking is unavailable.</p>}
    {!result.items.length && <div className={styles.empty}><Compass size={32} strokeWidth={1.5} /><h2>A new path starts here.</h2>
      <p>No matching public cohorts were found. You can start your own from this intent.</p></div>}
    <div className={styles.cards}>
      {result.items.map((item, index) => <article className={styles.card} data-featured={index === 0} key={item.cohort.cohortId}>
        <div className={styles.art}>
          {item.cohort.coverImage ? <Image src={item.cohort.coverImage} alt="" fill unoptimized sizes={index === 0 ? '460px' : '200px'} /> :
            <div className={styles.missingCover} aria-label="No cover image"><BookOpen size={index === 0 ? 68 : 42} strokeWidth={1} /><span>Learn something<br />that stays with you.</span></div>}
        </div>
        <div className={styles.cardBody}>
          {item.isBestMatch && <span className={styles.badge}><Star size={14} fill="currentColor" aria-hidden="true" />{result.mode === 'ai' ? 'Best match' : 'First search result'}</span>}
          <h2><Link href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}>{item.cohort.title}</Link></h2>
          <p className={styles.description}>{item.cohort.description || item.reason}</p>
          <div className={styles.metrics}>
            <span><Users size={24} strokeWidth={1.5} aria-hidden="true" /><span><strong>{item.cohort.memberCount.toLocaleString('en-US')}</strong><small>learning</small></span></span>
            <span><BookOpen size={22} strokeWidth={1.5} aria-hidden="true" /><span><strong>{item.cohort.lessonCount}</strong><small>lessons</small></span></span>
            {item.cohort.estimatedCompletionTime && <span><Clock3 size={23} strokeWidth={1.5} aria-hidden="true" /><span><strong>{item.cohort.estimatedCompletionTime}</strong><small>total length</small></span></span>}
          </div>
          <ul className={styles.tags} aria-label="Cohort details"><li>{item.cohort.difficulty.charAt(0) + item.cohort.difficulty.slice(1).toLowerCase()}</li>
            {item.cohort.categories.slice(0, index === 0 ? 3 : 2).map(category => <li key={category}>{category}</li>)}
          </ul>
          <Link className={styles.join} href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`} aria-label={`Join ${item.cohort.title}`}>
            {index === 0 ? 'Join this cohort' : 'Join cohort'} <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className={styles.srOnly}>{item.reason}</p>
        </div>
      </article>)}
    </div>
    <footer className={styles.create}><span className={styles.compass}><Compass size={26} strokeWidth={1.5} aria-hidden="true" /></span>
      <div><strong>Not quite what you’re looking for?</strong><p>Tell me more, or create your own cohort and I’ll help you build it.</p></div>
      <button type="button" onClick={onCreateOwn}>Create my own cohort <ArrowRight size={18} aria-hidden="true" /></button>
    </footer>
  </section>;
}
