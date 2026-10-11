'use client';
import { useState } from 'react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import styles from './RecommendationResults.module.css';

function usableCover(value: string | null) {
  if (!value) return null;
  try {
    const relative = value.startsWith('/') && !value.startsWith('//');
    const url = new URL(value, relative ? 'https://local.invalid' : undefined);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      relative && url.origin !== 'https://local.invalid') return null;
    return value;
  } catch { return null; }
}
export function RecommendationCover({ src, featured }: { src: string | null; featured: boolean }) {
  const [failed, setFailed] = useState<string | null>(null); const image = usableCover(src);
  return image && failed !== image ? <Image src={image} alt="" fill unoptimized sizes={featured ? '460px' : '200px'} onError={() => setFailed(image)} />
    : <div className={styles.missingCover} aria-label={src ? 'Cover image unavailable' : 'No cover image'}>
      <BookOpen size={featured ? 68 : 42} strokeWidth={1} /><span>Learn something<br />that stays with you.</span></div>;
}
