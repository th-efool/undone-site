import React from 'react';
import clsx from 'clsx';
import styles from './Heading.module.css';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type Level = HeadingLevel;
type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span';
export type HeadingRole = 'display' | 'ui-title' | 'section' | 'card';

const levelClasses: Record<Level, string> = {
  1: styles.level1,
  2: styles.level2,
  3: styles.level3,
  4: styles.level4,
  5: styles.level5,
  6: styles.level6,
};

const roleClasses: Record<HeadingRole, string> = {
  'ui-title': styles.uiTitle,
  card: styles.cardTitle,
  section: styles.sectionTitle,
  display: styles.displayTitle,
};

export interface HeadingProps extends React.HTMLAttributes<HTMLElement> {
  level?: Level;
  as?: HeadingElement;
  uiRole?: HeadingRole;
}

export function Heading({
  level = 2,
  as,
  uiRole,
  className,
  style,
  children,
  role,
  'aria-level': ariaLevel,
  ...props
}: HeadingProps) {
  const Component = (as ?? `h${level}`) as HeadingElement;
  const needsHeadingSemantics = Component === 'div' || Component === 'span';

  const roleClass = uiRole ? roleClasses[uiRole] : undefined;

  return (
    <Component
      className={clsx(styles.heading, roleClass || levelClasses[level], className)}
      role={role ?? (needsHeadingSemantics ? 'heading' : undefined)}
      aria-level={ariaLevel ?? (needsHeadingSemantics ? level : undefined)}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Heading;
