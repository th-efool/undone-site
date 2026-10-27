'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'outline'
  | 'momentum'
  | 'danger';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ButtonOwnProps<T extends React.ElementType = 'button'> = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  as?: T;
};

export type ButtonProps<T extends React.ElementType = 'button'> = ButtonOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export function Button<T extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconOnly = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}: ButtonProps<T>) {
  const Component = (as ?? 'button') as React.ElementType;
  const isButton = Component === 'button';
  const isDisabled = Boolean(disabled || loading);

  // Map legacy danger variant to destructive
  const resolvedVariantClass =
    variant === 'destructive' || variant === 'danger'
      ? styles.destructive
      : styles[variant] || styles.primary;

  return (
    <Component
      className={clsx(
        styles.root,
        resolvedVariantClass,
        styles[size],
        {
          [styles.block]: fullWidth,
          [styles.icon]: iconOnly,
          [styles.loading]: loading,
        },
        className,
      )}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      {...(isButton ? { disabled: isDisabled } : {})}
      {...props}
    >
      {loading ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          {children}
        </>
      ) : (
        <>
          {leftIcon && <span className={styles.leftIcon} aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span className={styles.rightIcon} aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </Component>
  );
}

export default Button;
