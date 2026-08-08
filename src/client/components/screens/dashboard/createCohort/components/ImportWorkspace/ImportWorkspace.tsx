'use client';
import Image from 'next/image';
import { AlertCircle, CircleCheckBig, CircleDashed, CircleDot, LoaderCircle, RotateCcw, SquareDashedBottomCode } from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import type { ImportWorkspaceModel, ImportedSourceModel, ImportPipelineStageModel, SourceImportCardModel } from '../../models/import';

import styles from './ImportWorkspace.module.css';

interface ImportWorkspaceProps {
  workspace: ImportWorkspaceModel;
  onCancel: () => void;
  onRetry: () => void;
}

function stageIcon(status: ImportPipelineStageModel['status']) {
  if (status === 'completed') return <CircleCheckBig size={14} />;
  if (status === 'failed') return <AlertCircle size={14} />;
  if (status === 'running') return <LoaderCircle size={14} className={styles.spin} />;
  return <CircleDashed size={14} />;
}

function cardStatusLabel(status: SourceImportCardModel['status']) {
  switch (status) {
    case 'running':
      return 'Importing';
    case 'completed':
      return 'Imported';
    case 'failed':
      return 'Failed';
    case 'canceled':
      return 'Canceled';
    case 'pending-provider':
      return 'Provider pending';
    default:
      return 'Queued';
  }
}

function badgeVariant(status: SourceImportCardModel['status']) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'brand';
    case 'pending-provider':
      return 'warning';
    default:
      return 'neutral';
  }
}

function formatSourceSummary(card: SourceImportCardModel) {
  if (card.importedSource) {
    return `${card.importedSource.lessonCount} lessons · ${card.importedSource.totalDuration}`;
  }

  return card.currentOperation;
}

