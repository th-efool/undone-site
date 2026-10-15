'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  CircleCheck,
  FileText,
  Globe,
  Link as LinkIcon,
  Plus,
  Upload,
} from 'lucide-react';
import type {
  CohortAction,
  CohortSource,
  CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { useInteractionState } from '@/src/client/interaction/hooks';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import styles from './MaterialStageView.module.css';

export interface MaterialStageViewProps {
  workspace: CohortWorkspace;
  workspaceId?: string;
  revision?: number;
  ownerId?: string;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

function mapPdfErrorCode(code: string): string {
  switch (code) {
    case 'PDF_SIZE_LIMIT':
      return 'PDF file exceeds the 25 MiB size limit. Select a smaller source.';
    case 'INVALID_PDF_UPLOAD':
      return 'Please select a valid, unencrypted PDF document.';
    case 'STALE_WORKSPACE':
      return 'Workspace was updated elsewhere. Please refresh and retry.';
    case 'SOURCE_CAPABILITY_DISABLED':
      return 'PDF uploads are currently unavailable on this workspace.';
    case 'UNAUTHORIZED':
      return 'Session expired. Please sign in again.';
    default:
      return 'Failed to upload PDF. Please retry.';
  }
}

function getSourceProvenanceSummary(source: CohortSource): React.ReactNode {
  const segmentCount = source.locations?.length ?? 0;

  if (source.input?.kind === 'pdf') {
    const pageCount = source.provenance?.pageCount;
    return (
      <span>
        {pageCount ? `${pageCount} pages` : 'PDF'}
        {segmentCount > 0 ? ` · ${segmentCount} extracted segments` : ''}
      </span>
    );
  }

  if (source.input?.kind === 'web') {
    return (
      <span>
        {segmentCount > 0 ? `${segmentCount} extracted segments · ` : ''}
        {source.input.url}
      </span>
    );
  }

  if (source.input?.kind === 'youtube') {
    const isObs =
      source.input.mode === 'video_observation' ||
      source.provenance?.scope === 'video_observation';
    if (isObs) {
      return (
        <span>
          Retained video observations ready · Coverage is non-exhaustive; timestamps are estimated.
          {source.input.url ? ` · ${source.input.url}` : ''}
        </span>
      );
    }
    const track = source.input.track ?? source.provenance?.track;
    const trackDetails = track ? `${track.language} (${track.kind}) captions` : 'Transcript';
    return (
      <span>
        {trackDetails}
        {source.input.url ? ` · ${source.input.url}` : ''}
      </span>
    );
  }

  if (source.input?.kind === 'github') {
    const paths = source.input.paths?.length
      ? source.input.paths.join(', ')
      : 'All files';
    return (
      <span>
        GitHub: {source.input.repoUrl} · Ref: {source.input.ref ?? 'main'} · Paths: {paths}
        {segmentCount > 0 ? ` · ${segmentCount} extracted segments` : ''}
      </span>
    );
  }

  // Text source fallback
  return (
    <span>
      {source.text ? `${source.text.length} characters` : 'Retained text'}
      {segmentCount > 0 ? ` · ${segmentCount} extracted segments` : ''}
    </span>
  );
}

function getSourceErrorMessage(
  source: CohortSource,
  jobs?: CohortWorkspace['processing']['jobs']
): string {
  const job = jobs?.find(j => j.sourceId === source.id && j.status === 'failed');
  const code = job?.error ?? '';
  if (code === 'PDF_PARSE_FAILED')
    return 'Could not read text from this PDF. Try uploading an unencrypted PDF or pasting text.';
  if (code === 'URL_NOT_FOUND' || code === 'FETCH_FAILED')
    return 'Could not reach the website. Verify the URL is publicly accessible.';
  if (code === 'YOUTUBE_UNAVAILABLE' || code === 'TRANSCRIPT_UNAVAILABLE')
    return 'Could not retrieve video content. You can retry or paste text instead.';
  if (code === 'RATE_LIMITED')
    return 'Service is currently busy. Please retry shortly.';
  if (code) return `Preparation failed (${code}).`;
  return 'Preparation failed. Please retry or replace this source.';
}

export function MaterialStageView({
  workspace,
  workspaceId: propWorkspaceId,
  revision: propRevision,
  ownerId: propOwnerId,
  dispatchAction,
}: MaterialStageViewProps) {
  const interactionState = useInteractionState<CohortWorkspace>();
  const { data: session } = useSession();

  const effectiveWorkspaceId =
    propWorkspaceId || interactionState?.workspaceId || '';
  const effectiveRevision =
    propRevision !== undefined ? propRevision : interactionState?.revision ?? 0;
  const effectiveOwnerId =
    propOwnerId || session?.user?.id || '';

  const [mode, setMode] = useState<'file' | 'paste' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacingSourceId, setReplacingSourceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const replacingSource = workspace.sources.find(s => s.id === replacingSourceId);

  // Shared file handler for picker and drag-and-drop
  const handleFileSelection = async (selectedFile: File) => {
    setError(null);
    if (!selectedFile) return;

    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
    const isText = /\.(md|markdown|txt)$/i.test(selectedFile.name);

    if (!isPdf && !isText) {
      setError('Please select a .pdf, .md, .markdown or .txt file.');
      return;
    }

    setBusy(true);
    try {
      if (isPdf) {
        const idempotencyKey = crypto.randomUUID();
        const response = await fetch(
          `/api/cohort-builder/workspaces/${effectiveWorkspaceId}/pdf`,
          {
            method: 'POST',
            body: selectedFile,
            headers: {
              'Content-Type': 'application/pdf',
              'Idempotency-Key': idempotencyKey,
              'X-Workspace-Revision': String(effectiveRevision),
              'X-Owner-Id': effectiveOwnerId,
              'X-Source-Label': encodeURIComponent(selectedFile.name),
            },
          }
        );

        if (!response.ok) {
          let code = 'UPLOAD_UNAVAILABLE';
          try {
            const resJson = await response.json();
            code = resJson.code ?? code;
          } catch {}
          setError(mapPdfErrorCode(code));
          setFile(selectedFile); // Preserve failed input for retry
          return;
        }

        setFile(null);
        setReplacingSourceId(null);
      } else {
        const textContent = await selectedFile.text();
        if (!textContent.trim()) {
          setError('The selected file is empty.');
          return;
        }

        const ok = await dispatchAction({
          type: 'add_text_source',
          label: selectedFile.name,
          text: textContent,
          sourceId: replacingSourceId ?? undefined,
        });

        if (ok) {
          setFile(null);
          setReplacingSourceId(null);
        } else {
          setError('Could not save text source. Your input was preserved for retry.');
          setFile(selectedFile); // Preserve failed input for retry
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Upload failed. Your input was preserved for retry.'
      );
      setFile(selectedFile); // Preserve failed input for retry
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:') {
        setError('Please enter a public HTTPS URL.');
        return;
      }
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const isYouTube = /youtube\.com|youtu\.be/i.test(trimmedUrl);
      let ok = false;
      if (isYouTube) {
        ok = await dispatchAction({
          type: 'add_youtube_source',
          url: trimmedUrl,
          label: trimmedUrl,
          mode: 'video_observation',
          sourceId: replacingSourceId ?? undefined,
        });
      } else {
        ok = await dispatchAction({
          type: 'add_web_source',
          url: trimmedUrl,
          label: trimmedUrl,
          sourceId: replacingSourceId ?? undefined,
        });
      }

      if (ok) {
        setUrl('');
        setReplacingSourceId(null);
      } else {
        setError('Could not add this link. Your input was preserved for retry.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not add link. Your input was preserved for retry.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAddText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) {
      setError('Please enter some text before saving.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const label = textTitle.trim() || 'Pasted text';
      const ok = await dispatchAction({
        type: 'add_text_source',
        label,
        text: trimmedText,
        sourceId: replacingSourceId ?? undefined,
      });

      if (ok) {
        setText('');
        setTextTitle('');
        setReplacingSourceId(null);
      } else {
        setError('Could not save text source. Your input was preserved for retry.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save text. Your input was preserved for retry.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRetrySource = async (source: CohortSource) => {
    setBusy(true);
    setError(null);
    try {
      const failedJob = workspace.processing?.jobs?.find(
        j => j.sourceId === source.id && j.status === 'failed'
      );
      if (failedJob) {
        await dispatchAction({ type: 'retry_text_job', jobId: failedJob.id });
        return;
      }

      if (source.input?.kind === 'web') {
        await dispatchAction({
          type: 'refresh_web_source',
          sourceId: source.id,
          url: source.input.url,
        });
      } else if (source.input?.kind === 'youtube') {
        await dispatchAction({
          type: 'add_youtube_source',
          sourceId: source.id,
          url: source.input.url,
          label: source.label,
          mode: source.input.mode ?? 'video_observation',
        });
      } else {
        await dispatchAction({ type: 'retry_processing' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    if (workspace.sources.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await dispatchAction({ type: 'begin_material_processing' });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to begin material processing.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Learning material" className={styles.workspace}>
      {/* Real collage paper decorations matching legacy / Screen 4 */}
      <div className={styles.decorations} aria-hidden="true">
        <span className={styles.photo}>
          <Image
            src="/images/hero-collage/real-cathedral.jpg"
            alt=""
            fill
            sizes="220px"
          />
        </span>
        <span className={styles.note}>
          Same content.
          <br />
          More progress.
        </span>
        <span className={styles.books}>
          <Image
            src="/images/hero-collage/real-mug-books.jpg"
            alt=""
            fill
            sizes="270px"
          />
        </span>
      </div>

      {/* Editorial Header matching AFTER Screen 4 */}
      <header className={styles.heading}>
        <p className={styles.eyebrow}>GIVE ME WHAT YOU’VE GOT</p>
        <h1>
          Paste a link, upload a file, <br />
          or drop <span>your material<InkUnderline className={styles.underline} /></span> here.
        </h1>
        <p className={styles.subtitle}>
          You can give me multiple sources — videos, PDFs, websites, code, or notes.
          <br />
          I’ll understand them and turn them into a structured learning journey.
        </p>
      </header>

      {/* Replacement Banner */}
      {replacingSourceId && (
        <div className={styles.replacementAlert} role="status">
          <span>
            {replacingSource
              ? `Replacing ${replacingSource.label}. The current source stays selected until the replacement is saved.`
              : 'Replacing source. Cancel replacement before adding another source.'}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setReplacingSourceId(null);
              setError(null);
            }}
          >
            Cancel replacement
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className={styles.inputErrorAlert} role="alert">
          {error}
        </div>
      )}

      {/* Material Input Panel */}
      <div className={styles.inputPanel}>
        {mode === 'file' ? (
          <div
            className={styles.drop}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={e => {
              e.preventDefault();
              const droppedFiles = e.dataTransfer.files;
              if (droppedFiles && droppedFiles.length > 0) {
                void handleFileSelection(droppedFiles[0]);
              }
            }}
          >
            <button
              type="button"
              className={styles.pickFile}
              disabled={busy}
              aria-label="Choose a file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={32} />
            </button>
            <strong>Drop your material here</strong>
            <button
              type="button"
              className={styles.pasteLink}
              disabled={busy}
              onClick={() => setMode('url')}
            >
              or paste a link
            </button>
            <label className={styles.fileLabel} htmlFor="material-file-picker">
              Choose or drop a PDF/text/Markdown file
            </label>
            <input
              ref={fileInputRef}
              id="material-file-picker"
              type="file"
              className={styles.fileInputHidden}
              accept=".pdf,.md,.markdown,.txt"
              disabled={busy}
              onChange={e => {
                const selected = e.target.files;
                if (selected && selected.length > 0) {
                  void handleFileSelection(selected[0]);
                }
              }}
            />
            {file && (
              <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
                Selected: {file.name}{' '}
                <button
                  type="button"
                  className={styles.retryBtn}
                  disabled={busy}
                  onClick={() => void handleFileSelection(file)}
                >
                  Retry upload
                </button>
              </p>
            )}
          </div>
        ) : mode === 'url' ? (
          <form className={styles.form} onSubmit={handleAddUrl}>
            <label htmlFor="material-url">Public article or YouTube URL</label>
            <div className={styles.urlInput}>
              <LinkIcon size={18} aria-hidden="true" />
              <input
                id="material-url"
                type="url"
                placeholder="https://…"
                required
                maxLength={2048}
                pattern="https://.*"
                disabled={busy}
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={busy || !url.trim()}
            >
              Save and acquire material
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleAddText}>
            <label htmlFor="material-text-title">Source title (optional)</label>
            <input
              id="material-text-title"
              type="text"
              placeholder="e.g. System design notes"
              maxLength={300}
              disabled={busy}
              value={textTitle}
              onChange={e => setTextTitle(e.target.value)}
            />
            <label htmlFor="material-text">Learning text</label>
            <textarea
              id="material-text"
              rows={6}
              required
              disabled={busy}
              placeholder="Paste notes, article text, or Markdown here..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={busy || !text.trim()}
            >
              Save text source
            </button>
          </form>
        )}

        {/* Mode Buttons */}
        <div className={styles.cards} aria-label="Material input options">
          <button
            type="button"
            disabled={busy}
            aria-pressed={mode === 'file'}
            onClick={() => {
              setMode('file');
              setError(null);
            }}
          >
            <Upload size={22} aria-hidden="true" />
            Upload a file
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={mode === 'paste'}
            onClick={() => {
              setMode('paste');
              setError(null);
            }}
          >
            <FileText size={22} aria-hidden="true" />
            Paste text
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={mode === 'url'}
            onClick={() => {
              setMode('url');
              setError(null);
            }}
          >
            <Globe size={22} aria-hidden="true" />
            Paste a link
          </button>
        </div>
      </div>

      {/* Accordion: Supported sources and limits */}
      <details className={styles.limits}>
        <summary>Supported sources and limits</summary>
        <p>
          UTF-8 text or Markdown, up to 1 MiB per source. Files and pasted text follow the same saved acquisition flow.
        </p>
        <p>
          PDFs: up to 25 MiB, 200 pages and 1 MiB extracted text. Text is anchored to pages; images and annotations are not interpreted.
        </p>
        <p>
          Public HTTPS articles are captured on the server. Main-article text is selected from HTML; the full response remains retained.
        </p>
        <p>
          Public YouTube links retain metadata and video observations. These are AI interpretations with estimated timestamps, not transcripts or exhaustive coverage.
        </p>
        <p>
          Up to 20 sources. Content that exceeds a limit must be narrowed or supplied as a supported alternative.
        </p>
      </details>

      {/* Added Material Section */}
      {workspace.sources.length > 0 && (
        <section className={styles.addedMaterialSection} aria-label="Added material">
          <h2 className={styles.sourceHeading}>Added material</h2>
          <ul className={styles.sources}>
            {workspace.sources.map((source, index) => {
              const isFailed = source.state === 'failed';
              const errorMessage = isFailed
                ? getSourceErrorMessage(source, workspace.processing?.jobs)
                : null;

              return (
                <li
                  key={source.id}
                  id={`creation-material-${source.id}`}
                  className={styles.sourceItem}
                >
                  <div className={styles.sourceIconCol}>
                    {isFailed ? (
                      <AlertCircle
                        className={styles.sourceAlertIcon}
                        size={24}
                        aria-label="Failed"
                      />
                    ) : (
                      <CircleCheck
                        className={styles.sourceReadyIcon}
                        data-ready
                        size={24}
                        aria-label="Ready"
                      />
                    )}
                  </div>

                  <div className={styles.sourceDetails}>
                    <h3 className={styles.sourceTitle}>
                      {source.label || `Source ${index + 1}`}
                    </h3>
                    <div className={styles.sourceProvenance}>
                      {getSourceProvenanceSummary(source)}
                    </div>
                    {isFailed && (
                      <div className={styles.failedErrorRow} role="alert">
                        <span>{errorMessage}</span>
                        <button
                          type="button"
                          className={styles.retryBtn}
                          disabled={busy}
                          onClick={() => void handleRetrySource(source)}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={styles.sourceActions}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setReplacingSourceId(source.id);
                        setError(null);
                      }}
                    >
                      Replace source {index + 1}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void dispatchAction({
                          type: 'remove_source',
                          sourceId: source.id,
                        })
                      }
                    >
                      Remove source {index + 1}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Saved message */}
      {workspace.sources.length > 0 && (
        <p className={styles.savedMessage}>
          Sources are saved. Continue below to understand your material.
        </p>
      )}

      {/* Accordion: Connected accounts */}
      <details className={styles.connections}>
        <summary>Connected accounts</summary>
        <p>
          Manage access to your connected external services. Private repositories and workspace pages use your connected account.
        </p>
      </details>

      {/* Continue CTA */}
      <div className={styles.continueSection}>
        <button
          type="button"
          className={styles.continueBtn}
          disabled={workspace.sources.length === 0 || busy}
          onClick={() => void handleContinue()}
        >
          <span>Continue to curriculum</span>
          <span className={styles.continueBtnSub}>Understand material</span>
        </button>
      </div>
    </section>
  );
}
