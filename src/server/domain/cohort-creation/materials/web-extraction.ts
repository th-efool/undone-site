import 'server-only';
import { createHash } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { webExtractionArtifactSchema, webResponseReceiptSchema, type WebResponseReceipt } from '@/src/shared/cohort-creation/web';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { segmentRetainedText } from './text';

export const WEB_PARSER_VERSION = 'readability-0.6.0-jsdom-29.1.1-text-v1';
export const WEB_HTML_LIMIT = 2 * 1024 * 1024;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const webExtractionVersion = (checksum: string) => hash(`${WEB_PARSER_VERSION}:${checksum}`);
export const webExtractionFingerprint = (receipt: WebResponseReceipt) => hash(JSON.stringify({ materialId: receipt.materialId,
  inputRevision: receipt.inputRevision, sourceId: receipt.retainedSource.id, checksum: receipt.retainedSource.checksum,
  requestedUrl: receipt.requestedUrl, finalUrl: receipt.finalUrl, parser: WEB_PARSER_VERSION }));
function unsupported(message: string): never { throw new CreationStorageError('INVALID_INPUT', `${message} Upload or paste accessible text.`); }

/** No scripts, resources or HTML output. Offsets address retained extraction text, not raw HTML. */
export function extractWebResponse(bytes: Uint8Array, input: WebResponseReceipt, signal?: AbortSignal) {
  signal?.throwIfAborted(); const receipt = webResponseReceiptSchema.parse(input);
  if (bytes.byteLength !== receipt.retainedSource.byteLength || hash(bytes) !== receipt.retainedSource.checksum) {
    throw new CreationStorageError('INTEGRITY', 'Retained web response does not match its receipt.');
  }
  const html = receipt.mediaType === 'text/html';
  const limit = html ? WEB_HTML_LIMIT : MATERIAL_LIMITS.extractedTextBytes;
  if (bytes.byteLength > limit) throw new CreationStorageError('LIMIT_EXCEEDED', html
    ? 'HTML exceeds the 2 MiB parsing scope. Select a smaller page or paste an excerpt; nothing was truncated.'
    : 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return unsupported('The response is not UTF-8.'); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) unsupported('The response contains binary control characters.');
  let title: string | null = null;
  if (html) {
    const dom = new JSDOM(text, { url: receipt.finalUrl, virtualConsole: new VirtualConsole() });
    try {
      const document = dom.window.document;
      if (document.getElementsByTagName('*').length > 20_000) throw new CreationStorageError('LIMIT_EXCEEDED', 'HTML exceeds 20,000 elements. Select a smaller page; nothing was truncated.');
      if (document.querySelector('input[type="password"]')) unsupported('This page requires authentication.');
      document.querySelectorAll('script,style,noscript,template,iframe,object,embed,form,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
      const pending: { node: Node; depth: number }[] = [{ node: document, depth: 0 }];
      while (pending.length) {
        const { node, depth } = pending.pop()!;
        if (depth > 200) throw new CreationStorageError('LIMIT_EXCEEDED', 'HTML nesting exceeds the parsing scope. Select a simpler page.');
        for (const child of node.childNodes) pending.push({ node: child, depth: depth + 1 });
      }
      signal?.throwIfAborted();
      const article = new Readability<Node>(document, { maxElemsToParse: 20_000, charThreshold: 140,
        disableJSONLD: true, serializer: node => node }).parse();
      if (!article?.content || !article.textContent?.trim() || article.textContent.trim().length < 140) unsupported('No readable article was found (short, login or JavaScript-only page).');
      title = article.title?.trim() || null;
      if (title && title.length > 1000) throw new CreationStorageError('LIMIT_EXCEEDED', 'Article title exceeds the metadata scope. Paste the article text instead.');
      const chunks: string[] = [];
      const walk = (node: Node, depth: number) => {
        signal?.throwIfAborted();
        if (depth > 200) throw new CreationStorageError('LIMIT_EXCEEDED', 'HTML nesting exceeds the parsing scope. Select a simpler page.');
        if (node.nodeType === 3) { chunks.push(node.textContent ?? ''); return; }
        const element = node as Element;
        const block = /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|UL|OL|PRE|BLOCKQUOTE|TR|BR)$/.test(element.tagName ?? '');
        if (block) chunks.push('\n');
        if (/^H[1-6]$/.test(element.tagName ?? '')) chunks.push(`${'#'.repeat(Number(element.tagName[1]))} `);
        for (const child of node.childNodes) walk(child, depth + 1);
        if (block) chunks.push('\n');
      };
      walk(article.content, 0);
      text = chunks.join('').replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } finally { dom.window.close(); }
  }
  signal?.throwIfAborted();
  if (!text.trim()) unsupported('The source contains no readable text.');
  const utf8ByteLength = Buffer.byteLength(text, 'utf8');
  if (utf8ByteLength > MATERIAL_LIMITS.extractedTextBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Extracted text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
  const version = webExtractionVersion(receipt.retainedSource.checksum);
  return webExtractionArtifactSchema.parse({ schemaVersion: 1, materialId: receipt.materialId, unitId: receipt.materialId,
    version, sourceChecksum: receipt.retainedSource.checksum, sourceRef: receipt.retainedSource,
    extractionKind: 'text', contentOrigin: 'external', offsetUnit: 'utf16', text, utf8ByteLength,
    segments: segmentRetainedText(text, receipt.materialId, receipt.materialId, version, signal),
    coverage: { complete: true, omittedRanges: [] }, web: { receipt, parserVersion: WEB_PARSER_VERSION, title,
      scope: html ? 'main_article' : 'full_text_response', format: html ? 'normalized_article_text' : 'exact_response_text' } });
}
