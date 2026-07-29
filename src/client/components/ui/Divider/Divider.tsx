import React from 'react';
import clsx from 'clsx';

import styles from './Divider.module.css';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  vertical?: boolean;

  inset?: boolean;
}

export function Divider({
  vertical = false,
  inset = false,
  className,
  style,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
  ...props
}: DividerProps) {
  const decorative = ariaHidden ?? !(props.role || ariaLabel);

  return (
    <hr
      aria-hidden={decorative}
      aria-label={ariaLabel}
      className={clsx(
        styles.divider,
        vertical ? styles.vertical : styles.horizontal,
        !vertical && inset && styles.inset,
        className,
      )}
      style={style}
      {...props}
    />
  );
}
