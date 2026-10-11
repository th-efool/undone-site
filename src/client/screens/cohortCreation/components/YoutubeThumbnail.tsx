'use client';
import { useState } from 'react';
import { Video } from 'lucide-react';
import styles from './YoutubeThumbnail.module.css';

/** The authoritative unit ID supplies artwork; generated titles never supply URLs. */
export function YoutubeThumbnail({ videoId }: { videoId: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const valid = /^[A-Za-z0-9_-]{11}$/.test(videoId);
  return <span className={styles.thumbnail} aria-hidden="true">
    {valid && failedId !== videoId ?
      // Public YouTube artwork is intentionally loaded directly; no private asset proxy.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" width={480} height={270}
        loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedId(videoId)} /> :
      <Video size={22} />}
  </span>;
}
