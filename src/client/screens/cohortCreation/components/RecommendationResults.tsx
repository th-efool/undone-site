import Link from 'next/link';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import styles from '../CreationExperience.module.css';

export function RecommendationResults({ result, onCreateOwn }: { result: RecommendationResult; onCreateOwn: () => void }) {
  return <section aria-label="Cohort recommendations">
    <h2>Explore together</h2>
    {result.mode === 'database_fallback' && <p role="status">Showing database search results. AI ranking is unavailable.</p>}
    {!result.items.length && <p>No matching public cohorts were found. You can start your own from this intent.</p>}
    <div className={styles.cards}>
      {result.items.map(item => <article className={styles.card} key={item.cohort.cohortId}>
        {item.isBestMatch && <span>{result.mode === 'ai' ? 'Best match' : 'First search result'}</span>}
        <h3>{item.cohort.title}</h3>
        <p>{item.cohort.description}</p>
        <p>{item.reason}</p>
        <p>{item.cohort.memberCount} members · {item.cohort.lessonCount} lessons · {item.cohort.difficulty.toLowerCase()}</p>
        <Link href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}>View cohort</Link>
      </article>)}
    </div>
    <button type="button" onClick={onCreateOwn}>Create my own cohort</button>
  </section>;
}
