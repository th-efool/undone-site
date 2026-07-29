import Image from 'next/image';
import Link from 'next/link';

import clsx from 'clsx';

import styles from './Logo.module.css';

export interface LogoProps {
  href?: string;

  compact?: boolean;

  iconOnly?: boolean;

  variant?: 'framed' | 'plain';

  className?: string;

  priority?: boolean;
  size?: number;
}

export function Logo({
  href = '/',
  compact = false,
  iconOnly = false,
  variant = 'framed',
  className,
  priority = false,
  size,
}: LogoProps) {
  const imageSize = size ?? (variant === 'framed' ? 78 : 44);

  const image = (
    <Image
      src="/images/logos/sidequesthq-logo.webp"
      alt="SideQuestHQ logo"
      width={imageSize}
      height={imageSize}
      priority={priority}
    />
  );

  return (
    <Link
      href={href}
      className={clsx(styles.root, className)}
    >
      <div
        className={clsx({
          [styles.logoFrame]: variant === 'framed',
          [styles.logoPlain]: variant === 'plain',
        })}
        style={
          variant === 'framed' && size
            ? {
                width: size,
                height: size,
              }
            : undefined
        }
      >
        {image}
      </div>

      {!iconOnly && (
        <div className={styles.text}>
          <span className={styles.title}>SideQuestHQ</span>

          {!compact && <span className={styles.tagline}>Learn Better.</span>}
        </div>
      )}
    </Link>
  );
}
