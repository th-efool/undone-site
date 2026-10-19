import styles from './TrendingContentCard.module.css';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, CirclePlus } from 'lucide-react';
import type { AvatarPreview, SideQuest } from '@/src/client/screens/dashboard/explore/models';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';

export interface TrendingCourseCardItem {
  id?: string;
  cohortId?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  thumbnail?: string;
  dailyGoal?: string;
  categories?: string[];
  featuredParticipants?: AvatarPreview[];
  participantCount?: string | number;
  href?: string;
}

export interface TrendingContentCardProps {
  item?: TrendingCourseCardItem | SideQuest;
  showPullTab?: boolean;
}

export function TrendingContentCard({ item, showPullTab = true }: TrendingContentCardProps) {
  const quest = item as (TrendingCourseCardItem & Partial<SideQuest>) | undefined;
  const title = quest?.title ?? 'Your Content\nin a Bottle';
  const description =
    quest?.subtitle ?? quest?.description ?? 'Consumption detox. Curate\nwhat you actually want.';
  const imageSrc =
    quest?.coverImage ?? quest?.thumbnail ?? '/images/mobile/explore/bottle-content-mobile.webp';
  const categories: string[] =
    quest?.categories && quest.categories.length > 0
      ? quest.categories.slice(0, 4)
      : quest?.dailyGoal
        ? [quest.dailyGoal, 'mindful learning', 'focus']
        : ['content curation', 'mindful learning', 'productivity', 'focus'];

  const rawCount = quest?.participantCount;
  const participantCount =
    typeof rawCount === 'number'
      ? `${rawCount}`
      : typeof rawCount === 'string'
        ? rawCount.replace(/[^0-9kK.]/g, '') || '31'
        : '31';

  const href =
    quest?.href ??
    (quest?.cohortId || quest?.id ? getCohortHref((quest.cohortId ?? quest.id)!) : undefined);

  const featuredParticipants = quest?.featuredParticipants ?? [];
  const hasCustomAvatars = featuredParticipants.length > 0;

  return (
    <div className={styles.outerContainer}>
      {showPullTab && (
        <div className={styles.pullTabContainer}>
          <div className={styles.pullTab}></div>
        </div>
      )}

      <div className={styles.cardContainer}>
        {/* Background Layer */}
        <div className={styles.background}>
          <Image
            src={imageSrc}
            alt={title}
            fill
            className={styles.image}
          />
          <div className={styles.gradientOverlay}></div>
        </div>

        {/* Content Layer */}
        <div className={styles.content}>
          <div className={styles.topBadge}>
            <span className={styles.dot}></span>
            <span className={styles.badgeText}>trending</span>
          </div>

          <div className={styles.mainInfo}>
            <h2 className={styles.title}>
              {href ? (
                <Link href={href} className={styles.titleLink}>
                  {title}
                </Link>
              ) : (
                title
              )}
            </h2>
            <p className={styles.description}>{description}</p>
          </div>

          <div className={styles.tagsRow}>
            {categories.map((tag: string) => (
              <div key={tag} className={styles.tag}>
                {tag}
              </div>
            ))}
          </div>

          <div className={styles.metadata}>
            <Bookmark className={styles.metaIcon} size={16} />
            <span className={styles.metaText}>
              <span className={styles.underline}>saved from</span> Undone &bull; 4 hours ago
            </span>
          </div>

          <div className={styles.actionBar}>
            <div className={styles.actionLeft}>
              <div className={styles.avatarsSmall}>
                {hasCustomAvatars ? (
                  featuredParticipants.slice(0, 3).map((avatar, idx) => (
                    <Image
                      key={avatar.id ?? idx}
                      src={avatar.image}
                      alt={avatar.alt ?? 'Avatar'}
                      width={28}
                      height={40}
                      className={styles.avatarSmall}
                      style={{ zIndex: 3 - idx }}
                    />
                  ))
                ) : (
                  <>
                    <Image
                      src="/mock/avatars/d.webp"
                      alt="Avatar"
                      width={28}
                      height={40}
                      className={styles.avatarSmall}
                      style={{ zIndex: 3 }}
                    />
                    <Image
                      src="/mock/avatars/e.webp"
                      alt="Avatar"
                      width={28}
                      height={40}
                      className={styles.avatarSmall}
                      style={{ zIndex: 2 }}
                    />
                    <Image
                      src="/mock/avatars/f.webp"
                      alt="Avatar"
                      width={28}
                      height={40}
                      className={styles.avatarSmall}
                      style={{ zIndex: 1 }}
                    />
                  </>
                )}
              </div>
              <span className={styles.actionCount}>{participantCount}</span>
            </div>
            <div className={styles.actionRight}>
              {href ? (
                <Link href={href} className={styles.actionBtn}>
                  View Quest &rarr;
                </Link>
              ) : (
                <>
                  <button type="button" className={styles.actionBtn}>
                    <Bookmark size={14} />
                    want to try
                  </button>
                  <button type="button" className={styles.actionBtn}>
                    <CirclePlus size={14} />
                    visited
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
