// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.resetModules());
it('emits terminal query failures without losing a cached result', async () => {
  const { getQueryClient } = await import('@/src/client/react-query/query-client');
  const { subscribeSiteFailures } = await import('../site-failures');
  const client = getQueryClient(); client.clear(); const receive = vi.fn(); const stop = subscribeSiteFailures(receive);
  client.setQueryData(['explore'], { items: ['existing'] });
  await expect(client.fetchQuery({ queryKey: ['explore'], staleTime: 0, retry: false, queryFn: async () => { throw new Error('PRIVATE_SERVER_DETAIL'); } })).rejects.toThrow('PRIVATE_SERVER_DETAIL');
  expect(client.getQueryData(['explore'])).toEqual({ items: ['existing'] });
  expect(receive.mock.calls.some(call => call[0].code === 'data')).toBe(true);
  expect(JSON.stringify(receive.mock.calls)).not.toContain('PRIVATE_SERVER_DETAIL');
  stop(); client.clear();
});
