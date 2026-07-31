'use client';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import type { CurriculumSummaryModel } from '../../models/import';

import styles from './CurriculumStep.module.css';

interface CurriculumStepProps {
  summary: CurriculumSummaryModel;
}

export function CurriculumStep({ summary }: CurriculumStepProps) {
  return (
    <div className={styles.root}>
      <Stack gap="6">
        <div className={styles.header}>
          <div>
            <Heading level={2} className={styles.title}>
              {summary.title}
            </Heading>
            <Text variant="muted" className={styles.description}>
              {summary.description}
            </Text>
          </div>

          <Badge variant="neutral" size="sm">
            Temporary step
          </Badge>
        </div>

        <Surface variant="elevated" padding="lg" className={styles.summary}>
          <div className={styles.metrics}>
            <div>
              <Text variant="small" className={styles.metricLabel}>
                Imported sources
              </Text>
              <Text className={styles.metricValue}>{summary.importedCount}</Text>
            </div>
            <div>
              <Text variant="small" className={styles.metricLabel}>
                Lessons imported
              </Text>
              <Text className={styles.metricValue}>{summary.totalLessons}</Text>
            </div>
            <div>
              <Text variant="small" className={styles.metricLabel}>
                Estimated hours
              </Text>
              <Text className={styles.metricValue}>{summary.totalDuration}</Text>
            </div>
            <div>
              <Text variant="small" className={styles.metricLabel}>
                Creator
              </Text>
              <Text className={styles.metricValue}>{summary.creator}</Text>
            </div>
          </div>

          <div className={styles.playlist}>
            <Text variant="small" className={styles.metricLabel}>
              Playlist
            </Text>
            <Heading level={3} className={styles.playlistTitle}>
              {summary.currentPlaylist}
            </Heading>
          </div>
        </Surface>

        <div className={styles.sourceList}>
          {summary.importedSources.map((source) => (
            <Surface key={source.id} variant="subtle" padding="md" className={styles.sourceCard}>
              <Cluster gap="3" justify="between" className={styles.sourceHeader}>
                <div>
                  <Badge variant="brand" size="sm">
                    {source.provider}
                  </Badge>
                  <Heading level={3} className={styles.sourceTitle}>
                    {source.title}
                  </Heading>
                  <Text variant="muted" className={styles.sourceMeta}>
                    {source.creator} · {source.lessonCount} lessons · {source.totalDuration}
                  </Text>
                </div>

                <Badge variant="success" size="sm">
                  Ready
                </Badge>
              </Cluster>
            </Surface>
          ))}
        </div>

        <Text variant="muted" className={styles.helper}>
          This step is temporary. Prompt 3 will replace it with the curriculum generator.
        </Text>
      </Stack>
    </div>
  );
}