function ImportedLessonRow({ source }: { source: ImportedSourceModel }) {
  return (
    <div className={styles.lessonGrid}>
      {source.lessons.slice(0, 12).map((lesson) => (
        <div key={lesson.id} className={styles.lessonRow}>
          <Image fill className={styles.lessonThumbnail} src={lesson.thumbnail} alt=""  />
          <div className={styles.lessonText}>
            <Text className={styles.lessonTitle}>{lesson.title}</Text>
            <Text variant="small" className={styles.lessonMeta}>
              {lesson.position}. {lesson.duration} · {lesson.publishedLabel}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcePreview({ source }: { source: ImportedSourceModel }) {
  return (
    <Surface variant="subtle" padding="md" className={styles.preview}>
      <div className={styles.previewHero}>
        <Image fill className={styles.previewImage} src={source.thumbnail} alt=""  />
        <div className={styles.previewCopy}>
          <Badge variant="neutral" size="sm">
            {source.provider}
          </Badge>
          <Heading level={3} className={styles.previewTitle}>
            {source.title}
          </Heading>
          <Text variant="muted" className={styles.previewMeta}>
            {source.creator} · {source.lessonCount} lessons · {source.totalDuration}
          </Text>
        </div>
      </div>

      <ImportedLessonRow source={source} />
    </Surface>
  );
}

function StageRail({ stages }: { stages: ImportPipelineStageModel[] }) {
  return (
    <div className={styles.stageRail} aria-label="Import pipeline stages">
      {stages.map((stage) => (
        <div key={stage.id} className={styles.stageItem}>
          <div className={styles.stageIcon}>{stageIcon(stage.status)}</div>
          <div className={styles.stageBody}>
            <div className={styles.stageHeadingRow}>
              <Text className={styles.stageTitle}>{stage.title}</Text>
              <Badge variant={stage.status === 'failed' ? 'danger' : stage.status === 'completed' ? 'success' : stage.status === 'running' ? 'brand' : 'neutral'} size="sm">
                {stage.status}
              </Badge>
            </div>
            <Text variant="small" className={styles.stageDescription}>
              {stage.description}
            </Text>
            <div className={styles.stageTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage.progress}>
              <span className={styles.stageFill} style={{ width: `${Math.max(0, Math.min(100, stage.progress))}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceImportCard({ card }: { card: SourceImportCardModel }) {
  return (
    <Surface variant="subtle" padding="md" className={styles.sourceCard}>
      <div className={styles.sourceHeader}>
        <div>
          <Badge variant={badgeVariant(card.status)} size="sm">
            {card.sourceType}
          </Badge>
          <Heading level={3} className={styles.sourceTitle}>
            {card.title}
          </Heading>
          <Text variant="muted" className={styles.sourceUrl}>
            {card.url}
          </Text>
        </div>

        <Badge variant="neutral" size="sm">
          {cardStatusLabel(card.status)}
        </Badge>
      </div>

      <div className={styles.sourceMetrics}>
        <div>
          <Text variant="small" className={styles.metricLabel}>
            Progress
          </Text>
          <Text className={styles.metricValue}>{card.progress}%</Text>
        </div>
        <div>
          <Text variant="small" className={styles.metricLabel}>
            Remaining
          </Text>
          <Text className={styles.metricValue}>{card.estimatedRemaining}</Text>
        </div>
        <div>
          <Text variant="small" className={styles.metricLabel}>
            Status
          </Text>
          <Text className={styles.metricValue}>{card.liveStatus}</Text>
        </div>
      </div>

      <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={card.progress}>
        <span className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} />
      </div>

      <Text variant="small" className={styles.sourceSummary}>
        {formatSourceSummary(card)}
      </Text>

      {card.error ? (
        <div className={styles.sourceError}>
          <AlertCircle size={14} />
          <div>
            <Text className={styles.errorTitle}>{card.error.title}</Text>
            <Text variant="small" className={styles.errorMessage}>
              {card.error.message}
            </Text>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

function LiveFeed({ items }: { items: ImportWorkspaceModel['feed'] }) {
  return (
    <Surface variant="subtle" padding="md" className={styles.feedPanel}>
      <div className={styles.panelHeader}>
        <Heading level={3} className={styles.panelTitle}>
          Live Feed
        </Heading>
        <Badge variant="neutral" size="sm">
          {items.length}
        </Badge>
      </div>

      <div className={styles.feedList} aria-live="polite">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className={styles.feedItem}>
              <span className={`${styles.feedTone} ${styles[`tone_${item.tone}`]}`}>
                <CircleDot size={10} />
              </span>
              <div>
                <Text className={styles.feedTitle}>{item.title}</Text>
                <Text variant="small" className={styles.feedDetail}>
                  {item.detail}
                </Text>
                <Text variant="small" className={styles.feedTime}>
                  {item.timestamp}
                </Text>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.feedEmpty}>
            <Text variant="muted">Events will appear here as soon as the import starts.</Text>
          </div>
        )}
      </div>
    </Surface>
  );
}

export function ImportWorkspace({ workspace, onCancel, onRetry }: ImportWorkspaceProps) {
  const activeCard =
    workspace.sourceCards.find((card) => card.sourceId === workspace.activeSourceId) ??
    workspace.sourceCards[0];
  const previewSource = workspace.importedSources.at(-1) ?? activeCard?.importedSource ?? null;

  return (
    <div className={styles.root}>
      <Stack gap="6">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <Heading level={2} className={styles.title}>
              Importing Learning Resources
            </Heading>
            <Text variant="muted" className={styles.description}>
              We&apos;re analyzing your content and preparing your curriculum.
            </Text>
          </div>

          <Cluster gap="3" justify="end" className={styles.heroActions}>
            {workspace.status === 'failed' ? (
              <Button type="button" variant="primary" size="md" onClick={onRetry}>
                <RotateCcw size={16} />
                Retry import
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="md" onClick={onCancel}>
              <SquareDashedBottomCode size={16} />
              Cancel import
            </Button>
          </Cluster>
        </div>

        <Surface variant="elevated" padding="lg" className={styles.summary}>
          <div className={styles.summaryTop}>
            <div className={styles.summaryCopy}>
              <Text variant="small" className={styles.summaryLabel}>
                Current operation
              </Text>
              <Heading level={3} className={styles.summaryTitle}>
                {workspace.currentOperation}
              </Heading>
              <Text variant="muted" className={styles.summaryMeta}>
                {workspace.currentSourceLabel || 'Waiting for the next source'} · {workspace.liveStatus}
              </Text>
            </div>

            <div className={styles.summaryMetrics}>
              <div>
                <Text variant="small" className={styles.metricLabel}>
                  Overall progress
                </Text>
                <Text className={styles.metricValue}>{workspace.overallProgress}%</Text>
              </div>
              <div>
                <Text variant="small" className={styles.metricLabel}>
                  Estimated remaining
                </Text>
                <Text className={styles.metricValue}>{workspace.estimatedRemaining}</Text>
              </div>
              <div>
                <Text variant="small" className={styles.metricLabel}>
                  Imported lessons
                </Text>
                <Text className={styles.metricValue}>{workspace.totalLessons}</Text>
              </div>
            </div>
          </div>

          <div className={styles.progressTrackLarge} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={workspace.overallProgress}>
            <span className={styles.progressFillLarge} style={{ width: `${Math.max(0, Math.min(100, workspace.overallProgress))}%` }} />
          </div>

          {workspace.error ? (
            <div className={styles.topError}>
              <AlertCircle size={16} />
              <div>
                <Text className={styles.errorTitle}>{workspace.error.title}</Text>
                <Text variant="small" className={styles.errorMessage}>
                  {workspace.error.message}
                </Text>
              </div>
            </div>
          ) : null}
        </Surface>

        <div className={styles.grid}>
          <div className={styles.leftColumn}>
            <Surface variant="subtle" padding="md" className={styles.pipelinePanel}>
              <div className={styles.panelHeader}>
                <Heading level={3} className={styles.panelTitle}>
                  Pipeline Stages
                </Heading>
                <Badge variant="neutral" size="sm">
                  {workspace.status}
                </Badge>
              </div>
              <StageRail stages={activeCard?.stages ?? []} />
            </Surface>

            <div className={styles.cards}>
              {workspace.sourceCards.map((card) => (
                <SourceImportCard key={card.sourceId} card={card} />
              ))}
            </div>
          </div>

          <div className={styles.rightColumn}>
            {previewSource ? (
              <SourcePreview source={previewSource} />
            ) : (
              <Surface variant="subtle" padding="md" className={styles.previewEmpty}>
                <Text variant="muted">Imported lessons will appear here as metadata arrives.</Text>
              </Surface>
            )}

            <LiveFeed items={workspace.feed} />
          </div>
        </div>
      </Stack>
    </div>
  );
}
