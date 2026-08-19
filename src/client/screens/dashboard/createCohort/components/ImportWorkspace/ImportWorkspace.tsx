'use client';

import Image from 'next/image';
import {
  AlertCircle,
  CircleCheckBig,
  CircleDashed,
  Cpu,
  Film,
  Layers,
  LoaderCircle,
  RotateCcw,
  SquareDashedBottomCode,
  Terminal,
} from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';

import type {
  ImportWorkspaceModel,
  ImportedSourceModel,
  ImportPipelineStageModel,
  SourceImportCardModel,
  ImportFeedItemModel,
} from '../../models/import';

import styles from './ImportWorkspace.module.css';

interface ImportWorkspaceProps {
  workspace: ImportWorkspaceModel;
  onCancel: () => void;
  onRetry: () => void;
}

function stageIcon(status: ImportPipelineStageModel['status']) {
  if (status === 'completed') return <CircleCheckBig size={12} className={styles.iconSuccess} />;
  if (status === 'failed') return <AlertCircle size={12} className={styles.iconDanger} />;
  if (status === 'running') return <LoaderCircle size={12} className={styles.spin} />;
  return <CircleDashed size={12} className={styles.iconMuted} />;
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
      return 'Pending';
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

const CANONICAL_STAGE_NAMES = ['Queued', 'Validating', 'Metadata', 'Processing', 'Ready'];

function PipelineMatrix({ stages }: { stages: ImportPipelineStageModel[] }) {
  const displayStages = stages.length > 0
    ? stages
    : CANONICAL_STAGE_NAMES.map((name, i) => ({
        id: `stage-${i}`,
        title: name,
        description: name,
        status: i === 0 ? ('completed' as const) : i === 1 ? ('running' as const) : ('pending' as const),
        progress: i === 0 ? 100 : i === 1 ? 50 : 0,
      }));

  return (
    <div className={styles.matrixPane}>
      <div className={styles.paneHeader}>
        <div className={styles.paneTitleGroup}>
          <span className={styles.paneTitle}>PIPELINE MATRIX</span>
        </div>
      </div>

      <div className={styles.pipelineRail} aria-label="Pipeline matrix stages">
        {displayStages.map((stage, index) => (
          <div key={stage.id} className={styles.stageTextWrapper}>
            <div className={`${styles.stageDot} ${styles[`stageDot_${stage.status}`]}`} />
            <span className={`${styles.stagePillTitle} ${styles[`stagePillTitle_${stage.status}`]}`}>
              {stage.title}
            </span>
            {index < displayStages.length - 1 && <div className={styles.stageConnector} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceJobs({ cards }: { cards: SourceImportCardModel[] }) {
  return (
    <div className={styles.jobsPane}>
      <div className={styles.paneHeader}>
        <div className={styles.paneTitleGroup}>
          <span className={styles.paneTitle}>SOURCE JOBS</span>
        </div>
      </div>

      <div className={styles.sourceGrid}>
        {cards.map((card) => (
          <div key={card.sourceId} className={styles.sourceCard}>
            <div className={styles.sourceCardTop}>
              <div className={styles.sourceMeta}>
                <span className={styles.sourceTypeLabel}>{card.sourceType}</span>
                <span className={styles.sourceTitle} title={card.title}>
                  {card.title}
                </span>
              </div>
              <span className={`${styles.sourceStatusLabel} ${styles[`sourceStatusLabel_${card.status}`]}`}>
                {cardStatusLabel(card.status)}
              </span>
            </div>

            <div className={styles.progressTrack} role="progressbar" aria-valuenow={card.progress}>
              <span
                className={styles.progressFill}
                style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }}
              />
            </div>

            <div className={styles.sourceCardFooter}>
              <span className={styles.sourceStatusText}>{card.liveStatus}</span>
              <span className={styles.sourceProgressPct}>{card.progress}%</span>
            </div>

            {card.error ? (
              <div className={styles.sourceError}>
                <span className={styles.errorMessage}>{card.error.message}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TelemetryTerminal({ items }: { items: ImportFeedItemModel[] }) {
  return (
    <div className={styles.terminalPanel}>
      <div className={styles.terminalHeader}>
        <div className={styles.terminalTitleGroup}>
          <span className={styles.terminalTitle}>TELEMETRY TERMINAL</span>
        </div>
      </div>

      <div className={styles.terminalFeed} aria-live="polite">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className={styles.terminalLine}>
              <span className={styles.terminalTimestamp}>[{item.timestamp}]</span>
              <span className={styles.terminalMessage}>
                {item.title}{item.detail ? ` - ${item.detail}` : ''}
              </span>
            </div>
          ))
        ) : (
          <div className={styles.terminalEmpty}>
            <span className={styles.terminalTimestamp}>[00:00:00]</span>
            <span className={styles.terminalMessage}>Awaiting system telemetry events...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveAssetGrid({ sources }: { sources: ImportedSourceModel[] }) {
  const allLessons = sources.flatMap((s) => s.lessons);

  return (
    <div className={styles.assetPane}>
      <div className={styles.paneHeader}>
        <div className={styles.paneTitleGroup}>
          <span className={styles.paneTitle}>LIVE ASSET STREAM</span>
        </div>
      </div>

      <div className={styles.assetGrid}>
        {allLessons.length > 0 ? (
          allLessons.slice(0, 16).map((lesson) => (
            <div key={lesson.id} className={styles.assetCard}>
              <Image
                width={240}
                height={135}
                className={styles.assetThumbnail}
                src={lesson.thumbnail}
                alt=""
              />
              <div className={styles.assetInfo}>
                <span className={styles.assetTitle} title={lesson.title}>
                  {lesson.title}
                </span>
                <div className={styles.assetMeta}>
                  <span className={styles.assetPos}>#{lesson.position}</span>
                  <span className={styles.assetDuration}>{lesson.duration}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.assetEmpty}>
            <span>No asset chunks received yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportWorkspace({ workspace, onCancel, onRetry }: ImportWorkspaceProps) {
  const activeCard =
    workspace.sourceCards.find((card) => card.sourceId === workspace.activeSourceId) ??
    workspace.sourceCards[0];

  return (
    <div className={styles.root}>
      {/* Top HUD Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.hudBadge}>
            <span className={styles.neonDot} />
            <span className={styles.hudTitle}>IMPORT STUDIO HUD</span>
          </div>
          <div className={styles.operationMeta}>
            <span className={styles.opTitle}>{workspace.currentOperation}</span>
            <span className={styles.opSub}>
              {workspace.currentSourceLabel || 'Standby'} · {workspace.liveStatus}
            </span>
          </div>
        </div>

        <div className={styles.topBarCenter}>
          <div className={styles.progressRow}>
            <span className={styles.progressLabel}>OVERALL</span>
            <div className={styles.progressTrackLarge} role="progressbar" aria-valuenow={workspace.overallProgress}>
              <span
                className={styles.progressFillLarge}
                style={{ width: `${Math.max(0, Math.min(100, workspace.overallProgress))}%` }}
              />
            </div>
            <span className={styles.progressPct}>{workspace.overallProgress}%</span>
          </div>
          <div className={styles.etaBadge}>
            ETA: {workspace.estimatedRemaining} · {workspace.totalLessons} LESSONS
          </div>
        </div>

        <div className={styles.topBarRight}>
          {workspace.status === 'failed' ? (
            <Button type="button" variant="primary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {workspace.error ? (
        <div className={styles.topError}>
          <span>
            <strong>{workspace.error.title}:</strong> {workspace.error.message}
          </span>
        </div>
      ) : null}

      {/* 4-Pane Desktop Studio Dashboard */}
      <div className={styles.studioGrid}>
        {/* Pane 1: Pipeline Matrix */}
        <PipelineMatrix stages={activeCard?.stages ?? []} />

        {/* Pane 2: Source Jobs */}
        <SourceJobs cards={workspace.sourceCards} />

        {/* Pane 3: Telemetry Terminal */}
        <TelemetryTerminal items={workspace.feed} />

        {/* Pane 4: Live Asset Grid */}
        <LiveAssetGrid sources={workspace.importedSources} />
      </div>
    </div>
  );
}
