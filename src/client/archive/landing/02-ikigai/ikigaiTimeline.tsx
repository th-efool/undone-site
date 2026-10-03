import styles from './ikigaiTimeline.module.css';
import Image from 'next/image';

const moments = [
  {
    image: '/images/landing/coffee-break.webp',
    time: '7:48 AM',
    label: 'Coffee break',
  },
  {
    image: '/images/landing/metro-ride.webp',
    time: '8:21 AM',
    label: 'Metro ride',
  },
  {
    image: '/images/landing/waiting.webp',
    time: '1:14 PM',
    label: 'Waiting for food',
  },
  {
    image: '/images/landing/cab-ride.webp',
    time: '6:22 PM',
    label: 'Cab ride',
  },
  {
    image: '/images/landing/before-sleep.webp',
    time: '10:37 PM',
    label: 'Before bed',
  },
];

export function IkigaiTimeline() {
  return (
    <section className={styles.timeline}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>THE HIDDEN HOURS</span>

        <h2 className={styles.title}>
          Most of your day
          <br />
          is <span>Interstitial.</span>
        </h2>

        <p className={styles.description}>
          Tiny pockets of time appear all day long. Too short for traditional learning. Long enough
          to keep your curiosity alive.
        </p>

        <div className={styles.definition}>
          <div className={styles.definitionIcon}>
            <Image
              src="/icons/128/Book.webp"
              alt=""
              width={26}
              height={26}
              draggable={false}
            />
          </div>

          <div className={styles.definitionContent}>
            <div className={styles.definitionTitle}>
              Interstitial Time <span className={styles.definitionType}>(noun)</span>
            </div>

            <p className={styles.definitionText}>
              The small, in-between pockets of time that occur naturally throughout your day waiting
              for coffee, commuting, standing in line, or before bed. Individually they feel
              insignificant. Collectively they add up to hours every week.
            </p>
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.carousel}>
          <button
            className={styles.arrow}
            aria-label="Previous"
          >
            ←
          </button>

          <div className={styles.cards}>
            {moments.map((moment) => (
              <article
                key={moment.time}
                className={styles.card}
              >
                <div className={styles.imageWrapper}>
                  <Image
                    src={moment.image}
                    alt={moment.label}
                    fill
                    sizes="220px"
                    className={styles.image}
                    draggable={false}
                  />
                </div>

                <div className={styles.overlay}>
                  <span className={styles.time}>{moment.time}</span>

                  <span className={styles.label}>{moment.label}</span>
                </div>
              </article>
            ))}
          </div>

          <button
            className={styles.arrow}
            aria-label="Next"
          >
            →
          </button>
        </div>

        <div className={styles.footer}>
          <span>These moments add up.</span>

          <span className={styles.separator}>|</span>

          <strong>You already have the time.</strong>

          <span className={styles.separator}>|</span>

          <span>Let&#39;s use it.</span>
        </div>
      </div>
    </section>
  );
}
