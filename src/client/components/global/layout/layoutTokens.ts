import React from 'react';

export type Gap = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16';

export const gapMap: Record<Gap, string> = {
  '0': '0',
  '1': 'var(--space-1)',
  '2': 'var(--space-2)',
  '3': 'var(--space-3)',
  '4': 'var(--space-4)',
  '5': 'var(--space-5)',
  '6': 'var(--space-6)',
  '8': 'var(--space-8)',
  '10': 'var(--space-10)',
  '12': 'var(--space-12)',
  '16': 'var(--space-16)',
};

export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export const justifyMap: Record<Justify, React.CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

export type Align = 'start' | 'center' | 'end' | 'stretch';

export const alignMap: Record<Align, React.CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

export type Spacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const spacingMap: Record<Spacing, string> = {
  none: '0',
  xs: 'var(--section-space-xs)',
  sm: 'var(--section-space-sm)',
  md: 'var(--section-space-md)',
  lg: 'var(--section-space-lg)',
  xl: 'var(--section-space-xl)',
};

export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export const radiusMap: Record<Radius, string> = {
  none: '0',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-pill)',
};

export type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export const paddingMap: Record<Padding, string> = {
  none: '0',
  sm: 'var(--space-4)',
  md: 'var(--space-6)',
  lg: 'var(--space-8)',
  xl: 'var(--space-10)',
};
