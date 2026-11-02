import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Clock3, Compass, Plus, Rocket, Star, Users } from 'lucide-react';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import styles from './RecommendationResults.module.css';
import { InkUnderline } from './InkUnderline';
import { RecommendationCover } from './RecommendationCover';

export function RecommendationResults({ result, onCreateOwn }: { result: RecommendationResult; onCreateOwn: () => void }) {
  const hasItems = result.items.length > 0;

  return (
    <section aria-label="Cohort recommendations" className={styles.results}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>{hasItems ? 'People are already learning this' : 'Make room for your curiosity'}</p>
        <h1>
          {result.intent.topic.value}
          <InkUnderline className={styles.underline} />
        </h1>
        <p className={styles.subtitle}>
          {hasItems ? 'I found a few ways you could jump in.' : 'No matching public cohorts yet. Start a new learning journey.'}
        </p>
        {hasItems && (
          <span className={styles.annotation} aria-hidden="true">
            Real people.
            <br />
            Real progress.
            <br />
            Join a community
            <br />
            that’s learning.
          </span>
        )}
      </header>

      {result.mode === 'database_fallback' && (
        <p role="status" className={styles.status}>
          Showing database search results. AI assistance is unavailable.
        </p>
      )}

      {!hasItems ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustrationWrap}>
            <Image
              src="/images/no-cohort-found-illustration.png"
              alt="Stack of books, glowing lantern, treasure map, and compass"
              className={styles.emptyIllustration}
              width={420}
              height={164}
              priority
            />
          </div>

          <h2 className={styles.emptyTitle}>A new path starts here.</h2>
          <p className={styles.emptySubtitle}>
            No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community.
          </p>

          <button
            type="button"
            className={styles.emptyPrimaryCta}
            onClick={onCreateOwn}
            aria-label="Create your own cohort"
          >
            <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>Create your own cohort</span>
            <ArrowRight size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className={styles.emptyFeatures} role="list" aria-label="Cohort creation highlights">
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <Users size={15} strokeWidth={1.9} />
              </span>
              <span>Bring like-minded learners</span>
            </div>
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <BookOpen size={15} strokeWidth={1.9} />
              </span>
              <span>Organize your learning</span>
            </div>
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <Rocket size={15} strokeWidth={1.9} />
              </span>
              <span>Build in public (or keep it private)</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.cards}>
            {result.items.map((item, index) => (
              <article className={styles.card} data-featured={index === 0} key={item.cohort.cohortId}>
                <div className={styles.art}>
                  <RecommendationCover src={item.cohort.coverImage} featured={index === 0} />
                </div>
                <div className={styles.cardBody}>
                  {item.isBestMatch && (
                    <span className={styles.badge}>
                      <Star size={14} fill="currentColor" aria-hidden="true" />
                      {result.mode === 'ai' ? 'Best match' : 'First search result'}
                    </span>
                  )}
                  <h2>
                    <Link href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}>{item.cohort.title}</Link>
                  </h2>
                  <p className={styles.description}>{item.cohort.description || item.reason}</p>
                  <div className={styles.metrics}>
                    <span>
                      <Users size={24} strokeWidth={1.5} aria-hidden="true" />
                      <span>
                        <strong>{item.cohort.memberCount.toLocaleString('en-US')}</strong>
                        <small>learning</small>
                      </span>
                    </span>
                    <span>
                      <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
                      <span>
                        <strong>{item.cohort.lessonCount}</strong>
                        <small>lessons</small>
                      </span>
                    </span>
                    {item.cohort.estimatedCompletionTime && (
                      <span>
                        <Clock3 size={23} strokeWidth={1.5} aria-hidden="true" />
                        <span>
                          <strong>{item.cohort.estimatedCompletionTime}</strong>
                          <small>total length</small>
                        </span>
                      </span>
                    )}
                  </div>
                  <ul className={styles.tags} aria-label="Cohort details">
                    <li>{item.cohort.difficulty.charAt(0) + item.cohort.difficulty.slice(1).toLowerCase()}</li>
                    {item.cohort.categories.slice(0, index === 0 ? 3 : 2).map(category => (
                      <li key={category}>{category}</li>
                    ))}
                  </ul>
                  <Link
                    className={styles.join}
                    href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}
                    aria-label={`Join ${item.cohort.title}`}
                  >
                    {index === 0 ? 'Join this cohort' : 'Join cohort'} <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <p className={styles.srOnly}>{item.reason}</p>
                </div>
              </article>
            ))}
          </div>
          <footer className={styles.create}>
            <span className={styles.compass}>
              <Compass size={26} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong>Not quite what you’re looking for?</strong>
              <p>Tell me more, or create your own cohort and I’ll help you build it.</p>
            </div>
            <button type="button" onClick={onCreateOwn}>
              Create my own cohort <ArrowRight size={18} aria-hidden="true" />
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
