import { sha256 } from '@/src/shared/cohort-builder/hash';
import type { ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';

export interface PdfClientExtractionResult extends ClientSourceExtraction {
  thumbnailUrl: string;
  pageCount: number;
}

export async function extractPdfClient(
  file: File,
  options: { maxPages?: number; maxChars?: number; targetThumbnailWidth?: number } = {}
): Promise<PdfClientExtractionResult> {
  const maxPages = options.maxPages ?? 200;
  const maxChars = options.maxChars ?? 200_000;
  const targetThumbnailWidth = options.targetThumbnailWidth ?? 320;

  // Dynamically import pdfjs-dist in the browser to keep initial bundle size lean
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = typeof window !== 'undefined' ? '/pdf.worker.min.mjs' : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  let thumbnailUrl = '';
  let fullText = '';
  const locations: Array<{ start: number; end: number; page: number }> = [];

  const pagesToScan = Math.min(pdf.numPages, maxPages);

  for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // Generate Page 1 thumbnail on the browser canvas
    if (pageNum === 1) {
      try {
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = targetThumbnailWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          thumbnailUrl = canvas.toDataURL('image/webp', 0.85);
        }
      } catch {
        // Fallback thumbnail gracefully omitted if canvas rendering fails
      }
    }

    // Extract text content and build character span locations
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items
      .map((item: { str?: string }) => ('str' in item ? item.str : ''))
      .filter((s: string) => Boolean(s && s.trim()));

    const pageText = pageStrings.join(' ').replace(/[\r\n\t]+/g, ' ').trim();
    if (pageText) {
      if (fullText.length > 0) fullText += '\n\n';
      const actualStart = fullText.length;
      fullText += pageText;
      const actualEnd = fullText.length;

      locations.push({
        start: actualStart,
        end: actualEnd,
        page: pageNum,
      });

      if (fullText.length >= maxChars) {
        fullText = fullText.slice(0, maxChars);
        locations[locations.length - 1].end = fullText.length;
        break;
      }
    }
  }

  if (!fullText.trim()) throw new Error('No selectable text found (scanned or image-only PDF).');

  const checksum = sha256(fullText);

  return {
    text: fullText,
    locations,
    pageCount: pdf.numPages,
    thumbnailUrl,
    checksum,
    provenance: {
      parserVersion: `pdfjs-${pdfjs.version || 'client-v1'}`,
      rawChecksum: checksum,
      scope: 'selected_pages',
      pageCount: pdf.numPages,
    },
  };
}



