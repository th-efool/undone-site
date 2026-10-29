import React from 'react';

export type SourceIconKind = 'youtube' | 'notion' | 'github' | 'pdf' | 'text' | 'web';

export interface SourceIconProps extends React.SVGProps<SVGSVGElement> {
  kind: SourceIconKind;
  variant?: 'brand' | 'mono';
  size?: number | string;
  className?: string;
  title?: string;
}

export function SourceIcon({
  kind,
  variant = 'brand',
  size = 18,
  className = '',
  title,
  ...props
}: SourceIconProps) {
  const isBrand = variant === 'brand';
  const label = title || `${kind} source icon`;

  switch (kind) {
    case 'youtube':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <path
            d="M21.582 7.184a2.508 2.508 0 0 0-1.765-1.776C18.257 5 12 5 12 5s-6.257 0-7.817.408a2.508 2.508 0 0 0-1.765 1.776A26.31 26.31 0 0 0 2 12a26.31 26.31 0 0 0 .418 4.816 2.508 2.508 0 0 0 1.765 1.776C5.743 19 12 19 12 19s6.257 0 7.817-.408a2.508 2.508 0 0 0 1.765-1.776A26.31 26.31 0 0 0 22 12a26.31 26.31 0 0 0-.418-4.816z"
            fill={isBrand ? '#FF0000' : 'currentColor'}
          />
          <path d="m10 15 5-3-5-3v6z" fill="#FFFFFF" />
        </svg>
      );

    case 'notion':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            fill={isBrand ? '#000000' : 'currentColor'}
          />
          <path
            d="M7 7.5c.3.2.7.2 1.1 0l7.2-4.5c.4-.2.8-.2 1.1 0l.6.4c.3.2.5.5.5.8v11.6c0 .5-.3 1-.8 1.1l-1.9.4c-.4.1-.7-.1-.9-.4L9.8 9.5v6.3c0 .5-.4.9-.9.9H7.5c-.5 0-.9-.4-.9-.9V8.6c0-.5.2-.9.4-1.1z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'github':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
            fill={isBrand ? '#24292e' : 'currentColor'}
          />
        </svg>
      );

    case 'pdf':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <path
            d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
            fill={isBrand ? '#E53E3E' : 'currentColor'}
            fillOpacity={isBrand ? 0.15 : 0.2}
            stroke={isBrand ? '#E53E3E' : 'currentColor'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 2v6h6"
            stroke={isBrand ? '#E53E3E' : 'currentColor'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <text
            x="7"
            y="17"
            fontSize="6"
            fontWeight="bold"
            fontFamily="sans-serif"
            fill={isBrand ? '#E53E3E' : 'currentColor'}
          >
            PDF
          </text>
        </svg>
      );

    case 'text':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.75" />
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'web':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden={!title}
          role={title ? 'img' : 'presentation'}
          {...props}
        >
          {title && <title>{label}</title>}
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </svg>
      );
  }
}
