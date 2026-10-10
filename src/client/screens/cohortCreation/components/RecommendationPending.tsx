'use client';
import type { useCreation } from '../hooks/useCreation';
import styles from './RecommendationResults.module.css';

export function RecommendationPending({ creation }: { creation: ReturnType<typeof useCreation> }) {
  const { snapshot } = creation;
  return <section className={styles.results} aria-label="Find cohort recommendations">
    <header className={styles.heading}><p className={styles.eyebrow}>A little curiosity goes a long way</p>
      <h1>{snapshot.status === 'running' ? 'Finding your people…' : 'What will you learn?'}</h1>
      <p className={styles.subtitle}>A learning journey starts with your curiosity.</p>
    </header>
    {snapshot.error && <div className={styles.status} role="alert"><p>{snapshot.error.message}</p></div>}
    {snapshot.status === 'running' ? <>
      <div role="status" className={styles.status}><p>Understanding your intent and finding public cohorts…</p>
        <p>You can return later; this request is saved.</p><button type="button" className={styles.retry} onClick={creation.cancel}>Cancel</button></div>
      <div className={styles.skeleton} aria-hidden="true"><div /><div /><div /></div>
    </> : <form className={styles.queryForm} onSubmit={event => {
      event.preventDefault(); const query = new FormData(event.currentTarget).get('query');
      if (typeof query === 'string') void creation.runQuery(query);
    }}>
      {snapshot.status === 'canceled' && <p role="status">Generation stopped. Your query is still here.</p>}
      <label htmlFor="learning-query">Your learning query</label>
      <textarea id="learning-query" name="query" defaultValue={snapshot.query} minLength={3} maxLength={2000} required rows={3} />
      <button className={styles.retry} type="submit">{snapshot.status === 'canceled' || snapshot.error?.retryable ? 'Retry' : 'Find cohorts'}</button>
    </form>}
  </section>;
}
