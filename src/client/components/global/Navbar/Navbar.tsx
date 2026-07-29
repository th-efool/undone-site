'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import clsx from 'clsx';

import { Button } from '@/src/client/components/ui/Button/Button';

import { Cluster } from '../layout/Cluster';
import { Container } from '../layout/Container';
import { Logo } from '../Logo/Logo';
import styles from './Navbar.module.css';

export interface NavItem {
  label: string;
  href: string;
}

export interface NavbarProps {
  links?: NavItem[];

  sticky?: boolean;

  transparent?: boolean;

  ctaLabel?: string;

  ctaHref?: string;

  className?: string;
}

const defaultLinks: NavItem[] = [
  {
    label: 'Features',
    href: '#features',
  },
  {
    label: 'Community',
    href: '#community',
  },
  {
    label: 'Pricing',
    href: '#pricing',
  },
];

/**
 * Site header with brand, primary navigation, and authentication actions.
 */
export function Navbar({
  links = defaultLinks,
  sticky = true,
  transparent = false,
  ctaLabel = 'Get Started',
  ctaHref = '/signup',
  className,
}: NavbarProps) {
  const pathname = usePathname();

  return (
    <header
      className={clsx(
        styles.root,
        {
          [styles.sticky]: sticky,
          [styles.transparent]: transparent,
          [styles.solid]: !transparent,
        },
        className,
      )}
    >
      <Container size="2xl">
        <div className={styles.inner}>
          <Logo />

          <nav
            className={styles.nav}
            aria-label="Primary Navigation"
          >
            <Cluster gap="8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={styles.link}
                  aria-current={pathname === link.href ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </Cluster>
          </nav>

          <Cluster gap="3">
            <Button variant="ghost">Login</Button>

            <Button
              as={Link}
              href={ctaHref}
            >
              {ctaLabel}
            </Button>
          </Cluster>
        </div>
      </Container>
    </header>
  );
}
