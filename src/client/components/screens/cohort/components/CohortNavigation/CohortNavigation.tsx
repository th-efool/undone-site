'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

import type { NavigationItem } from '../../models';

import styles from './CohortNavigation.module.css';

interface CohortNavigationProps {
  items: NavigationItem[];
}

// Define which tabs are "primary" (always visible on mobile) vs secondary (in More dropdown)
const PRIMARY_TAB_IDS = new Set(['overview', 'events', 'archives']);

export function CohortNavigation({ items }: CohortNavigationProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && moreOpen) setMoreOpen(false);
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [moreOpen]);

  // On mobile (≤480px), separate into primary + secondary tabs
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth <= 480); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const primaryTabs = items.filter((item) => PRIMARY_TAB_IDS.has(item.id));
  const secondaryTabs = items.filter((item) => !PRIMARY_TAB_IDS.has(item.id));

  // On mobile, the "More" dropdown button should be last among visible tabs
  return (
    <nav
      className={`${styles.navigation} ${isMobile && items.length > 3 ? styles.mobile : ''}`}
      aria-label="Cohort navigation"
      ref={moreRef}
    >
      {items.map((item) => {
        const isPrimary = PRIMARY_TAB_IDS.has(item.id);

        // On mobile: show primary tabs + More button (not individual secondary tabs)
        if (isMobile && !isPrimary) return null;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.link} ${pathname === item.href ? styles.active : ''}`}
          >
            {item.label}
          </Link>
        );
      })}

      {/* More dropdown — only on mobile when there are secondary tabs */}
      {isMobile && secondaryTabs.length > 0 && (
        <div className={styles.moreWrapper}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`${styles.link} ${styles.moreButton} ${moreOpen ? styles.active : ''}`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            aria-label="More tabs"
          >
            More <ChevronDown size={14} strokeWidth={2.5} />
          </button>

          {moreOpen && (
            <div className={styles.moreDropdown}>
              {secondaryTabs.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`${styles.link} ${pathname === item.href ? styles.active : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
