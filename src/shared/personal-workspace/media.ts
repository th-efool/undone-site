import { computeSha256 } from './serialization';
import type {
  AssetRecord,
  AssetMimeType,
  KanbanCard,
} from './contracts';

export interface ParsedDataUrl {
  mimeType: AssetMimeType;
  base64Data: string;
  byteLength: number;
}

/**
 * Parses a data URL (e.g. data:image/png;base64,iVBORw...) into its components.
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const meta = dataUrl.slice(5, commaIdx);
  const base64Data = dataUrl.slice(commaIdx + 1);

  const isBase64 = meta.includes(';base64');
  if (!isBase64) return null;

  const mimeType = (meta.split(';')[0] || 'application/octet-stream') as AssetMimeType;

  // Compute decoded raw binary byte length
  const padding = (base64Data.match(/=+$/) || [''])[0].length;
  const byteLength = Math.max(0, Math.floor((base64Data.length * 3) / 4) - padding);

  return {
    mimeType,
    base64Data,
    byteLength,
  };
}

/**
 * Returns the appropriate file extension for a given MIME type.
 */
export function getExtensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/apng': 'apng',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
  };
  return map[mimeType.toLowerCase()] || 'bin';
}

/**
 * Builds the canonical Git repository path for an asset by its hash.
 */
export function getAssetStoragePath(hash: string, mimeType: string): string {
  const ext = getExtensionForMimeType(mimeType);
  return `undone/assets/${hash}.${ext}`;
}

/**
 * Converts a raw base64 string or data URL into a content-addressable AssetRecord.
 */
export function createAssetRecord(
  dataUrlOrBase64: string,
  fallbackMime: AssetMimeType = 'image/png'
): AssetRecord {
  const parsed = parseDataUrl(dataUrlOrBase64);
  const base64Data = parsed ? parsed.base64Data : dataUrlOrBase64;
  const mimeType = parsed ? parsed.mimeType : fallbackMime;

  let byteLength = parsed?.byteLength;
  if (byteLength === undefined) {
    const padding = (base64Data.match(/=+$/) || [''])[0].length;
    byteLength = Math.max(0, Math.floor((base64Data.length * 3) / 4) - padding);
  }

  // Canonical SHA-256 of decoded raw binary
  const rawBytes = typeof Buffer !== 'undefined'
    ? Buffer.from(base64Data, 'base64')
    : new Uint8Array(
        atob(base64Data)
          .split('')
          .map((c) => c.charCodeAt(0))
      );

  const hash = computeSha256(rawBytes);

  return {
    id: hash,
    hash,
    mimeType,
    byteLength,
    base64Data,
  };
}

/**
 * Scans an Excalidraw scene, extracts all embedded image files and GIF/media embeddables,
 * converts them to content-addressable AssetRecords, and replaces large inline data URLs
 * with lightweight `asset://${hash}` references.
 */
export function extractAssetsFromCanvasScene(scene: {
  elements?: Array<Record<string, unknown>>;
  files?: Record<string, unknown>;
}): {
  cleanElements: Array<Record<string, unknown>>;
  cleanFiles: Record<string, unknown>;
  extractedAssets: AssetRecord[];
} {
  const extractedAssets: AssetRecord[] = [];
  const assetHashMap = new Map<string, AssetRecord>();

  const rawFiles = scene.files || {};
  const cleanFiles: Record<string, unknown> = {};

  // 1. Process files map
  for (const [fileId, fileObj] of Object.entries(rawFiles)) {
    if (fileObj && typeof fileObj === 'object') {
      const f = fileObj as { dataURL?: string; mimeType?: string; [k: string]: unknown };
      if (f.dataURL && f.dataURL.startsWith('data:')) {
        const asset = createAssetRecord(f.dataURL, (f.mimeType as AssetMimeType) || 'image/png');
        if (!assetHashMap.has(asset.hash)) {
          assetHashMap.set(asset.hash, asset);
          extractedAssets.push(asset);
        }
        cleanFiles[fileId] = {
          ...f,
          dataURL: `asset://${asset.hash}`,
          assetHash: asset.hash,
        };
        continue;
      }
    }
    cleanFiles[fileId] = fileObj;
  }

  // 2. Process elements array (including embeddables with data URLs)
  const cleanElements: Array<Record<string, unknown>> = [];
  for (const element of scene.elements || []) {
    if (!element || typeof element !== 'object') {
      cleanElements.push(element);
      continue;
    }

    const el = { ...element };

    // Check if embeddable element contains an inline data URL in link
    if (typeof el.link === 'string' && el.link.startsWith('data:')) {
      const asset = createAssetRecord(el.link);
      if (!assetHashMap.has(asset.hash)) {
        assetHashMap.set(asset.hash, asset);
        extractedAssets.push(asset);
      }
      el.link = `asset://${asset.hash}`;
      el.assetHash = asset.hash;
      el.assetMimeType = asset.mimeType;
    }

    cleanElements.push(el);
  }

  return {
    cleanElements,
    cleanFiles,
    extractedAssets,
    sanitizedScene: {
      ...scene,
      elements: cleanElements,
      files: cleanFiles,
    },
  };
}

/**
 * Scans Kanban cards for card covers and attachments, extracts them to AssetRecords,
 * and normalizes inline data URLs to `asset://${hash}` references.
 */
export function extractAssetsFromKanbanCards(cards: KanbanCard[]): {
  cleanCards: KanbanCard[];
  extractedAssets: AssetRecord[];
} {
  const extractedAssets: AssetRecord[] = [];
  const assetHashMap = new Map<string, AssetRecord>();

  const cleanCards = cards.map((card) => {
    let cover = card.cover;
    let assetFileIds = card.assetFileIds ? [...card.assetFileIds] : [];

    if (typeof cover === 'string' && cover.startsWith('data:')) {
      const asset = createAssetRecord(cover);
      if (!assetHashMap.has(asset.hash)) {
        assetHashMap.set(asset.hash, asset);
        extractedAssets.push(asset);
      }
      cover = `asset://${asset.hash}`;
      if (!assetFileIds.includes(asset.hash)) {
        assetFileIds.push(asset.hash);
      }
    } else if (cover && typeof cover === 'object' && (cover as any).dataUrl) {
      const asset = createAssetRecord((cover as any).dataUrl);
      if (!assetHashMap.has(asset.hash)) {
        assetHashMap.set(asset.hash, asset);
        extractedAssets.push(asset);
      }
      cover = `asset://${asset.hash}`;
      if (!assetFileIds.includes(asset.hash)) {
        assetFileIds.push(asset.hash);
      }
    }

    return {
      ...card,
      cover,
      assetFileIds: assetFileIds.length > 0 ? assetFileIds : undefined,
    };
  });

  return {
    cleanCards,
    extractedAssets,
  };
}

/**
 * Checks if a MIME type or content represents animated or vector media.
 */
export function isAnimatedMedia(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return (
    lower.includes('gif') ||
    lower.includes('apng') ||
    lower.includes('webp') ||
    lower.includes('video/')
  );
}

export function isAudioOrVideo(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return lower.startsWith('audio/') || lower.startsWith('video/');
}

export function isVectorMedia(mimeType: string): boolean {
  return mimeType.toLowerCase().includes('svg');
}
