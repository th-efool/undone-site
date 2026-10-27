import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getAppOAuthRedirectUri,
  exchangeGitHubAppUserCode,
} from '../app/config';
import {
  createAppFlowState,
  isFreshAppFlowState,
} from '../app/flow';

describe('Gap 3: Callback Compatibility & Redirect URI Robustness', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getAppOAuthRedirectUri', () => {
    it('respects GITHUB_APP_OAUTH_REDIRECT_URI environment variable when set', () => {
      process.env.GITHUB_APP_OAUTH_REDIRECT_URI = 'https://custom-domain.com/oauth/cb';
      const req = new NextRequest('http://localhost:3000/api/test');
      expect(getAppOAuthRedirectUri(req)).toBe('https://custom-domain.com/oauth/cb');
    });

    it('parses multi-hop x-forwarded-proto and x-forwarded-host headers', () => {
      delete process.env.GITHUB_APP_OAUTH_REDIRECT_URI;
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/app/install', {
        headers: {
          'x-forwarded-proto': 'https, http',
          'x-forwarded-host': 'undone.run, 10.0.0.1:80',
        },
      });

      const uri = getAppOAuthRedirectUri(req);
      expect(uri).toBe('https://undone.run/api/personal-workspace/github/app/oauth/callback');
    });

    it('supports preferredPath parameter for unified callback routing', () => {
      delete process.env.GITHUB_APP_OAUTH_REDIRECT_URI;
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/app/install', {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'undone.run',
        },
      });

      const uri = getAppOAuthRedirectUri(req, '/api/personal-workspace/github/app/callback');
      expect(uri).toBe('https://undone.run/api/personal-workspace/github/app/callback');
    });

    it('enforces https in production for non-localhost hosts', () => {
      delete process.env.GITHUB_APP_OAUTH_REDIRECT_URI;
      process.env.NODE_ENV = 'production';
      const req = new NextRequest('http://undone.site/api/personal-workspace/github/app/install', {
        headers: {
          'x-forwarded-proto': 'http',
          'x-forwarded-host': 'undone.site',
        },
      });

      const uri = getAppOAuthRedirectUri(req);
      expect(uri).toBe('https://undone.site/api/personal-workspace/github/app/oauth/callback');
    });

    it('allows http in production for localhost / 127.0.0.1 development testing', () => {
      delete process.env.GITHUB_APP_OAUTH_REDIRECT_URI;
      process.env.NODE_ENV = 'production';
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/app/install', {
        headers: {
          'x-forwarded-proto': 'http',
          'x-forwarded-host': 'localhost:3000',
        },
      });

      const uri = getAppOAuthRedirectUri(req);
      expect(uri).toBe('http://localhost:3000/api/personal-workspace/github/app/oauth/callback');
    });
  });

  describe('exchangeGitHubAppUserCode self-annealing fallback', () => {
    it('returns token directly on successful primary exchange', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'ghu_primary_token' }),
      });
      global.fetch = mockFetch;

      const token = await exchangeGitHubAppUserCode(
        'valid-code',
        'https://undone.site/cb',
        { appId: '1', clientId: 'c1', clientSecret: 's1', privateKeyPem: 'key' },
      );

      expect(token).toBe('ghu_primary_token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.redirect_uri).toBe('https://undone.site/cb');
    });

    it('transparently retries without redirect_uri when GitHub returns redirect_uri_mismatch', async () => {
      const mockFetch = vi.fn()
        // First call fails with redirect_uri_mismatch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: 'redirect_uri_mismatch', error_description: 'Mismatch' }),
        })
        // Second call without redirect_uri succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'ghu_fallback_token' }),
        });
      global.fetch = mockFetch;

      const token = await exchangeGitHubAppUserCode(
        'valid-code',
        'https://undone.site/mismatched-path',
        { appId: '1', clientId: 'c1', clientSecret: 's1', privateKeyPem: 'key' },
      );

      expect(token).toBe('ghu_fallback_token');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(firstCallBody.redirect_uri).toBe('https://undone.site/mismatched-path');

      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondCallBody.redirect_uri).toBeUndefined();
    });

    it('returns null if clientSecret is missing', async () => {
      const token = await exchangeGitHubAppUserCode(
        'valid-code',
        'https://undone.site/cb',
        { appId: '1', clientId: 'c1', clientSecret: '', privateKeyPem: 'key' },
      );
      expect(token).toBeNull();
    });
  });

  describe('isFreshAppFlowState and createAppFlowState', () => {
    it('creates flow state with redirectUri', () => {
      const state = createAppFlowState('user-1', 'nonce-123', 'https://undone.site/callback');
      expect(state.userId).toBe('user-1');
      expect(state.stateNonce).toBe('nonce-123');
      expect(state.redirectUri).toBe('https://undone.site/callback');
      expect(typeof state.createdAt).toBe('number');
    });

    it('validates fresh state with matching nonce and user', () => {
      const state = createAppFlowState('user-1', 'nonce-123');
      expect(isFreshAppFlowState(state, 'nonce-123', 'user-1')).toBe(true);
    });

    it('rejects mismatched nonce (constant-time verification)', () => {
      const state = createAppFlowState('user-1', 'nonce-123');
      expect(isFreshAppFlowState(state, 'nonce-wrong', 'user-1')).toBe(false);
      expect(isFreshAppFlowState(state, 'nonce-12', 'user-1')).toBe(false); // different length
      expect(isFreshAppFlowState(state, null, 'user-1')).toBe(false);
    });

    it('rejects state expired by more than 10 minutes', () => {
      const state = {
        stateNonce: 'nonce-123',
        userId: 'user-1',
        createdAt: Date.now() - 11 * 60 * 1000,
      };
      expect(isFreshAppFlowState(state, 'nonce-123', 'user-1')).toBe(false);
    });
  });
});
