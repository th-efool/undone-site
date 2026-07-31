'use client';

import { useState, useRef, useEffect } from 'react';
import { Award, ChevronDown, CheckCircle } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { useCurriculumQuality } from '../../hooks/useCurriculumQuality';

import styles from './CurriculumQuality.module.css';

export function CurriculumQuality() {
  const { curriculumState, state, actions } = useWizardContext();
  const { quality } = useCurriculumQuality(curriculumState.curriculum, state.draft);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!curriculumState.curriculum) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className={styles.qualityBadge} onClick={() => setOpen(!open)}>
        <span className={styles.scoreCircle} style={{ background: quality.color }}>
          {quality.score}%
        </span>
        <span className={styles.scoreText}>{quality.grade}</span>
        <ChevronDown size={14} color="#94a3b8" />
      </div>

      {open && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <span className={styles.popoverTitle}>Quality Score Breakdown</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: quality.color }}>
              {quality.score}/100
            </span>
          </div>

          {quality.deductions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#34d399' }}>
              <CheckCircle size={16} /> Perfect curriculum structure! No quality penalties.
            </div>
          ) : (
            <div className={styles.deductionList}>
              {quality.deductions.map((d) => (
                <div
                  key={d.id}
                  className={styles.deductionItem}
                  onClick={() => {
                    if (d.lessonId) actions.selectLesson(d.lessonId);
                    else if (d.seasonId) actions.selectSeason(d.seasonId);
                  }}
                  style={{ cursor: d.lessonId || d.seasonId ? 'pointer' : 'default' }}
                >
                  <div>
                    <strong>{d.title}:</strong> {d.message}
                  </div>
                  <span className={styles.penaltyTag}>-{d.penalty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
