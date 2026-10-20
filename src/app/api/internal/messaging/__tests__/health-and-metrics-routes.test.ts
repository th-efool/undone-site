import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHealth } from '../health/route';
import { GET as getMetrics } from '../metrics/route';
import { messagingMetricsService } from '@/src/server/domain/messaging/metrics.service';

vi.mock('@/src/server/domain/messaging/metrics.service', () => ({
  messagingMetricsService: {
    getMetricsSummary: vi.fn(),
    getPrometheusFormat: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/messaging/proxy-auth.service', () => ({
  verifyProxyStaticKey: vi.fn((key) => key === 'valid-proxy-key'),
  CENTRIFUGO_PROXY_KEY_HEADER: 'x-centrifugo-proxy-key',
}));

describe('Internal Messaging Health & Metrics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_KEY = 'valid-internal-secret';
  });

  describe('GET /api/internal/messaging/health', () => {
    it('returns 403 when no internal credentials are provided', async () => {
      const req = new NextRequest('http://localhost/api/internal/messaging/health');
      const res = await getHealth(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 when wrong credential is provided', async () => {
      const req = new NextRequest('http://localhost/api/internal/messaging/health', {
        headers: { 'x-internal-secret': 'wrong-secret' },
      });
      const res = await getHealth(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 with metrics summary when healthy', async () => {
      vi.mocked(messagingMetricsService.getMetricsSummary).mockResolvedValueOnce({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        outbox: {
          pendingDeliveries: 0,
          deadLetters: 0,
          oldestPendingAgeSeconds: 0,
        },
        studyRooms: {
          activeRooms: 3,
          activeLeases: 12,
          activeSprints: 1,
        },
        alerts: [],
      });

      const req = new NextRequest('http://localhost/api/internal/messaging/health', {
        headers: { 'x-internal-secret': 'valid-internal-secret' },
      });
      const res = await getHealth(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.outbox.pendingDeliveries).toBe(0);
    });

    it('returns 503 when system is in critical state (dead letters or high lag)', async () => {
      vi.mocked(messagingMetricsService.getMetricsSummary).mockResolvedValueOnce({
        status: 'critical',
        timestamp: new Date().toISOString(),
        outbox: {
          pendingDeliveries: 15,
          deadLetters: 2, // Dead letters present!
          oldestPendingAgeSeconds: 400,
        },
        studyRooms: {
          activeRooms: 1,
          activeLeases: 2,
          activeSprints: 0,
        },
        alerts: ['CRITICAL: 2 message deliveries have moved to DEAD_LETTER status.'],
      });

      const req = new NextRequest('http://localhost/api/internal/messaging/health', {
        headers: { 'x-centrifugo-proxy-key': 'valid-proxy-key' },
      });
      const res = await getHealth(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.status).toBe('critical');
    });
  });

  describe('GET /api/internal/messaging/metrics', () => {
    it('returns 200 with Prometheus text format when authorized', async () => {
      vi.mocked(messagingMetricsService.getPrometheusFormat).mockResolvedValueOnce(
        '# HELP undone_messaging_outbox_pending Total pending deliveries\nundone_messaging_outbox_pending 0\n'
      );

      const req = new NextRequest('http://localhost/api/internal/messaging/metrics', {
        headers: { 'x-internal-secret': 'valid-internal-secret' },
      });
      const res = await getMetrics(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      const text = await res.text();
      expect(text).toContain('undone_messaging_outbox_pending 0');
    });
  });
});
