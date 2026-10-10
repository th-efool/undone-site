import type { ImgHTMLAttributes, AnchorHTMLAttributes } from 'react';
export default function Image({ fill, priority: _priority, unoptimized: _unoptimized, sizes, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) {
  void _priority; void _unoptimized;
  // Native img deliberately isolates screenshot rendering from the Next image server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} sizes={sizes} alt={props.alt ?? ''} style={{ ...props.style, ...(fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : {}) }} />;
}
export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
export function useRouter() { return { push: () => {}, replace: () => {}, refresh: () => {} }; }
