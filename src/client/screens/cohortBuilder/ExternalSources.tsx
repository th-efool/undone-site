'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useDispatchAction, useInteractionState } from '@/src/client/interaction/hooks';
import type { CohortAction, CohortSource, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';
import styles from './CohortBuilder.module.css';
import { CohortDraftProvider, useCohortDrafts } from './draft-context';

export interface PdfConnectorCardProps {
  workspaceId: string;
  revision: number;
  ownerId?: string;
}

export const PdfConnectorCard = memo(function PdfConnectorCard({
  workspaceId,
  revision,
  ownerId,
}: PdfConnectorCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ticket = useRef<{ requestId: string; revision: number; ownerId: string } | null>(null);

  async function upload() {
    if (!file || !ownerId || busy) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('PDF exceeds 2 MiB. Choose a smaller document.');
      return;
    }
    const attempt = ticket.current ?? {
      requestId: crypto.randomUUID(),
      revision,
      ownerId,
    };
    ticket.current = attempt;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/cohort-builder/workspaces/${workspaceId}/pdf`, {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': 'application/pdf',
          'Idempotency-Key': attempt.requestId,
          'X-Workspace-Revision': String(attempt.revision),
          'X-Owner-Id': attempt.ownerId,
          'X-Source-Label': encodeURIComponent(label.trim() || file.name),
        },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.code ?? 'UPLOAD_UNAVAILABLE');
      }
      ticket.current = null;
      setFile(null);
      setLabel('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'UPLOAD_UNAVAILABLE');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <fieldset disabled={busy} className={styles.formField}>
        <legend>Retain PDF</legend>
        <label htmlFor="builder-pdf-label">PDF title</label>
        <input
          id="builder-pdf-label"
          value={label}
          onChange={event => {
            setLabel(event.target.value);
            ticket.current = null;
          }}
          maxLength={300}
        />
        <label htmlFor="builder-pdf">PDF file (2 MiB maximum)</label>
        <input
          id="builder-pdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={event => {
            setFile(event.target.files?.[0] ?? null);
            ticket.current = null;
            setError('');
          }}
        />
        <p>
          Readable text only, up to 200 pages. No OCR. Scanned, encrypted, or partly unreadable
          documents are rejected. Unacknowledged files stay here until you leave this page.
        </p>
        <button disabled={!file} onClick={() => void upload()}>
          {busy ? 'Uploading PDF…' : 'Add PDF source'}
        </button>
      </fieldset>

      {error && (
        <div role="alert">
          <p>{error}. The selected file is retained; retry uses the same submission identity.</p>
          {error === 'STALE_WORKSPACE' && (
            <button
              onClick={() => {
                ticket.current = null;
                setError('Review current workspace, then submit the retained file again.');
              }}
            >
              Use current revision for next attempt
            </button>
          )}
        </div>
      )}
    </>
  );
});

export interface WebConnectorCardProps {
  url: string;
  onUrlChange: (value: string) => void;
  dispatch?: (action: CohortAction) => Promise<boolean>;
}

export const WebConnectorCard = memo(function WebConnectorCard({
  url,
  onUrlChange,
  dispatch,
}: WebConnectorCardProps) {
  const hookDispatch = useDispatchAction<CohortAction>();
  const activeDispatch = dispatch ?? hookDispatch;
  const [busy, setBusy] = useState(false);

  const handleAcquire = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void activeDispatch({
      type: 'add_web_source',
      label: trimmed.slice(0, 300),
      url: trimmed,
    })
      .then(saved => {
        if (saved) onUrlChange('');
      })
      .finally(() => setBusy(false));
  }, [url, busy, activeDispatch, onUrlChange]);

  return (
    <fieldset disabled={busy} className={styles.formField}>
      <legend>Retain public web page</legend>
      <label htmlFor="builder-web-url">Public HTTPS URL</label>
      <input
        id="builder-web-url"
        type="url"
        value={url}
        onChange={event => onUrlChange(event.target.value)}
        maxLength={2048}
      />
      <p>
        Public HTTPS, UTF-8 HTML or text, at most 1 MiB. No logins, scripts, compressed
        responses, or exhaustive article-coverage guarantee.
      </p>
      <button disabled={!url.trim()} onClick={handleAcquire}>
        Add web source
      </button>
    </fieldset>
  );
});

export interface YoutubeConnectorCardProps {
  url: string;
  onUrlChange: (value: string) => void;
  dispatch?: (action: CohortAction) => Promise<boolean>;
}

export const YoutubeConnectorCard = memo(function YoutubeConnectorCard({
  url,
  onUrlChange,
  dispatch,
}: YoutubeConnectorCardProps) {
  const hookDispatch = useDispatchAction<CohortAction>();
  const activeDispatch = dispatch ?? hookDispatch;

  const [ytLabel, setYtLabel] = useState('');
  const [ytTrackLang, setYtTrackLang] = useState('en');
  const [ytTrackKind, setYtTrackKind] = useState<'manual' | 'automatic'>('manual');
  const [busy, setBusy] = useState(false);

  const handleAcquire = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || busy) return;
    setBusy(true);
    const track = {
      id: ytTrackLang.trim() || 'en',
      language: ytTrackLang.trim() || 'en',
      kind: ytTrackKind,
      translated: false as const,
    };
    void activeDispatch({
      type: 'add_youtube_source',
      label: ytLabel.trim() || trimmedUrl,
      url: trimmedUrl,
      track,
    })
      .then(saved => {
        if (saved) {
          onUrlChange('');
          setYtLabel('');
        }
      })
      .finally(() => setBusy(false));
  }, [url, busy, ytTrackLang, ytTrackKind, activeDispatch, ytLabel, onUrlChange]);

  return (
    <fieldset disabled={busy} className={styles.formField}>
      <legend>Retain YouTube video transcript</legend>
      <label htmlFor="builder-yt-label">Video title</label>
      <input
        id="builder-yt-label"
        value={ytLabel}
        onChange={event => setYtLabel(event.target.value)}
        maxLength={300}
        placeholder="e.g. Consensus Lecture"
      />
      <label htmlFor="builder-yt-url">Public YouTube video URL</label>
      <input
        id="builder-yt-url"
        type="url"
        value={url}
        onChange={event => onUrlChange(event.target.value)}
        maxLength={2048}
        placeholder="https://www.youtube.com/watch?v=..."
      />
      <label htmlFor="builder-yt-track-lang">Caption language</label>
      <input
        id="builder-yt-track-lang"
        value={ytTrackLang}
        onChange={event => setYtTrackLang(event.target.value)}
        maxLength={30}
        placeholder="en"
      />
      <label htmlFor="builder-yt-track-kind">Caption track type</label>
      <select
        id="builder-yt-track-kind"
        value={ytTrackKind}
        onChange={event => setYtTrackKind(event.target.value as 'manual' | 'automatic')}
      >
        <option value="manual">Creator uploaded (manual)</option>
        <option value="automatic">Auto-generated (automatic)</option>
      </select>
      <p>
        Public individual YouTube videos with accessible caption tracks only, up to 4 hours.
        No playlists, livestreams, or private videos.
      </p>
      <button disabled={!url.trim()} onClick={handleAcquire}>
        Add YouTube source
      </button>
    </fieldset>
  );
});

export interface GithubConnectorCardProps {
  url: string;
  onUrlChange: (value: string) => void;
  dispatch?: (action: CohortAction) => Promise<boolean>;
}

export const GithubConnectorCard = memo(function GithubConnectorCard({
  url,
  onUrlChange,
  dispatch,
}: GithubConnectorCardProps) {
  const hookDispatch = useDispatchAction<CohortAction>();
  const activeDispatch = dispatch ?? hookDispatch;

  const [ghLabel, setGhLabel] = useState('');
  const [ghRef, setGhRef] = useState('main');
  const [ghPaths, setGhPaths] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAcquire = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || busy) return;
    setBusy(true);
    const parsedPaths = ghPaths
      .split(/[\r\n,]+/)
      .map(p => p.trim())
      .filter(Boolean);
    const action: CohortAction = {
      type: 'add_github_source',
      label: ghLabel.trim() || trimmedUrl,
      repoUrl: trimmedUrl,
      ref: ghRef.trim() || 'main',
      ...(parsedPaths.length > 0 ? { paths: parsedPaths } : {}),
    };
    void activeDispatch(action)
      .then(saved => {
        if (saved) {
          onUrlChange('');
          setGhLabel('');
          setGhRef('main');
          setGhPaths('');
        }
      })
      .finally(() => setBusy(false));
  }, [url, busy, ghPaths, ghLabel, ghRef, activeDispatch, onUrlChange]);

  return (
    <fieldset disabled={busy} className={styles.formField}>
      <legend>Retain GitHub repository files</legend>
      <label htmlFor="builder-gh-label">Repository title</label>
      <input
        id="builder-gh-label"
        value={ghLabel}
        onChange={event => setGhLabel(event.target.value)}
        maxLength={300}
        placeholder="e.g. Core Protocols"
      />
      <label htmlFor="builder-gh-url">Public GitHub repository URL</label>
      <input
        id="builder-gh-url"
        type="url"
        value={url}
        onChange={event => onUrlChange(event.target.value)}
        maxLength={2048}
        placeholder="https://github.com/owner/repo"
      />
      <label htmlFor="builder-gh-ref">Branch, tag, or commit</label>
      <input
        id="builder-gh-ref"
        value={ghRef}
        onChange={event => setGhRef(event.target.value)}
        maxLength={100}
        placeholder="main"
      />
      <label htmlFor="builder-gh-paths">
        Selected files (optional, comma or newline separated, up to 25 files)
      </label>
      <textarea
        id="builder-gh-paths"
        rows={3}
        value={ghPaths}
        onChange={event => setGhPaths(event.target.value)}
        placeholder="README.md&#10;src/index.ts"
      />
      <p>
        Public HTTPS GitHub repositories only, up to 25 text/code files (max 500 KB per file, 2
        MiB total). No binary files, archives, lockfiles, or private repositories.
      </p>
      <button disabled={!url.trim()} onClick={handleAcquire}>
        Add GitHub source
      </button>
    </fieldset>
  );
});

export function ExternalSources() {
  const state = useInteractionState<CohortWorkspace>();
  return (
    <CohortDraftProvider workspaceId={state?.workspaceId ?? 'default'}>
      <InnerExternalSources />
    </CohortDraftProvider>
  );
}

function InnerExternalSources() {
  const state = useInteractionState<CohortWorkspace>();
  const { data: session } = useSession();
  const dispatch = useDispatchAction<CohortAction>();
  const { externalDraft, updateExternalDraft } = useCohortDrafts();

  const [capabilities, setCapabilities] = useState<{
    pdf: boolean;
    web: boolean;
    youtube?: boolean;
    youtubeUnavailableReason?: string;
    github?: boolean;
    githubUnavailableReason?: string;
  }>({ pdf: false, web: false, youtube: false, github: false });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/cohort-builder/workspaces/${state.workspaceId}/sources`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        if (response.ok && active) setCapabilities(await response.json());
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [state.workspaceId]);

  const handleWebUrlChange = useCallback(
    (value: string) => updateExternalDraft({ webUrl: value }),
    [updateExternalDraft]
  );

  const handleYoutubeUrlChange = useCallback(
    (value: string) => updateExternalDraft({ youtubeUrl: value }),
    [updateExternalDraft]
  );

  const handleGithubUrlChange = useCallback(
    (value: string) => updateExternalDraft({ githubUrl: value }),
    [updateExternalDraft]
  );

  return (
    <div aria-label="PDF and web sources">
      {capabilities.pdf && (
        <PdfConnectorCard
          workspaceId={state.workspaceId}
          revision={state.revision}
          ownerId={session?.user?.id}
        />
      )}

      {capabilities.web && (
        <WebConnectorCard
          url={externalDraft.webUrl}
          onUrlChange={handleWebUrlChange}
          dispatch={dispatch}
        />
      )}

      {capabilities.youtube ? (
        <YoutubeConnectorCard
          url={externalDraft.youtubeUrl}
          onUrlChange={handleYoutubeUrlChange}
          dispatch={dispatch}
        />
      ) : capabilities.youtubeUnavailableReason ? (
        <div role="note" aria-label="YouTube unavailable">
          <p>
            YouTube transcript ingestion is currently unavailable ({capabilities.youtubeUnavailableReason}).
          </p>
        </div>
      ) : null}

      {capabilities.github ? (
        <GithubConnectorCard
          url={externalDraft.githubUrl}
          onUrlChange={handleGithubUrlChange}
          dispatch={dispatch}
        />
      ) : capabilities.githubUnavailableReason ? (
        <div role="note" aria-label="GitHub unavailable">
          <p>
            GitHub repository ingestion is currently unavailable ({capabilities.githubUnavailableReason}).
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ExternalSourceScope({ source }: { source: CohortSource }) {
  const state = useInteractionState<CohortWorkspace>();
  return (
    <CohortDraftProvider workspaceId={state?.workspaceId ?? 'default'}>
      <InnerExternalSourceScope source={source} />
    </CohortDraftProvider>
  );
}

function InnerExternalSourceScope({ source }: { source: CohortSource }) {
  const state = useInteractionState<CohortWorkspace>();
  const dispatch = useDispatchAction<CohortAction>();
  const { externalDraft, updateExternalDraft } = useCohortDrafts();

  const [pagesState, setPagesState] = useState(
    source.input?.kind === 'pdf' ? externalDraft.customPages || source.input.pages?.join(',') || '' : ''
  );
  const pages = externalDraft.customPages || pagesState;
  const setPages = (val: string) => {
    setPagesState(val);
    updateExternalDraft({ customPages: val });
  };

  const [startSeconds, setStartSecondsState] = useState(
    source.input?.kind === 'youtube' && source.input.scope
      ? String(Math.floor(source.input.scope.startMs / 1000))
      : ''
  );
  const [endSeconds, setEndSecondsState] = useState(
    source.input?.kind === 'youtube' && source.input.scope
      ? String(Math.floor(source.input.scope.endMs / 1000))
      : ''
  );
  const setStartSeconds = (val: string) => {
    setStartSecondsState(val);
    updateExternalDraft({ selectedScope: `${val}-${endSeconds}` });
  };
  const setEndSeconds = (val: string) => {
    setEndSecondsState(val);
    updateExternalDraft({ selectedScope: `${startSeconds}-${val}` });
  };

  const [githubPaths, setGithubPaths] = useState(
    source.input?.kind === 'github' ? source.input.paths?.join(', ') ?? '' : ''
  );
  const [baseVersion, setBaseVersion] = useState(source.version);
  const [error, setError] = useState('');

  if (!source.input) return null;

  return (
    <span>
      {state.view.processing.jobs?.some(
        job => job.sourceId === source.id && ['queued', 'running', 'failed'].includes(job.status)
      ) && (
        <button
          onClick={() =>
            void dispatch(
              { type: 'cancel_source_processing', sourceId: source.id },
              [{ kind: 'source', id: source.id, version: source.version }]
            )
          }
        >
          Stop {source.label} processing
        </button>
      )}
      {state.view.processing.jobs?.some(
        job => job.sourceId === source.id && job.status === 'canceled'
      ) && <span> · Stopped. Change scope or remove this source to unblock curriculum assembly.</span>}

      {source.input.kind === 'pdf' ? (
        <>
          <label htmlFor={`pages-${source.id}`}>Physical pages (comma-separated)</label>
          <input
            id={`pages-${source.id}`}
            value={pages}
            onChange={event => setPages(event.target.value)}
            placeholder="e.g. 1,2"
          />
          <button
            onClick={() => {
              const selected = pages.split(',').map(value => Number(value.trim()));
              if (source.version !== baseVersion) {
                setError(
                  'Scope changed elsewhere. Your page selection is retained; review the current scope before reapplying.'
                );
                return;
              }
              if (
                selected.some(page => !Number.isInteger(page) || page < 1 || page > 200) ||
                new Set(selected).size !== selected.length
              ) {
                setError('Choose distinct physical pages from 1 to 200.');
                return;
              }
              void dispatch(
                { type: 'set_pdf_pages', sourceId: source.id, pages: selected },
                [{ kind: 'source', id: source.id, version: baseVersion }]
              ).then(saved => {
                if (saved) {
                  setBaseVersion(baseVersion + 1);
                  updateExternalDraft({ customPages: '' });
                }
                setError(
                  saved ? '' : 'Scope changed elsewhere. Your page selection is retained; review and retry.'
                );
              });
            }}
          >
            Apply page scope
          </button>
          {source.version !== baseVersion && (
            <span role="alert">
              Current scope: {source.input.pages?.join(', ') ?? 'all readable pages'}. Your selection
              is retained.{' '}
              <button
                onClick={() => {
                  setBaseVersion(source.version);
                  setError('');
                }}
              >
                Use current source version for my page selection
              </button>
            </span>
          )}
        </>
      ) : source.input.kind === 'youtube' ? (
        <>
          {(() => {
            const currentScope = source.input.scope
              ? `${formatYoutubeTimestamp(source.input.scope.startMs)}–${formatYoutubeTimestamp(
                  source.input.scope.endMs
                )}`
              : 'full transcript';
            return (
              <>
                <span> · Scope: {currentScope}</span>
                <label htmlFor={`start-sec-${source.id}`}>Start (seconds)</label>
                <input
                  id={`start-sec-${source.id}`}
                  value={startSeconds}
                  onChange={event => setStartSeconds(event.target.value)}
                  placeholder="0"
                />
                <label htmlFor={`end-sec-${source.id}`}>End (seconds)</label>
                <input
                  id={`end-sec-${source.id}`}
                  value={endSeconds}
                  onChange={event => setEndSeconds(event.target.value)}
                  placeholder="e.g. 300"
                />
                <button
                  onClick={() => {
                    if (source.version !== baseVersion) {
                      setError(
                        'Scope changed elsewhere. Your transcript selection is retained; review the current scope before reapplying.'
                      );
                      return;
                    }
                    const trimmedStart = startSeconds.trim();
                    const trimmedEnd = endSeconds.trim();
                    let scope: { startMs: number; endMs: number } | undefined = undefined;
                    if (trimmedStart !== '' || trimmedEnd !== '') {
                      const startSec = Number(trimmedStart || '0');
                      const endSec = Number(trimmedEnd);
                      if (
                        !Number.isFinite(startSec) ||
                        !Number.isFinite(endSec) ||
                        startSec < 0 ||
                        endSec <= startSec
                      ) {
                        setError('End seconds must follow start seconds.');
                        return;
                      }
                      scope = {
                        startMs: Math.round(startSec * 1000),
                        endMs: Math.round(endSec * 1000),
                      };
                    }
                    void dispatch(
                      { type: 'set_youtube_scope', sourceId: source.id, scope },
                      [{ kind: 'source', id: source.id, version: baseVersion }]
                    ).then(saved => {
                      if (saved) {
                        setBaseVersion(baseVersion + 1);
                        updateExternalDraft({ selectedScope: '' });
                      }
                      setError(
                        saved
                          ? ''
                          : 'Scope changed elsewhere. Your transcript selection is retained; review and retry.'
                      );
                    });
                  }}
                >
                  Apply transcript scope
                </button>
                {source.version !== baseVersion && (
                  <span role="alert">
                    Current scope: {currentScope}. Your selection is retained.{' '}
                    <button
                      onClick={() => {
                        setBaseVersion(source.version);
                        setError('');
                      }}
                    >
                      Use current source version for my transcript selection
                    </button>
                  </span>
                )}
              </>
            );
          })()}
        </>
      ) : source.input.kind === 'github' ? (
        <>
          {(() => {
            const currentScope = source.input.paths?.length
              ? source.input.paths.join(', ')
              : 'all repository files';
            return (
              <>
                <span> · Files: {currentScope}</span>
                <label htmlFor={`paths-${source.id}`}>Selected files (comma-separated)</label>
                <input
                  id={`paths-${source.id}`}
                  value={githubPaths}
                  onChange={event => setGithubPaths(event.target.value)}
                  placeholder="e.g. README.md, src/index.ts"
                />
                <button
                  onClick={() => {
                    if (source.version !== baseVersion) {
                      setError(
                        'Scope changed elsewhere. Your file selection is retained; review the current scope before reapplying.'
                      );
                      return;
                    }
                    const selected = githubPaths
                      .split(/[\r\n,]+/)
                      .map(p => p.trim())
                      .filter(Boolean);
                    if (selected.length === 0) {
                      setError('Select at least one file.');
                      return;
                    }
                    if (selected.length > 25) {
                      setError('Cannot select more than 25 files.');
                      return;
                    }
                    if (new Set(selected).size !== selected.length) {
                      setError('Duplicate file paths are not permitted.');
                      return;
                    }
                    void dispatch(
                      { type: 'set_github_scope', sourceId: source.id, paths: selected },
                      [{ kind: 'source', id: source.id, version: baseVersion }]
                    ).then(saved => {
                      if (saved) setBaseVersion(baseVersion + 1);
                      setError(
                        saved
                          ? ''
                          : 'Scope changed elsewhere. Your file selection is retained; review and retry.'
                      );
                    });
                  }}
                >
                  Apply file scope
                </button>
                {source.version !== baseVersion && (
                  <span role="alert">
                    Current scope: {currentScope}. Your selection is retained.{' '}
                    <button
                      onClick={() => {
                        setBaseVersion(source.version);
                        setError('');
                      }}
                    >
                      Use current source version for my file selection
                    </button>
                  </span>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <>
          <span> · {source.provenance?.scope ?? 'acquisition pending'}</span>
          <button
            onClick={() =>
              void dispatch(
                { type: 'refresh_web_source', sourceId: source.id },
                [{ kind: 'source', id: source.id, version: source.version }]
              )
            }
          >
            Fetch a new web version
          </button>
        </>
      )}
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
