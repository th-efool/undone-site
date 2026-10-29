import { sha256 } from '@/src/shared/cohort-builder/hash';
import type { ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';

export interface WebExtractionOptions {
  maxChars?: number;
}

export async function extractWebClient(
  url: string,
  options: WebExtractionOptions = {}
): Promise<ClientSourceExtraction & { title: string; host: string; kind: 'web' | 'notion' }> {
  const maxChars = options.maxChars ?? 200_000;

  // Fetch SSRF-safe HTML payload via stateless proxy
  const previewRes = await fetch(`/api/import/link-preview?url=${encodeURIComponent(url)}`);
  if (!previewRes.ok) {
    const errorData = await previewRes.json().catch(() => null);
    throw new Error(errorData?.error || `Failed to fetch web source (HTTP ${previewRes.status})`);
  }

  const {
    title = 'Web Article',
    host = new URL(url).hostname,
    kind = 'web',
    content = '',
  } = await previewRes.json();

  let extractedText = '';
  const locations: Array<{ start: number; end: number }> = [];

  // Parse HTML directly with browser's native C++ DOMParser (zero worker threads!)
  if (typeof DOMParser !== 'undefined' && content) {
    const doc = new DOMParser().parseFromString(content, 'text/html');

    // Remove boilerplate elements
    const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'svg', 'iframe'];
    removeSelectors.forEach((sel) => {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const root = doc.querySelector('main') || doc.querySelector('article') || doc.body;

    const blockNodes = root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre');
    const seenTexts = new Set<string>();

    for (const node of Array.from(blockNodes)) {
      const text = node.textContent?.replace(/[\r\n\t]+/g, ' ').trim();
      if (!text || text.length < 5 || seenTexts.has(text)) continue;
      seenTexts.add(text);

      const tag = node.tagName.toLowerCase();
      let formatted = text;
      if (tag === 'h1') formatted = `# ${text}`;
      else if (tag === 'h2') formatted = `## ${text}`;
      else if (tag === 'h3') formatted = `### ${text}`;
      else if (tag === 'li') formatted = `â€¢ ${text}`;

      if (extractedText.length > 0) extractedText += '\n\n';
      const start = extractedText.length;
      extractedText += formatted;
      const end = extractedText.length;

      locations.push({ start, end });

      if (extractedText.length >= maxChars) {
        extractedText = extractedText.slice(0, maxChars);
        locations[locations.length - 1].end = extractedText.length;
        break;
      }
    }
  }

  if (!extractedText.trim()) throw new Error('No readable text found on this page (it may require JavaScript or a login).');

  const checksum = sha256(extractedText);

  return {
    title,
    host,
    kind,
    text: extractedText,
    locations,
    checksum,
    provenance: {
      parserVersion: 'web-client-dom-v1',
      rawChecksum: checksum,
      scope: 'main_article',
      finalUrl: url,
    },
  };
}

