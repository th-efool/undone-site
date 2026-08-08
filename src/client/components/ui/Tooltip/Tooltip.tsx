'use client';

import React, { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import styles from './Tooltip.module.css';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 150,
  disabled = false,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsRendered(true);
      // Small tick to ensure CSS transition triggers cleanly
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, delay);
  }, [disabled, content, delay]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    timerRef.current = setTimeout(() => {
      setIsRendered(false);
    }, 120); // match transition duration
  }, []);

  if (disabled || !content) {
    return children;
  }

  return (
    <div
      className={clsx(styles.wrapper, className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isRendered && (
        <div
          role="tooltip"
          aria-hidden={!isVisible}
          className={clsx(
            styles.tooltip,
            styles[placement],
            isVisible && styles.visible
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
