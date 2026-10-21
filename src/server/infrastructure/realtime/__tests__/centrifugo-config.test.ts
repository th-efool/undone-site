import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Centrifugo v6 Configuration and Ingress Hardening', () => {
  const rootDir = resolve(__dirname, '../../../../../');
  const configPath = resolve(rootDir, 'centrifugo.config.json');
  const composePath = resolve(rootDir, 'docker-compose.yml');
  const nginxPath = resolve(rootDir, 'infra/centrifugo/nginx.conf');

  const configJson = JSON.parse(readFileSync(configPath, 'utf8'));
  const composeYaml = readFileSync(composePath, 'utf8');
  const nginxConf = readFileSync(nginxPath, 'utf8');

  it('enforces secure core settings in centrifugo.config.json', () => {
    // Admin and debug must be disabled
    expect(configJson.admin?.enabled).toBe(false);
    expect(configJson.debug?.enabled).toBe(false);

    // Private health and metrics enabled
    expect(configJson.health?.enabled).toBe(true);
    expect(configJson.prometheus?.enabled).toBe(true);

    // No wildcard allowed origins
    expect(configJson.client?.allowed_origins).toBeInstanceOf(Array);
    expect(configJson.client.allowed_origins).not.toContain('*');

    // Limits
    expect(configJson.client.channel_limit).toBeLessThanOrEqual(32);
    expect(configJson.client.user_connection_limit).toBeLessThanOrEqual(10);
    expect(configJson.client.connection_limit).toBeLessThanOrEqual(2000);
    expect(configJson.websocket?.message_size_limit).toBeLessThanOrEqual(65536);

    // Proxy endpoints defined
    expect(configJson.proxy?.subscribe?.endpoint).toBeTruthy();
    expect(configJson.proxy?.sub_refresh?.endpoint).toBeTruthy();
    expect(configJson.proxy?.subscribe?.http_static_headers?.['X-Centrifugo-Proxy-Key']).toBeTruthy();
  });

  it('enforces strict namespace policies across all 7 real-time scopes', () => {
    const namespaces = configJson.namespaces as Array<any>;
    expect(namespaces).toBeInstanceOf(Array);

    const expectedNamespaces = ['user', 'dm', 'group', 'community', 'room', 'roomchat', 'signal'];
    const namespaceMap = new Map(namespaces.map(ns => [ns.name, ns]));

    for (const name of expectedNamespaces) {
      expect(namespaceMap.has(name), `Missing namespace '${name}'`).toBe(true);
      const ns = namespaceMap.get(name)!;

      // Every namespace must use server-side proxy authorization
      expect(ns.subscribe_proxy_enabled).toBe(true);
      expect(ns.sub_refresh_proxy_enabled).toBe(true);
    }

    // Ephemeral signal (typing) must NOT retain history
    const signalNs = namespaceMap.get('signal')!;
    expect(signalNs.history_size).toBeUndefined();

    // Durable scopes must configure short recovery and history
    const durableScopes = ['user', 'dm', 'group', 'community', 'room', 'roomchat'];
    for (const scope of durableScopes) {
      const ns = namespaceMap.get(scope)!;
      expect(ns.history_size).toBe(100);
      expect(ns.history_ttl).toBe('300s');
      expect(ns.force_recovery).toBe(true);
    }

    // Room presence and join/leave
    const roomNs = namespaceMap.get('room')!;
    expect(roomNs.presence).toBe(true);
    expect(roomNs.join_leave).toBe(true);
  });

  it('pins image version, injects secrets, and sets healthchecks in docker-compose.yml', () => {
    // Must be pinned to v6.10.0, not :v5 or :latest
    expect(composeYaml).toMatch(/image:\s*centrifugo\/centrifugo:v6\.10\.0/);
    expect(composeYaml).not.toMatch(/image:\s*centrifugo\/centrifugo:(?:v5|latest)/);

    // Must use environment variable interpolation, no hardcoded production passwords
    expect(composeYaml).toContain('${CENTRIFUGO_TOKEN_HMAC_SECRET_KEY');
    expect(composeYaml).toContain('${CENTRIFUGO_API_KEY');

    // Healthcheck declared with wget
    expect(composeYaml).toContain('wget --no-verbose --tries=1 --spider http://localhost:8000/health');

    // Resource limits declared
    expect(composeYaml).toContain('limits:');
    expect(composeYaml).toContain('memory: 512M');
    expect(composeYaml).toContain('restart: unless-stopped');
  });

  it('strictly blocks private endpoints and terminates WSS in nginx.conf', () => {
    // Blocks internal endpoints from public ingress
    expect(nginxConf).toMatch(/location\s+\/api\/\s*\{[^}]*return\s+403/);
    expect(nginxConf).toMatch(/location\s+\/metrics\s*\{[^}]*return\s+403/);
    expect(nginxConf).toMatch(/location\s+\/health\s*\{[^}]*return\s+403/);
    expect(nginxConf).toMatch(/location\s+\/admin\s*\{[^}]*return\s+403/);
    expect(nginxConf).toMatch(/location\s+\/debug\s*\{[^}]*return\s+403/);

    // Forwards WebSocket listener with upgrade headers
    expect(nginxConf).toContain('location /connection/websocket');
    expect(nginxConf).toContain('proxy_set_header Upgrade $http_upgrade');
    expect(nginxConf).toContain('proxy_set_header Connection $connection_upgrade');

    // Proxy read timeout >= 60s
    expect(nginxConf).toMatch(/proxy_read_timeout\s+(?:60|120|300)s/);
  });
});
