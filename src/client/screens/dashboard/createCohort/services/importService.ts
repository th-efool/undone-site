'use client';

import { apiUrl } from '@/src/shared/api/apiUrl';
import type {
  ImportSourceAdapterContext,
  ImportSourceJob,
  ImportStreamEvent,
  ImportedSourceModel,
} from '../models/import';
import type { CreateCohortSourceDraft } from '../models/createCohort';

type AdapterResult = ImportSourceJob;

interface ImportAdapter {
  canHandle(source: CreateCohortSourceDraft): boolean;
  importSource(context: ImportSourceAdapterContext): AdapterResult;
}

class UniversalSourceAdapter implements ImportAdapter {
  canHandle(_source: CreateCohortSourceDraft) {
    return true;
  }

  importSource(context: ImportSourceAdapterContext): AdapterResult {
    const signal = context.signal;

    const promise = (async () => {
      let endpoint = '/api/import/youtube/playlist';
      if (context.source.type === 'Notion Workspace') {
        endpoint = '/api/import/notion';
      } else if (context.source.type === 'GitHub Repository') {
        endpoint = '/api/import/github';
      }

      const response = await fetch(apiUrl(endpoint), {
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

const adapters: ImportAdapter[] = [new UniversalSourceAdapter()];

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
