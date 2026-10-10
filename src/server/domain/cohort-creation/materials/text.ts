import { createHash } from 'node:crypto';
import { MATERIAL_LIMITS, textExtractionArtifactSchema, type TextExtractionArtifact } from '@/src/shared/cohort-creation/materials';
import { CreationStorageError, type CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';

export const TEXT_PARSER_VERSION = 'utf8-markdown-offsets-v1';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const textExtractionVersion = (sourceChecksum: string) => hash(`${TEXT_PARSER_VERSION}:${sourceChecksum}`);
export const textAcquisitionFingerprint = (materialId: string, inputRevision: number, sourceRef: CreationObjectRef) =>
  hash(JSON.stringify({ materialId, inputRevision, assetId: sourceRef.id, checksum: sourceRef.checksum, parser: TEXT_PARSER_VERSION }));

/** No normalization: anchors are UTF-16 offsets into the exact decoded source text. */
export function extractRetainedText(bytes: Uint8Array, sourceRef: CreationObjectRef,
  materialId: string, unitId: string, signal?: AbortSignal): TextExtractionArtifact {
  signal?.throwIfAborted();
  if (bytes.byteLength > MATERIAL_LIMITS.extractedTextBytes) {
    throw new CreationStorageError('LIMIT_EXCEEDED', 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.');
  }
  if (sourceRef.kind !== 'upload' || bytes.byteLength !== sourceRef.byteLength || hash(bytes) !== sourceRef.checksum) {
    throw new CreationStorageError('INTEGRITY', 'Retained source does not match its reference.');
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new CreationStorageError('INVALID_INPUT', 'Provide UTF-8 text or Markdown.'); }
  if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new CreationStorageError('INVALID_INPUT', 'The source is empty or contains binary control characters.');
  }
  const version = textExtractionVersion(sourceRef.checksum);
  return textExtractionArtifactSchema.parse({ schemaVersion: 1, materialId, unitId, version,
    sourceChecksum: sourceRef.checksum, sourceRef, extractionKind: 'text', contentOrigin: 'user', offsetUnit: 'utf16',
    text, utf8ByteLength: bytes.byteLength, segments: segmentRetainedText(text, materialId, unitId, version, signal), coverage: { complete: true, omittedRanges: [] } });
}

/** Shared deterministic anchors into an artifact's own text, never invented raw-source offsets. */
export function segmentRetainedText(text: string, materialId: string, unitId: string, version: string, signal?: AbortSignal) {
  const segments: TextExtractionArtifact['segments'] = [];
  function emit(start: number, end: number, kind: 'text' | 'heading' | 'code') {
    while (start < end) {
      signal?.throwIfAborted();
      let stop = Math.min(start + 4096, end);
      if (stop < end && /[\ud800-\udbff]/.test(text[stop - 1])) stop--;
      if (segments.length >= 20_000) throw new CreationStorageError('LIMIT_EXCEEDED', 'Too many text sections. Select a smaller source; nothing was truncated.');
      const id = hash(`${materialId}:${unitId}:${version}:${start}:${stop}`);
      segments.push({ id, kind, text: text.slice(start, stop), location: {
        materialId, unitId, segmentId: id, anchor: { kind: 'text', start, end: stop },
      } });
      start = stop;
    }
  }
  let cursor = 0; let blockStart = 0; let fence: { char: string; length: number } | null = null;
  for (const match of text.matchAll(/[^\n]*(?:\n|$)/g)) {
    const line = match[0]; if (!line) continue;
    const marker = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)/.exec(line);
    if (fence) {
      cursor += line.length;
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) {
        emit(blockStart, cursor, 'code'); blockStart = cursor; fence = null;
      }
    } else if (marker) {
      emit(blockStart, cursor, 'text'); blockStart = cursor; cursor += line.length;
      fence = { char: marker[1][0], length: marker[1].length };
    } else if (/^ {0,3}#{1,6}[ \t]+/.test(line)) {
      emit(blockStart, cursor, 'text'); emit(cursor, cursor + line.length, 'heading');
      cursor += line.length; blockStart = cursor;
    } else { cursor += line.length; }
  }
  emit(blockStart, text.length, fence ? 'code' : 'text');
  return segments;
}
