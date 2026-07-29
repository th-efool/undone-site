import Image from 'next/image';
import { Play, Share2, MessageCircle, Star, Users, Bookmark } from 'lucide-react';

import type { Cohort } from '../../models';

import styles from './CohortHero.module.css';

interface CohortHeroProps {
  cohort: Cohort;
}

export function CohortHero({ cohort }: CohortHeroProps) {
  const currentQuest =
    cohort.questline.seasons
      .flatMap((season) => season.lessons)
      .find((lesson) => lesson.status === 'inStream') ?? cohort.questline.seasons[0]?.lessons[0];

  return (
    <section
      className={styles.hero}
      style={{
        backgroundImage: `linear-gradient(90deg, rgb(8 20 16 / 94%) 0%, rgb(20 69 42 / 90%) 52%, rgb(62 158 89 / 82%) 100%), url(${cohort.coverImage})`,
      }}
    >
      <div className={styles.artCard}>
        <div className={styles.artTitle}>{cohort.title.split(' ').slice(0, 2).join(' ')}</div>
        <div className={styles.wave} />
        <Image
          src={cohort.coverImage}
          alt=""
          width={210}
          height={150}
          className={styles.artImage}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.meta}>
          <span>{cohort.creator.name}</span>
          <span>{cohort.difficulty}</span>
          <span>{cohort.overview.journeySummary[0]?.value}</span>
        </div>

        <h1 className={styles.title}>{cohort.title}</h1>
        <p className={styles.description}>{cohort.description}</p>

        <div className={styles.tags}>
          {cohort.categories.map((category) => (
            <span key={category.id}>{category.label}</span>
          ))}
        </div>

        <div className={styles.leaderRow}>
          <Image
            src={cohort.creator.avatarUrl}
            alt=""
            width={42}
            height={42}
          />
          <div>
            <strong>Led by {cohort.creator.name}</strong>
            <span>{cohort.creator.role}</span>
          </div>
        </div>
      </div>

      <aside className={styles.progressPanel}>
        <div className={styles.statsRow}>
          <span>
            <Users size={16} /> {cohort.stats.explorerCount.toLocaleString()} learners
          </span>
          <span>
            <Star size={16} /> {cohort.stats.rating.toFixed(1)}
          </span>
        </div>

        <strong className={styles.percent}>{cohort.progress.journeyProgress}%</strong>
        <p className={styles.current}>Continue: {currentQuest?.title ?? cohort.title}</p>

        <div>
          <div className={styles.goalLabel}>Daily goal</div>
          <strong className={styles.goal}>{cohort.progress.dailyGoal}</strong>
          <div className={styles.track}>
            <div
              className={styles.bar}
              style={{ width: `${cohort.progress.journeyProgress}%` }}
            />
          </div>
        </div>

        <a
          className={styles.resumeButton}
          href={`/play?cohort=${cohort.id}${currentQuest ? `&lesson=${currentQuest.id}` : ''}`}
        >
          <Play
            size={16}
            fill="currentColor"
          />
          Resume lesson
        </a>

        <div className={styles.actions}>
          <a href={`/message?community=${cohort.id}`}>
            <MessageCircle size={18} /> Discuss
          </a>
          <button
            type="button"
            aria-label="Bookmark cohort"
          >
            <Bookmark size={18} />
          </button>
          <button
            type="button"
            aria-label="Share cohort"
          >
            <Share2 size={18} />
          </button>
        </div>
      </aside>
    </section>
  );
}
