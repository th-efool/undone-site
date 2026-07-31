'use client';

import type {
  ImportSourceAdapterContext,
  ImportSourceJob,
  ImportStreamEvent,
  ImportedSourceModel,
} from '../models/import';
import type { CreateCohortSourceDraft, CreateCohortSourceType } from '../models/createCohort';

type AdapterResult = ImportSourceJob;

interface ImportAdapter {
  canHandle(source: CreateCohortSourceDraft): boolean;
  importSource(context: ImportSourceAdapterContext): AdapterResult;
}

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function createPendingProviderResult(source: CreateCohortSourceDraft): ImportedSourceModel {
  return {
    id: source.id,
    title: source.title || source.type,
    description: source.url,
    thumbnail: '/images/landing/screen.webp',
    provider: source.type,
    creator: 'Pending provider',
    lessonCount: 0,
    totalDuration: '0m',
    estimatedSeasonCount: 0,
    status: 'pending-provider',
    lessons: [],
  };
}

class PendingAdapter implements ImportAdapter {
  canHandle(source: CreateCohortSourceDraft) {
    return source.type !== 'YouTube Playlist';
  }

  importSource(context: ImportSourceAdapterContext): AdapterResult {
    const result = createPendingProviderResult(context.source);

    const promise = new Promise<ImportedSourceModel>((resolve, reject) => {
      if (context.signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      context.onEvent({
        type: 'feed',
        feed: {
          title: 'Adapter pending',
          detail: `${context.source.type} will be enabled in a future prompt.`,
          tone: 'warning',
        },
      });

      context.onEvent({
        type: 'snapshot',
        snapshot: {
          source: result,
          overallProgress: 100,
          currentOperation: 'Provider-ready placeholder completed',
          currentSourceLabel: context.source.title || context.source.type,
          estimatedRemaining: '0m',
          liveStatus: 'Pending provider',
        },
      });

      resolve(result);
    });

    return {
      promise,
      cancel: () => undefined,
    };
  }
}

class YoutubePlaylistAdapter implements ImportAdapter {
  canHandle(source: CreateCohortSourceDraft) {
    return source.type === 'YouTube Playlist';
  }

  importSource(context: ImportSourceAdapterContext): AdapterResult {
    const signal = context.signal;

    const promise = (async () => {
      const response = await fetch('/api/import/youtube/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceId: context.source.id,
          title: context.source.title,
          url: context.source.url,
          sourceType: context.source.type,
        }),
        signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw error ?? new Error('Import failed');
      }

      if (!response.body) {
        throw new Error('Missing response stream');
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';

      while (true) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let index = buffer.indexOf('\n');
        while (index >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          index = buffer.indexOf('\n');

          if (!line) continue;

          const event = JSON.parse(line) as ImportStreamEvent;
          context.onEvent(event);

          if (event.type === 'complete') {
            return event.complete.source;
          }

          if (event.type === 'error') {
            throw event.error;
          }
        }
      }

      throw new Error('Import stream completed unexpectedly');
    })();

    return {
      promise,
      cancel: () => undefined,
    };
  }
}

const adapters: ImportAdapter[] = [new YoutubePlaylistAdapter(), new PendingAdapter()];

class CohortImportService {
  private adapters = adapters;

  importSource(context: ImportSourceAdapterContext): AdapterResult {
    const controller = new AbortController();
    const adapterContext = {
      ...context,
      signal: controller.signal,
    };
    const adapter = this.adapters.find((item) => item.canHandle(context.source));

    if (!adapter) {
      return {
        promise: Promise.reject(new Error(`No adapter for ${context.source.type}`)),
        cancel: () => undefined,
      };
    }

    const job = adapter.importSource(adapterContext);

    return {
      promise: job.promise,
      cancel: () => {
        controller.abort();
        job.cancel();
      },
    };
  }

  importPlaylist(context: ImportSourceAdapterContext): AdapterResult {
    return this.importSource(context);
  }

  cancelImport(job?: ImportSourceJob | null) {
    job?.cancel();
  }
}

export const importService = new CohortImportService();
