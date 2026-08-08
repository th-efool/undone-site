import Image from 'next/image';
import Link from 'next/link';
import styles from './heroNavbar.module.css';

const navigationItems = [
  { label: 'Product', href: '/auth' },
  { label: 'Cohorts', href: '/auth' },
];

export function HeroNavbar() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href="/auth"
          className={styles.brand}
        >
          <div className={styles.logoFrame}>
            <Image
              src="/images/logos/sidequesthq-logo.svg"
              alt="SideQuestHQ"
              width={78}
              height={78}
              priority
            />
          </div>

          <span className={styles.brandName}>SideQuestHQ</span>
        </Link>

        <nav className={styles.nav}>
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.auth}>
          <Link
            href="/auth"
            className={styles.loginLink}
          >
            Log in
          </Link>

          <Link
            href="/auth"
            className={styles.signupLink}
          >
            Start Your Next SideQuest
            <span>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
