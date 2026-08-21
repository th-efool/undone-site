'use client';

import { useMemo, useState } from 'react';
import { FileSearch, Link, CornerDownLeft } from 'lucide-react';

import { SearchBar } from '@/src/client/components/global/SearchBar';

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

          <div className={styles.addSourceContainer}>
            <SearchBar
              value={urlInput}
              onChange={setUrlInput}
              onSubmit={handleAddSource}
              placeholder="Paste link here (YouTube video/playlist, GitHub, Website, PDF...)"
              className={styles.addSourceBar}
              leftIcon={<Link size={18} style={{ color: 'var(--color-text-muted)' }} />}
              hideShortcut={true}
              rightAction={
                urlInput ? (
                  <button type="button" className={styles.enterButton} onClick={handleAddSource}>
                    <CornerDownLeft size={14} />
                  </button>
                ) : null
              }
            />
          </div>

          <div className={styles.masonryGrid}>
            {sources.sources.length === 0 ? (
              <>
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
                  style={{ gridColumn: '1 / -1', minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Stack gap="4" align="center">
                    <FileSearch size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <Text variant="muted">{sources.emptyLabel}</Text>
                  </Stack>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', border: '1px dashed var(--color-border)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                    <Text variant="body">GitHub Repository</Text>
                  </div>
                  <Text variant="muted" style={{ fontSize: '13px' }}>Sync markdown files, issues, and PRs directly into your curriculum.</Text>
                  <Button variant="outline" size="sm" onClick={() => {}}>Connect GitHub</Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', border: '1px dashed var(--color-border)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    <Text variant="body">Notion Workspace</Text>
                  </div>
                  <Text variant="muted" style={{ fontSize: '13px' }}>Import pages from Notion and keep them synced automatically.</Text>
                  <Button variant="outline" size="sm" onClick={() => {}}>Connect Notion</Button>
                </div>
              </>
            ) : (
              orderedSources.map(({ source, previousId, nextId }) => (
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
              ))
            )}
          </div>
        </Stack>
      )}
    </div>
  );
}
