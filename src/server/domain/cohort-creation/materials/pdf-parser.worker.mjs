import { parentPort, workerData } from 'node:worker_threads';

// Only retained bytes enter PDF.js. No URL, JavaScript evaluation, rendering or external resources.
let document;
try {
  const { getDocument } = await import(workerData.moduleUrl);
  const task = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false,
    disableFontFace: true, useSystemFonts: false, useWorkerFetch: false,
    disableAutoFetch: true, disableStream: true, enableXfa: false, stopAtErrors: true, verbosity: 0 });
  document = await task.promise;
  if (document.numPages > workerData.maxPages) throw Object.assign(new Error('PDF exceeds 200 pages. Select a smaller document; nothing was truncated.'), { code: 'LIMIT_EXCEEDED' });
  const pages = []; let length = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pieces = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const piece = item.str + (item.hasEOL ? '\n' : ' ');
      length += Buffer.byteLength(piece, 'utf8');
      if (length > workerData.maxTextBytes) throw Object.assign(new Error('PDF text exceeds 1 MiB. Select a smaller document; nothing was truncated.'), { code: 'LIMIT_EXCEEDED' });
      pieces.push(piece);
    }
    const text = pieces.join('').trim();
    if (!text) throw Object.assign(new Error(`Page ${pageNumber} has no extractable text. Supply OCR text or a text alternative; no pages were skipped.`), { code: 'INVALID_INPUT' });
    pages.push(text); length += 2; page.cleanup();
    if (length > workerData.maxTextBytes) throw Object.assign(new Error('PDF text exceeds 1 MiB. Select a smaller document; nothing was truncated.'), { code: 'LIMIT_EXCEEDED' });
  }
  parentPort.postMessage({ pages });
} catch (error) {
  const message = error.name === 'PasswordException' ? 'Password-protected PDFs require an unlocked text alternative.'
    : error.code ? error.message : 'PDF could not be parsed. Supply a valid PDF or text alternative.';
  parentPort.postMessage({ error: { code: error.code === 'LIMIT_EXCEEDED' ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT', message } });
} finally {
  await document?.destroy();
}
