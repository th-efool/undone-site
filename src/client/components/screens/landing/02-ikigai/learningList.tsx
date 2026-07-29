import Image from 'next/image';
import styles from './learningList.module.css';

type LearningItem = {
  platform: 'youtube' | 'coursera';
  title: string;
  hours: string;
  units: string;
};

const ITEMS: LearningItem[] = [
  {
    platform: 'youtube',
    title: 'Machine Learning in 2 Weeks',
    hours: '26h total',
    units: '14 videos',
  },
  {
    platform: 'coursera',
    title: 'Android Developer (Coursera)',
    hours: '28h total',
    units: '17 modules',
  },
  {
    platform: 'youtube',
    title: 'Medieval History Animated',
    hours: '22h total',
    units: '48 videos',
  },
];

export function LearningList() {
  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>
        Small moments.
        <br />
        Real progress.
      </h2>

      <p className={styles.description}>
        Your Interstitial Time adds up when
        <br />
        SideQuestHQ keeps you consistent.
      </p>

      <div className={styles.list}>
        {ITEMS.map((item) => (
          <div
            key={item.title}
            className={styles.card}
          >
            <div className={styles.left}>
              <Image
                src={
                  item.platform === 'youtube'
                    ? '/images/icons/youtube.webp'
                    : '/images/icons/coursera.webp'
                }
                alt=""
                width={24}
                height={24}
                className={styles.icon}
              />

              <span className={styles.course}>{item.title}</span>
            </div>

            <div className={styles.right}>
              <span>{item.hours}</span>

              <span className={styles.dot}>•</span>

              <span>{item.units}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
