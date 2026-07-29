import React from 'react';
import clsx from 'clsx';

import styles from './Layout.module.css';

type ContainerSize =
  'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'reading' | 'hero' | 'wide' | 'full';

const widths: Record<Exclude<ContainerSize, 'full'>, string> = {
  xs: 'var(--container-xs)',
  sm: 'var(--container-sm)',
  md: 'var(--container-md)',
  lg: 'var(--container-lg)',
  xl: 'var(--container-xl)',
  '2xl': 'var(--container-2xl)',
  reading: '70ch',
  hero: '90rem',
  wide: '96rem',
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  as?: React.ElementType;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ as: Component = 'div', size = 'xl', className, style, children, ...props }, ref) => {
    if (size === 'full') {
      return (
        <Component
          ref={ref}
          className={clsx(styles.containerFluid, className)}
          style={style}
          {...props}
        >
          {children}
        </Component>
      );
    }

    return (
      <Component
        ref={ref}
        className={clsx(styles.container, className)}
        style={{
          maxWidth: widths[size],
          ...style,
        }}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Container.displayName = 'Container';
