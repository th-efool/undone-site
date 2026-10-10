'use client';

import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

export function ReadingSurface({ item, pending, error, onComplete }: {
  item: FeedItem; pending: boolean; error: string | null; onComplete: () => void;
}) {
  return <article aria-label="Lesson reading" style={{ overflowY: 'auto', maxHeight: '100%', padding: '2rem', width: '100%' }}>
    <p>{item.cohortTitle} · {item.lessonTitle}</p>
    <h1>{item.chunkTitle}</h1>
    {item.content?.contentOrigin === 'ai' && <p>AI-authored learning content. Check the source context and limitations below.</p>}
    {item.content?.durationMethod === 'reading_estimate' && <p>Duration is an estimated reading time.</p>}
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{item.content?.text}</div>
    {!!item.content?.limitations.length && <aside aria-label="Source limitations"><h2>Source limitations</h2><ul>
      {item.content.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}
    </ul></aside>}
    {error && <p role="alert">{error}</p>}
    <button disabled={pending} onClick={onComplete}>{pending ? 'Saving completion…' : error ? 'Retry completion' : 'Mark complete'}</button>
  </article>;
}
