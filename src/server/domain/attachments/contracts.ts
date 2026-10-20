export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const DAILY_UPLOAD_QUOTA_BYTES = 100 * 1024 * 1024; // 100 MiB / user / day

export interface ReserveUploadInput {
  userId: string;
  channelId: string;
  filename: string;
  mediaType: string;
  byteLength: number;
}

export interface ReserveUploadResult {
  attachmentId: string;
  storageKey: string;
  uploadUrl: string;
  filename: string;
  mediaType: string;
  byteLength: number;
  maxByteLength: number;
}

export interface AttachmentSummaryDTO {
  id: string;
  filename: string;
  mediaType: string;
  byteLength: number;
  downloadUrl: string;
  status: string;
}

/**
 * Validates file magic bytes against declared MIME type to prevent extension/MIME spoofing.
 */
export function validateMagicBytes(buffer: Buffer, mediaType: string): boolean {
  if (buffer.length < 4) return false;

  switch (mediaType) {
    case 'image/png':
      // 89 50 4E 47 (\x89PNG)
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

    case 'image/jpeg':
      // FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case 'image/gif':
      // 47 49 46 38 (GIF8)
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;

    case 'image/webp':
      // 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
      if (buffer.length < 12) return false;
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );

    case 'application/pdf':
      // 25 50 44 46 (%PDF)
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    default:
      return false;
  }
}

/**
 * Reject active content / scripts in images and documents (SVG, HTML, JS).
 */
export function containsActiveExecutableContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8').toLowerCase();
  const dangerousPatterns = [
    '<svg',
    '<!doctype html',
    '<html',
    '<script',
    'javascript:',
    'vbscript:',
    '<iframe',
    '<object',
    '<embed',
  ];

  return dangerousPatterns.some((pattern) => sample.includes(pattern));
}
