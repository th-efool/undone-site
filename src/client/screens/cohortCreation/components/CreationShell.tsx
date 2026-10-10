'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUp, Lightbulb, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ThemeToggle } from '@/src/client/screens/landing/Hero/components/ThemeToggle';
import { useTheme } from '@/src/client/hooks/useTheme';
import styles from './CreationShell.module.css';

export type CreationShellProps = {
  children: ReactNode;
  query: string;
  reply: ReactNode;
  hintTitle: string;
  hint: string;
  suggestions?: { label: string; action: () => void }[];
  onMessage: (message: string) => Promise<void> | void;
  disabled?: boolean;
  saved?: boolean;
  variant?: 'recommendations' | 'starting' | 'material';
};

/** Conversation is an interaction surface. Commands and durable state stay in useCreation. */
export function CreationShell({ children, query, reply, hintTitle, hint, suggestions = [], onMessage,
  disabled = false, saved = true, variant = 'recommendations' }: CreationShellProps) {
  const [message, setMessage] = useState(''); const [collapsed, setCollapsed] = useState(false);
  const { theme, isDark } = useTheme();
  return <main id="main-content" className={styles.page} data-theme={theme} data-variant={variant} data-rail-collapsed={collapsed}>
    <aside className={styles.rail} aria-label="Creation conversation">
      <header className={styles.brandHeader}>
        <Link className={styles.brand} href="/" aria-label="Undone home">
          <Image src={isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg'} width={42} height={42} alt="" priority />
          <span><strong>UNDONE</strong><em>For a more curious you.</em></span>
        </Link>
        <button type="button" className={styles.railToggle} onClick={() => setCollapsed(value => !value)}
          aria-label={collapsed ? 'Expand conversation' : 'Collapse conversation'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </header>
      <div className={styles.railBody}>
        <div className={styles.messages}>
          <div className={styles.messageRow}><span className={styles.youAvatar} aria-hidden="true">Y</span>
            <div className={styles.userBubble}><span className={styles.sender}>You</span><p>{query}</p></div>
          </div>
          <div className={styles.messageRow}><Image className={styles.assistantAvatar} src="/undone-logo-transparent.svg" width={34} height={34} alt="" />
            <div className={styles.assistantBubble}><span className={styles.sender}>Undone</span><div>{reply}</div></div>
          </div>
          <div className={styles.hint}><Lightbulb size={27} strokeWidth={1.3} aria-hidden="true" /><div><strong>{hintTitle}</strong><p>{hint}</p></div></div>
        </div>
        <div className={styles.composerArea}>
          <form className={styles.composer} onSubmit={async event => {
            event.preventDefault(); if (disabled || message.trim().length < 3) return;
            await onMessage(message.trim()); setMessage('');
          }}>
            <label className={styles.srOnly} htmlFor="creation-conversation-message">Say anything</label>
            <textarea id="creation-conversation-message" placeholder="Say anything…" value={message} maxLength={2000} minLength={3}
              rows={1} required disabled={disabled} onChange={event => setMessage(event.target.value)} />
            <button type="submit" disabled={disabled || message.trim().length < 3} aria-label="Send message"><ArrowUp size={22} /></button>
          </form>
          <div className={styles.suggestions}>{suggestions.map(suggestion => <button type="button" key={suggestion.label}
            disabled={disabled} onClick={suggestion.action}>{suggestion.label}</button>)}</div>
          <span className={styles.saved} role="status">{saved ? 'Saved to your account' : 'Waiting for server confirmation'}</span>
        </div>
      </div>
    </aside>
    <div className={styles.canvas}>
      <div className={styles.tools}><ThemeToggle /><Link href="/home" className={styles.account} aria-label="Open your account">Y</Link></div>
      {children}
    </div>
  </main>;
}
