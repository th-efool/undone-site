"use client";
import Image from 'next/image';

import { useState, type DragEvent, type MouseEvent } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Split,
  Merge,
  Clock,
  BookOpen,
  Layers,
} from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';
import { CurriculumContextMenu } from '../CurriculumContextMenu/CurriculumContextMenu';
import type { CurriculumLesson, CurriculumSeason } from '@/src/shared/curriculum';

import styles from './CurriculumBoard.module.css';

// Chunk timeline colors — 2 alternating palette entries based on position
const CHUNK_COLORS = ['#4f46e5', '#818cf8'];

interface ContextMenuState {
  x: number;
  y: number;
  type: 'season' | 'lesson';
  targetId: string;
}

export function CurriculumBoard() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const [draggedSeasonId, setDraggedSeasonId] = useState<string | null>(null);
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  if (!curriculum) return null;

  const query = curriculumState.searchQuery.toLowerCase().trim();
  const filterWarning = curriculumState.filterWarningOnly;

  const warningLessonIds = new Set(
    curriculum.warnings.filter((w) => w.lessonId).map((w) => w.lessonId as string),
  );
  const warningSeasonIds = new Set(
    curriculum.warnings.filter((w) => w.seasonId).map((w) => w.seasonId as string),
  );

  const filteredSeasons = curriculum.seasons
    .map((season) => {
      const matchSeasonName = season.title.toLowerCase().includes(query);
      const matchingLessons = season.lessons.filter((lesson) => {
        const matchLesson =
          lesson.title.toLowerCase().includes(query) ||
          lesson.description.toLowerCase().includes(query) ||
          lesson.tags.some((t) => t.toLowerCase().includes(query));
        const matchWarning = !filterWarning || warningLessonIds.has(lesson.id);
        return (query ? matchLesson || matchSeasonName : true) && matchWarning;
      });

      const showSeason = query ? matchSeasonName || matchingLessons.length > 0 : true;
      const warningCheck = !filterWarning || warningSeasonIds.has(season.id) || matchingLessons.length > 0;

      return showSeason && warningCheck ? { ...season, lessons: matchingLessons } : null;
    })
    .filter(Boolean) as CurriculumSeason[];

  const handleSeasonDragStart = (e: DragEvent, seasonId: string) => {
    e.stopPropagation();
    setDraggedSeasonId(seasonId);
    e.dataTransfer.setData('text/season-id', seasonId);
  };

  const handleSeasonDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleSeasonDrop = (e: DragEvent, targetSeasonId: string) => {
    e.preventDefault();
    const sourceSeasonId = e.dataTransfer.getData('text/season-id');
    if (sourceSeasonId && sourceSeasonId !== targetSeasonId) {
      actions.moveSeason(sourceSeasonId, targetSeasonId);
    }
    setDraggedSeasonId(null);
  };

  const handleLessonDragStart = (e: DragEvent, lessonId: string) => {
    e.stopPropagation();
    setDraggedLessonId(lessonId);
    e.dataTransfer.setData('text/lesson-id', lessonId);
  };

  const handleLessonDrop = (e: DragEvent, targetSeasonId: string, targetLessonId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceLessonId = e.dataTransfer.getData('text/lesson-id');
    if (sourceLessonId) {
      actions.moveLesson(sourceLessonId, targetSeasonId, targetLessonId);
    }
    setDraggedLessonId(null);
  };

  const handleContextMenu = (e: MouseEvent, type: 'season' | 'lesson', targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, targetId });
  };

  const { selectedLessonIds, selectedSeasonIds } = curriculumState.multiSelection;

  return (
    <>
      <div className={styles.board}>
        {filteredSeasons.map((season, seasonIndex) => {
          const isSelectedSeason =
            curriculumState.selectedSeasonId === season.id || selectedSeasonIds.includes(season.id);
          const nextSeason = curriculum.seasons[seasonIndex + 1];

          return (
            <div
              key={season.id}
              draggable
              onDragStart={(e) => handleSeasonDragStart(e, season.id)}
              onDragOver={handleSeasonDragOver}
              onDrop={(e) => handleSeasonDrop(e, season.id)}
              onContextMenu={(e) => handleContextMenu(e, 'season', season.id)}
              className={`${styles.seasonCard} ${isSelectedSeason ? styles.seasonCardSelected : ''} ${
                draggedSeasonId === season.id ? styles.seasonCardDragging : ''
              }`}
              onClick={(e) => {
                actions.toggleSelectSeason(season.id, e.shiftKey || e.metaKey || e.ctrlKey);
              }}
            >
              {/* Season Header Bar — same trapezium + indigoBar as /home */}
              <div className={styles.seasonHeaderBar}>
                {/* Left tab trapezium */}
                <div className={styles.tabTrapezium}>
                  <span className={styles.dragHandle} title="Drag to reorder">
                    <GripVertical size={14} />
                  </span>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); actions.toggleSeasonCollapse(season.id); }}
                    className={styles.collapseBtn}
                  >
                    {season.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <input
                    type="text"
                    value={season.title}
                    onChange={(e) => actions.updateSeason(season.id, { title: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.seasonTitleInput}
                  />

                  <div className={styles.badgeGroup}>
                    <Badge variant="neutral" size="sm">
                      <BookOpen size={11} style={{ marginRight: 3 }} />
                      {season.lessonCount}
                    </Badge>
                    <Badge variant="brand" size="sm">
                      <Clock size={11} style={{ marginRight: 3 }} />
                      {season.estimatedDuration}
                    </Badge>
                  </div>
                </div>

                {/* Right dark indigo bar */}
                <div className={styles.indigoBar} onClick={(e) => e.stopPropagation()}>
                  {season.lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.splitSeason(season.id); }}
                      className={styles.seasonActionBtn}
                      title="Split season"
                    >
                      <Split size={12} /> Split
                    </button>
                  )}

                  {nextSeason && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.mergeSeasons(season.id, nextSeason.id); }}
                      className={styles.seasonActionBtn}
                      title={`Merge with ${nextSeason.title}`}
                    >
                      <Merge size={12} /> Merge
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.deleteSeason(season.id); }}
                    className={`${styles.seasonActionBtn} ${styles.deleteActionBtn}`}
                    title="Delete season"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Lesson list — flat rows matching /home ActiveCohortRow */}
              {!season.collapsed && (
                <div
                  className={styles.lessonList}
                  onDragOver={handleSeasonDragOver}
                  onDrop={(e) => handleLessonDrop(e, season.id)}
                >
                  {season.lessons.length === 0 ? (
                    <div className={styles.emptySeasonNotice}>
                      Empty season — drag lessons here.
                    </div>
                  ) : (
                    season.lessons.map((lesson) => {
                      const isSelectedLesson =
                        curriculumState.selectedLessonId === lesson.id ||
                        selectedLessonIds.includes(lesson.id);

                      return (
                        <div
                          key={lesson.id}
                          draggable
                          onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
                          onDragOver={handleSeasonDragOver}
                          onDrop={(e) => handleLessonDrop(e, season.id, lesson.id)}
                          onContextMenu={(e) => handleContextMenu(e, 'lesson', lesson.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.toggleSelectLesson(lesson.id, e.shiftKey || e.metaKey || e.ctrlKey);
                          }}
                          className={`${styles.lessonCard} ${
                            isSelectedLesson ? styles.lessonCardSelected : ''
                          } ${draggedLessonId === lesson.id ? styles.lessonCardDragging : ''}`}
                        >
                          {/* Col 1: drag handle + checkbox */}
                          <div className={styles.handleGroup}>
                            <span className={styles.dragHandle} onClick={(e) => e.stopPropagation()} title="Drag lesson">
                              <GripVertical size={14} />
                            </span>
                          </div>

                          {/* Col 2: thumbnail */}
                          <Image
                            width={112}
                            height={72}
                            src={
                              lesson.thumbnail ||
                              (lesson.videoId ? `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg` : undefined) ||
                              '/mock/thumbnails/docker.avif'
                            }
                            alt={lesson.title}
                            className={styles.lessonThumbnail}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (lesson.videoId && !target.src.includes(lesson.videoId)) {
                                target.src = `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg`;
                              } else {
                                target.src = '/mock/thumbnails/docker.avif';
                              }
                            }}
                          />

                          {/* Col 3: title + meta + timeline */}
                          <div className={styles.lessonContent}>
                            <h4 className={styles.lessonTitle}>{lesson.title}</h4>
                            <div className={styles.lessonMeta}>
                              <span className={styles.metaChip}>
                                <Clock size={10} /> {lesson.duration}
                              </span>
                              <span className={styles.chunksChip}>
                                <Layers size={10} /> {lesson.chunkCount}
                              </span>
                              <span className={styles.metaChip}>{lesson.difficulty}</span>
                            </div>
                            
                            {/* Chunk timeline bar — always visible */}
                            {lesson.chunks && lesson.chunks.length > 0 && (
                              <div className={styles.chunkTimelineBar}>
                                {lesson.chunks.map((chunk, idx) => {
                                  const color = CHUNK_COLORS[idx % CHUNK_COLORS.length];
                                  const minutesMatch = chunk.duration.match(/(\d+)m/);
                                  const hoursMatch = chunk.duration.match(/(\d+)h/);
                                  const mins =
                                    (minutesMatch ? parseInt(minutesMatch[1]) : 0) +
                                    (hoursMatch ? parseInt(hoursMatch[1]) * 60 : 0);
                                  const flexBasis = Math.max(1, mins);

                                  return (
                                    <div
                                      key={chunk.id}
                                      className={styles.chunkSlice}
                                      style={{ flexGrow: flexBasis, backgroundColor: color }}
                                      title={chunk.duration}
                                    >
                                      <span className={styles.chunkSliceText}>{chunk.duration}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Col 4: actions */}
                          <div className={styles.lessonActions} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.updateLesson(lesson.id, { collapsed: !lesson.collapsed }); }}
                              className={styles.lessonActionBtn}
                              title="Toggle details"
                            >
                              {lesson.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.duplicateLesson(lesson.id); }}
                              className={styles.lessonActionBtn}
                              title="Duplicate"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.deleteLesson(lesson.id); }}
                              className={styles.lessonDeleteBtn}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Expanded accordion row — spans full width */}
                          {!lesson.collapsed && (
                            <div className={styles.lessonExpanded}>
                              {lesson.description && (
                                <p className={styles.lessonDescription}>{lesson.description}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <CurriculumContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          targetId={contextMenu.targetId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
