import React from 'react';
import clsx from 'clsx';

import styles from './Layout.module.css';
import { Align, alignMap, Gap, gapMap, Justify, justifyMap } from './layoutTokens';

export interface ClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;

  gap?: Gap;

  justify?: Justify;

  align?: Align;

  wrap?: boolean;
}

export const Cluster = React.forwardRef<HTMLDivElement, ClusterProps>(
  (
    {
      as: Component = 'div',
      gap = '4',
      justify = 'start',
      align = 'center',
      wrap = true,
      style,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <Component
      ref={ref}
      className={clsx(styles.cluster, className)}
      style={{
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: gapMap[gap],
        justifyContent: justifyMap[justify],
        alignItems: alignMap[align],
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  ),
);

Cluster.displayName = 'Cluster';
