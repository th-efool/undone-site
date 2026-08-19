import styles from './TrendingContentCard.module.css';
import Image from 'next/image';
import { Bookmark, CirclePlus } from 'lucide-react';

export function TrendingContentCard() {
  return (
    <div className={styles.outerContainer}>
      <div className={styles.pullTabContainer}>
         <div className={styles.pullTab}></div>
      </div>
      
      <div className={styles.cardContainer}>
        {/* Background Layer */}
        <div className={styles.background}>
          <Image
            src="/images/mobile/explore/bottle-content-mobile.webp"
            alt="Bottle content artwork"
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
              Your Content<br />in a Bottle
            </h2>
            <p className={styles.description}>
              Consumption detox. Curate<br />what you actually want.
            </p>
          </div>

          <div className={styles.tagsRow}>
            <div className={styles.tag}>content curation</div>
            <div className={styles.tag}>mindful learning</div>
            <div className={styles.tag}>productivity</div>
            <div className={styles.tag}>focus</div>
          </div>

          <div className={styles.metadata}>
            <Bookmark className={styles.metaIcon} size={16} />
            <span className={styles.metaText}>
              <span className={styles.underline}>saved from</span> SideQuestHQ &bull; 4 hours ago
            </span>
          </div>

          <div className={styles.actionBar}>
            <div className={styles.actionLeft}>
              <div className={styles.avatarsSmall}>
                <Image src="/mock/avatars/d.webp" alt="Avatar" width={28} height={40} className={styles.avatarSmall} style={{ zIndex: 3 }} />
                <Image src="/mock/avatars/e.webp" alt="Avatar" width={28} height={40} className={styles.avatarSmall} style={{ zIndex: 2 }} />
                <Image src="/mock/avatars/f.webp" alt="Avatar" width={28} height={40} className={styles.avatarSmall} style={{ zIndex: 1 }} />
              </div>
              <span className={styles.actionCount}>31</span>
            </div>
            <div className={styles.actionRight}>
              <button className={styles.actionBtn}>
                <Bookmark size={14} />
                want to try
              </button>
              <button className={styles.actionBtn}>
                <CirclePlus size={14} />
                visited
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
