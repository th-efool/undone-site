'use client';

import { useMemo, useState } from 'react';
import { FileSearch } from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Surface } from '@/src/client/components/global/layout/Surface';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import type { CreateCohortSourcesModel } from '../../models/createCohort';
import type { ImportWorkspaceModel } from '../../models/import';
import { useWizardContext } from '../../providers/WizardProvider';

import { ImportWorkspace } from '../ImportWorkspace/ImportWorkspace';
import { SourceCard } from './SourceCard';
import styles from './SourcesStep.module.css';

interface SourcesStepProps {
  sources: CreateCohortSourcesModel;
  importWorkspace: ImportWorkspaceModel;
}

export function SourcesStep({ sources, importWorkspace }: SourcesStepProps) {
  const { actions } = useWizardContext();
  const [draggingSourceId, setDraggingSourceId] = useState<string | null>(null);
  const isImportActive = importWorkspace.status === 'running' || importWorkspace.status === 'failed';

  const orderedSources = useMemo(
    () => sources.sources.map((source, index) => ({
      source,
      previousId: sources.sources[index - 1]?.id,
      nextId: sources.sources[index + 1]?.id,
    })),
    [sources.sources],
  );

  return (
    <div className={styles.root}>
      {isImportActive ? (
        <ImportWorkspace
          workspace={importWorkspace}
          onCancel={actions.cancelImport}
          onRetry={actions.retryImport}
        />
      ) : (
        <Stack gap="5">
          <div className={styles.header}>
            <Stack gap="2">
              <Heading level={2} className={styles.title}>
                {sources.title}
              </Heading>
              <Text variant="muted">{sources.description}</Text>
            </Stack>

            <Cluster gap="3" justify="end" className={styles.actions}>
              <Badge variant="neutral">{sources.countLabel}</Badge>
              <Button type="button" variant="primary" size="md" onClick={actions.addSource}>
                Add source
              </Button>
            </Cluster>
          </div>

          {sources.sources.length === 0 ? (
            <Surface variant="subtle" className={styles.emptyState}>
              <Stack gap="4" align="center">
                <FileSearch size={32} style={{ color: 'var(--color-text-muted)' }} />
                <Text variant="muted">{sources.emptyLabel}</Text>
                <Button type="button" variant="primary" onClick={actions.addSource}>
                  Add first source
                </Button>
              </Stack>
            </Surface>
          ) : (
            <Stack gap="4">
              {orderedSources.map(({ source, previousId, nextId }) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  typeOptions={sources.sourceTypeOptions}
                  dragging={draggingSourceId === source.id}
                  previousId={previousId}
                  nextId={nextId}
                  onDragStart={(sourceId) => setDraggingSourceId(sourceId)}
                  onDragOver={(targetId) => {
                    if (draggingSourceId && draggingSourceId !== targetId) {
                      actions.moveSource(draggingSourceId, targetId);
                    }
                  }}
                  onDrop={(targetId) => {
                    if (draggingSourceId && draggingSourceId !== targetId) {
                      actions.moveSource(draggingSourceId, targetId);
                    }
                    setDraggingSourceId(null);
                  }}
                  onDragEnd={() => setDraggingSourceId(null)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </div>
  );
}
