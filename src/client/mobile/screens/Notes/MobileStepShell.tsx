'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './NotesMobile.module.css';

interface MobileStepShellProps {
  step: 'notebooks' | 'workspace' | 'canvas';
  children: React.ReactNode;
}

const STEP_ORDER: Array<'notebooks' | 'workspace' | 'canvas'> = ['notebooks', 'workspace', 'canvas'];

export function MobileStepShell({ step, children }: MobileStepShellProps) {
  const prevStepRef = useRef(step);
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    const prev = prevStepRef.current;
    if (prev === step) return;

    const prevIdx = STEP_ORDER.indexOf(prev);
    const nextIdx = STEP_ORDER.indexOf(step);
    const direction = nextIdx > prevIdx ? 'forward' : 'back';

    setAnimClass(direction === 'forward' ? styles.slideInFromRight : styles.slideInFromLeft);
    prevStepRef.current = step;

    const timer = setTimeout(() => setAnimClass(''), 320);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className={`${styles.stepContainer} ${animClass}`}>
      {children}
    </div>
  );
}
