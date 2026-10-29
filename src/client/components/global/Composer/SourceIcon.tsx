import React from 'react';
import type { SourceKind } from '@/src/shared/cohort-builder/source-kind';

export type SourceIconKind = SourceKind | 'text';

export interface SourceIconProps {
  kind: SourceIconKind;
  size?: number;
  className?: string;
  /** When set the icon is exposed to assistive tech; otherwise it is decorative. */
  title?: string;
}

const STROKE = { stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

const ICONS: Record<SourceIconKind, React.ReactNode> = {
  youtube: (
    <>
      <path fill="#FF0000" d="M21.58 7.18a2.5 2.5 0 0 0-1.77-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.41A2.5 2.5 0 0 0 2.42 7.18 26.3 26.3 0 0 0 2 12c0 1.63.14 3.25.42 4.82a2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.41a2.5 2.5 0 0 0 1.77-1.77c.28-1.57.41-3.19.41-4.82s-.13-3.25-.42-4.82z" />
      <path fill="#fff" d="m10 15 5-3-5-3z" />
    </>
  ),
  notion: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#000" />
      <path fill="#fff" d="M8 7.5h1.6l5.2 7V7.5H16v9h-1.5l-5.3-7.1v7.1H8z" />
    </>
  ),
  github: (
    <path fill="#24292e" fillRule="evenodd" clipRule="evenodd" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  ),
  pdf: (
    <>
      <path {...STROKE} stroke="#E53E3E" fill="#E53E3E" fillOpacity={0.15} d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM14 2v6h6" />
      <text x="6.5" y="17" fontSize="6" fontWeight="bold" fontFamily="sans-serif" fill="#E53E3E">PDF</text>
    </>
  ),
  text: (
    <>
      <path {...STROKE} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  web: (
    <>
      <circle {...STROKE} cx="12" cy="12" r="10" />
      <path {...STROKE} d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
};

export function SourceIcon({ kind, size = 18, className, title }: SourceIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {ICONS[kind] ?? ICONS.web}
    </svg>
  );
}
