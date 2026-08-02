import clsx from 'clsx';
import type { ComponentType, ReactNode } from 'react';

export interface CardProps {
  /** Card variant: default (subtle shadow), elevated (larger shadow), flat (no shadow) */
  variant?: 'default' | 'elevated' | 'flat';
  /** Padding size — maps to design token spacing values */
  padding?: string;
  /** Border radius size or boolean for pill shape */
  radius?: boolean | 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  /** Content slot */
  children: ReactNode;
  /** Optional header slot */
  header?: ReactNode;
  /** Optional footer slot */
  footer?: ReactNode;
  /** Additional className for customization */
  className?: string;
}

export function Card({
  variant = 'default',
  padding = 'var(--space-4)',
  radius = true,
  children,
  header,
  footer,
  className,
}: CardProps) {
  const baseClasses = clsx(
    'card',
    `card--${variant}`,
    typeof padding === 'string' ? `card--p-${padding.replace('var(', '').replace(')', '')}` : '',
    radius && 'card--rounded',
    className,
  );

  return (
    <div className={baseClasses}>
      {header && <div className="card__header">{header}</div>}
      <div className="card__body" style={{ padding }}>{children}</div>
      {footer && <div className="card__footer">{footer}</div>}
    </div>
  );
}
