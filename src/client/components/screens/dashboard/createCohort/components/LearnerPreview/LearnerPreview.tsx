'use client';

import {
  Monitor,
  Tablet,
  Smartphone,
  BookOpen,
  Compass,
  PlayCircle,
  FileCheck,
  Calendar,
  Archive,
  Trophy,
  Clock,
  Award,
} from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';
import type { DeviceViewport, LearnerPreviewTab } from '../../models/launch';

import styles from './LearnerPreview.module.css';

export function LearnerPreview() {
  const { curriculumState, state, launchState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;
  const viewport = launchState.deviceViewport;
  const activeTab = launchState.previewTab;

  if (!curriculum) return null;

  const tabs: { id: LearnerPreviewTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'questline', label: 'Questline', icon: BookOpen },
    { id: 'player', label: 'Player', icon: PlayCircle },
    { id: 'assignments', label: 'Assignments', icon: FileCheck },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'archives', label: 'Archives', icon: Archive },
    { id: 'hall-of-fame', label: 'Hall of Fame', icon: Trophy },
  ];

  return (
    <div className={styles.previewContainer}>
      <div className={styles.controlsBar}>
        <div className={styles.viewTabs}>
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''}`}
                onClick={() => actions.setPreviewTab(t.id)}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className={styles.viewportSwitch}>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'desktop' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('desktop')}
            title="Desktop Viewport"
          >
            <Monitor size={15} />
          </button>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'tablet' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('tablet')}
            title="Tablet Viewport"
          >
            <Tablet size={15} />
          </button>
          <button
            type="button"
            className={`${styles.viewportBtn} ${viewport === 'mobile' ? styles.viewportActive : ''}`}
            onClick={() => actions.setDeviceViewport('mobile')}
            title="Mobile Viewport"
          >
            <Smartphone size={15} />
          </button>
        </div>
      </div>

      {/* Device Frame */}
      <div className={styles.deviceWrapper}>
        <div className={`${styles.viewportContainer} ${styles[`viewport${viewport}`]}`}>
          <div className={styles.previewCanvas}>
            {activeTab === 'overview' && (
              <div className={styles.heroPreview}>
                <img
                  src={state.draft.coverImage || '/images/landing/screen.webp'}
                  alt={state.draft.title}
                  className={styles.coverImage}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/landing/screen.webp';
                  }}
                />

                <div>
                  <Badge variant="brand" size="sm">
                    {state.draft.difficulty} · {curriculum.totalHours}
                  </Badge>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.4rem' }}>
                    {state.draft.title}
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {state.draft.subtitle || state.draft.description}
                  </p>
                </div>

                <div className={styles.seasonGroup}>
                  {curriculum.seasons.map((season) => (
                    <div key={season.id}>
                      <h3 className={styles.seasonTitle}>
                        {season.title} ({season.lessonCount} lessons)
                      </h3>
                      <div className={styles.lessonGrid}>
                        {season.lessons.map((lesson) => (
                          <div key={lesson.id} className={styles.lessonRow}>
                            <span>{lesson.title}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                              {lesson.duration}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'questline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  Questline Map ({curriculum.totalSeasons} Seasons)
                </h3>
                {curriculum.seasons.map((season, sIdx) => (
                  <div
                    key={season.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <h4 style={{ fontWeight: 700, color: '#a5b4fc' }}>
                      Season {sIdx + 1}: {season.title}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {season.description}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {season.lessons.map((l) => (
                        <span
                          key={l.id}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            background: 'rgba(99,102,241,0.15)',
                            borderRadius: '6px',
                            color: '#cbd5e1',
                          }}
                        >
                          {l.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'player' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    width: '100%',
                    height: '240px',
                    background: '#020617',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <PlayCircle size={48} color="#6366f1" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    {curriculum.seasons[0]?.lessons[0]?.title || 'Lesson Player'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    {curriculum.seasons[0]?.lessons[0]?.description}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'assignments' && (
              <div style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                <FileCheck size={20} color="#6366f1" style={{ marginBottom: '0.5rem' }} />
                <h4>Assignments & Exercises</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Learners submit capstone exercises and receive peer reviews here.
                </p>
              </div>
            )}

            {activeTab === 'events' && (
              <div style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                <Calendar size={20} color="#6366f1" style={{ marginBottom: '0.5rem' }} />
                <h4>Live Community Office Hours</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Scheduled Q&A sessions and group study sprints.
                </p>
              </div>
            )}

            {activeTab === 'archives' && (
              <div style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                <Archive size={20} color="#6366f1" style={{ marginBottom: '0.5rem' }} />
                <h4>Recorded Session Archives</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Past workshop recordings and cohort archives.
                </p>
              </div>
            )}

            {activeTab === 'hall-of-fame' && (
              <div style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                <Trophy size={20} color="#fbbf24" style={{ marginBottom: '0.5rem' }} />
                <h4>Hall of Fame & Badges</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Top learners and XP leaderboard standings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
