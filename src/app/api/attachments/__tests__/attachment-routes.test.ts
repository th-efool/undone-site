import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as reserveUpload } from '../reserve/route';
import { PUT as uploadFile } from '../[id]/upload/route';
import { GET as downloadFile } from '../[id]/download/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { attachmentService } from '@/src/server/domain/attachments/attachment.service';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/attachments/attachment.service', () => ({
  attachmentService: {
    reserveUpload: vi.fn(),
    uploadFile: vi.fn(),
    getDownloadStream: vi.fn(),
  },
}));

describe('Phase 9 Attachment API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/attachments/reserve', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/attachments/reserve', {
        method: 'POST',
        body: JSON.stringify({ channelId: 'ch-1', filename: 'test.png', mediaType: 'image/png', byteLength: 100 }),
      });
      const res = await reserveUpload(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 for guest accounts', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(true);

      const req = new NextRequest('http://localhost/api/attachments/reserve', {
        method: 'POST',
        body: JSON.stringify({ channelId: 'ch-1', filename: 'test.png', mediaType: 'image/png', byteLength: 100 }),
      });
      const res = await reserveUpload(req);
      expect(res.status).toBe(403);
    });

    it('returns upload reservation on valid request', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(attachmentService.reserveUpload).mockResolvedValueOnce({
        attachmentId: 'att-1',
        storageKey: 'key-1',
        uploadUrl: '/api/attachments/att-1/upload',
        filename: 'test.png',
        mediaType: 'image/png',
        byteLength: 100,
        maxByteLength: 10485760,
      });

      const req = new NextRequest('http://localhost/api/attachments/reserve', {
        method: 'POST',
        body: JSON.stringify({ channelId: 'ch-1', filename: 'test.png', mediaType: 'image/png', byteLength: 100 }),
      });
      const res = await reserveUpload(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.attachmentId).toBe('att-1');
    });
  });

  describe('PUT /api/attachments/[id]/upload', () => {
    it('processes binary upload and returns summary', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(attachmentService.uploadFile).mockResolvedValueOnce({
        id: 'att-1',
        filename: 'test.png',
        mediaType: 'image/png',
        byteLength: 4,
        downloadUrl: '/api/attachments/att-1/download',
        status: 'READY',
      });

      const req = new NextRequest('http://localhost/api/attachments/att-1/upload', {
        method: 'PUT',
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      });
      const res = await uploadFile(req, { params: Promise.resolve({ id: 'att-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('READY');
    });
  });

  describe('GET /api/attachments/[id]/download', () => {
    it('serves file with safe headers and nosniff', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      const fileBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      vi.mocked(attachmentService.getDownloadStream).mockResolvedValueOnce({
        buffer: fileBytes,
        filename: 'test.png',
        mediaType: 'image/png',
        byteLength: 4,
      });

      const req = new NextRequest('http://localhost/api/attachments/att-1/download');
      const res = await downloadFile(req, { params: Promise.resolve({ id: 'att-1' }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Content-Disposition')).toContain('inline');
    });
  });
});
