'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Check, Copy, ExternalLink, Globe, Link2, LockKeyhole, PartyPopper, Play, UsersRound, X } from 'lucide-react';
import type { PublicationReceipt } from '@/src/shared/cohort-creation/publication';
import { useTheme } from '@/src/client/hooks/useTheme';
import styles from './PublicationSuccess.module.css';
const subscribeOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const serverOrigin = () => '';

export function PublicationSuccess({ receipt, title }: { receipt: PublicationReceipt; title: string }) {
  const [open, setOpen] = useState(true); const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const input = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const origin = useSyncExternalStore(subscribeOrigin, getOrigin, serverOrigin);
  const publicCohort = receipt.mode === 'public_publish'; const path = `/cohort/${encodeURIComponent(receipt.cohortId)}`;
  const copyOrShare = async (share: boolean) => {
    if (lock.current) return; lock.current = true; setBusy(true); setFeedback(null);
    const url = new URL(path, window.location.origin).href;
    try {
      if (share && navigator.share) { await navigator.share({ title, url }); setFeedback('Share completed.'); }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setFeedback('Link copied.'); }
      else { setFeedback('Copy is unavailable. Select the link and copy it manually.'); input.current?.focus(); input.current?.select(); }
    } catch (error) {
      const canceled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      if (!canceled) { setFeedback('The link could not be shared or copied. Select it and copy manually.'); input.current?.focus(); input.current?.select(); }
    } finally { lock.current = false; setBusy(false); }
  };
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button className={styles.reopen}>View completion details</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} />
      <Dialog.Content className={styles.dialog} data-theme={theme} aria-describedby="publication-success-description" onPointerDownOutside={event => event.preventDefault()}>
        <Dialog.Close className={styles.close} aria-label="Close completion details"><X size={22} aria-hidden="true" /></Dialog.Close>
        <header className={styles.header}><div className={styles.celebration} aria-hidden="true"><PartyPopper size={48} strokeWidth={1.6} /></div>
          <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div>
          <Dialog.Title className={styles.title}>{publicCohort ? 'Your cohort is live!' : 'Your private cohort is ready'}</Dialog.Title>
          <Dialog.Description id="publication-success-description" className={styles.subtitle}>{publicCohort ? 'It’s now public and anyone can discover it.' : 'Only you and authorized members can access it.'}</Dialog.Description>
        </header>
        <div className={styles.linkRow}><Link2 size={26} aria-hidden="true" /><input ref={input} aria-label="Cohort link" readOnly value={`${origin}${path}`} onFocus={event => event.currentTarget.select()} />
          <button disabled={busy} onClick={() => void copyOrShare(false)}>{feedback === 'Link copied.' ? <Check size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}{feedback === 'Link copied.' ? 'Copied' : 'Copy'}</button></div>
        {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
        <div className={styles.visibility}>{publicCohort ? <Globe size={29} aria-hidden="true" /> : <LockKeyhole size={29} aria-hidden="true" />}<div><strong>Visibility: {publicCohort ? 'Public' : 'Private'}</strong><p>{publicCohort ? 'Anyone can discover this cohort.' : 'Sharing a link does not grant access.'}</p></div><Check size={20} aria-label="Committed" /></div>
        <section className={styles.next}><h3>What’s next?</h3><div className={styles.tiles}>
          <Link href={path} aria-label="View cohort"><ExternalLink size={25} aria-hidden="true" /><strong>View cohort</strong><span>Open your cohort page</span></Link>
          <button disabled={busy} onClick={() => void copyOrShare(true)}><UsersRound size={26} aria-hidden="true" /><strong>Share</strong><span>{publicCohort ? 'Invite friends or community' : 'Share with authorized members'}</span></button>
          <Link href={`/play?cohort=${encodeURIComponent(receipt.cohortId)}`} aria-label="Start learning"><Play size={25} aria-hidden="true" /><strong>Start learning</strong><span>Explore your learning feed</span></Link>
        </div></section>
        <footer className={styles.footer}><Dialog.Close className={styles.done}>Done <ArrowRight size={23} aria-hidden="true" /></Dialog.Close></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
