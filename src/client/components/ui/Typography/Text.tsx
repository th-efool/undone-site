import React from 'react';
import clsx from 'clsx';
import styles from './Text.module.css';

export type TextVariant = 'body' | 'lead' | 'small' | 'muted' | 'error' | 'hint' | 'caption';

const variantClasses: Record<TextVariant, string> = {
  body: styles.body,
  lead: styles.lead,
  small: styles.small,
  muted: styles.muted,
  error: styles.error,
  hint: styles.hint,
  caption: styles.caption,
};

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  as?: React.ElementType;
}

export function Text({
  variant = 'body',
  as: Component = 'p',
  className,
  style,
  children,
  ...props
}: TextProps) {
  return (
    <Component
      className={clsx(styles.text, variantClasses[variant], className)}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Text;
