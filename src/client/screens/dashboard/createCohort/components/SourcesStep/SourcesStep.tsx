'use client';

import { useMemo, useState } from 'react';
import { FileSearch } from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { Stack } from '@/src/client/components/global/layout/Stack';
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
  const [urlInput, setUrlInput] = useState('');
  const isImportActive = importWorkspace.status === 'running' || importWorkspace.status === 'failed';

  const handleAddSource = () => {
    if (urlInput.trim()) {
      actions.addSource(urlInput.trim());
      setUrlInput('');
    }
  };

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
            </Cluster>
          </div>

          <div className={styles.addSourceBar}>
            <input
              type="url"
              className={styles.urlInput}
              placeholder="Paste link here (YouTube video/playlist, GitHub, Website, PDF...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSource();
                }
              }}
            />
            <Button
              type="button"
              variant="primary"
              className={styles.addButton}
              onClick={handleAddSource}
            >
              Add Source
            </Button>
          </div>

          {sources.sources.length === 0 ? (
            <div 
              className={`${styles.emptyState} ${draggingSourceId === 'dropzone' ? styles.dragActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingSourceId('dropzone');
              }}
              onDragLeave={() => setDraggingSourceId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingSourceId(null);
              }}
            >
              <Stack gap="4" align="center">
                <FileSearch size={32} style={{ color: 'var(--color-text-muted)' }} />
                <Text variant="muted">{sources.emptyLabel}</Text>
              </Stack>
            </div>
          ) : (
            <div className={styles.masonryGrid}>
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
            </div>
          )}
        </Stack>
      )}
    </div>
  );
}
