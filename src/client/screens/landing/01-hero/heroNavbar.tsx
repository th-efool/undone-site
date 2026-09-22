'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './heroNavbar.module.css';
import { useSession } from 'next-auth/react';

const navigationItems = [
  { label: 'Product', href: '/auth' },
  { label: 'Cohorts', href: '/auth' },
];

export function HeroNavbar() {
  const { data: session } = useSession();
  const destination = session ? '/home' : '/auth';
  const logoDestination = session ? '/home' : '/';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href={logoDestination}
          className={styles.brand}
        >
          <div className={styles.logoFrame}>
            <Image
              src="/logos/sidequesthq-logo-no-book-compass.svg"
              alt="SideQuestHQ"
              width={78}
              height={78}
              priority
              className={styles.logoImage}
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
            href={destination}
            className={styles.signupLink}
          >
            Join
            <span>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
